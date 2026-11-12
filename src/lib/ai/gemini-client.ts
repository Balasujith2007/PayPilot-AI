import { GoogleGenAI, ApiError } from "@google/genai"
import type { Tool } from "@google/genai"

import { env } from "@/lib/env"

import { runToolLoop } from "./tool-loop"
import type { ToolLoopMessage, ToolLoopResult } from "./tool-loop"
import type { AgentToolResult } from "./tools/types"

// Server-only Gemini client.
//
// The API key is read from the validated server environment and never leaves
// this module. Nothing here may be imported from a "use client" file, and the
// key must never be returned in a response or written to logs.

/**
 * Raised when Gemini is not configured (missing API key) or used from the
 * browser. Route handlers translate this into a fail-closed 503 response.
 */
export class GeminiConfigError extends Error {
  constructor(message = "Gemini is not configured") {
    super(message)
    this.name = "GeminiConfigError"
  }
}

/** Simplified message shape used by agent code (independent of the SDK types). */
export interface GeminiMessage {
  role: "user" | "model"
  text: string
}

export interface GenerateTextInput {
  messages: GeminiMessage[]
  systemInstruction?: string
}

export interface GenerateTextResult {
  text: string
  model: string
}

/** The model id used for all Gemini calls. */
export const GEMINI_MODEL = env.GEMINI_MODEL

/** Maximum retry attempts for rate-limited requests. */
const MAX_RETRIES = 3

/** Base delay for exponential backoff (in milliseconds). */
const BASE_RETRY_DELAY_MS = 1000

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Extract Retry-After header value from an error if available.
 * Returns the delay in milliseconds, or null if not present.
 */
function getRetryAfterDelay(error: unknown): number | null {
  if (!(error instanceof ApiError)) return null

  // ApiError may not expose headers directly; try to extract from the error
  // message or status. For now, we'll use exponential backoff by default.
  // If the SDK provides headers in the future, this can be enhanced.
  return null
}

/**
 * Check if an error is a temporary rate limit (429) that can be retried.
 */
export function isRetriableRateLimit(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  // Only retry 429 errors that are not quota exhausted
  return error.status === 429 && !isQuotaExhausted(error)
}

/**
 * Check if an error indicates quota exhaustion (not a temporary rate limit).
 * This is inferred from error messages that suggest permanent quota issues.
 */
export function isQuotaExhausted(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false

  const message = error.message?.toLowerCase() ?? ""
  // Common patterns for quota exhaustion messages
  return (
    error.status === 429 &&
    (message.includes("quota") ||
      message.includes("limit exceeded") ||
      message.includes("billing") ||
      message.includes("resource exhausted"))
  )
}

let client: GoogleGenAI | null = null

/** True when a Gemini API key is present in the server environment. */
export function isGeminiConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY)
}

/**
 * Return a lazily-created, shared Gemini client.
 * Throws {@link GeminiConfigError} when the key is missing (fail closed).
 */
export function getGeminiClient(): GoogleGenAI {
  if (typeof window !== "undefined") {
    throw new GeminiConfigError("Gemini client can only be used on the server")
  }

  if (!env.GEMINI_API_KEY) {
    throw new GeminiConfigError("GEMINI_API_KEY is not set")
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  }

  return client
}

/**
 * Basic text generation. This is intentionally minimal for Task 14 — tool
 * calling, streaming and multi-turn agent orchestration are added later.
 */
export async function generateText({
  messages,
  systemInstruction,
}: GenerateTextInput): Promise<GenerateTextResult> {
  if (messages.length === 0) {
    throw new Error("At least one message is required")
  }

  const ai = getGeminiClient()

  let lastError: unknown = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: messages.map((message) => ({
          role: message.role,
          parts: [{ text: message.text }],
        })),
        config: systemInstruction ? { systemInstruction } : undefined,
      })

      return { text: response.text ?? "", model: GEMINI_MODEL }
    } catch (error) {
      lastError = error

      // If this is a quota exhausted error, don't retry
      if (isQuotaExhausted(error)) {
        throw error
      }

      // If not a retriable rate limit, throw immediately
      if (!isRetriableRateLimit(error)) {
        throw error
      }

      // If we've exhausted retries, throw the last error
      if (attempt >= MAX_RETRIES) {
        throw error
      }

      // Calculate delay with exponential backoff
      const retryAfterDelay = getRetryAfterDelay(error)
      const baseDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
      const delay = retryAfterDelay ?? baseDelay

      console.log(`[gemini-client] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying after ${delay}ms`)

      await sleep(delay)
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new Error("Unknown error in generateText")
}

export interface GenerateWithToolsInput {
  messages: ToolLoopMessage[]
  systemInstruction?: string
  tools: Tool[]
  /** Validated registry entry point — see executeAgentTool in ./tools. */
  executeTool: (name: string, args: Record<string, unknown>) => Promise<AgentToolResult>
  maxToolCalls: number
  maxRounds: number
  fallbackMessage: string
}

/**
 * Tool-calling generation.
 *
 * The model may only *request* tools; every request is routed through the
 * caller-supplied {@link GenerateWithToolsInput.executeTool}, which validates
 * the name against the server-side registry and the arguments against the
 * tool's schema before anything runs. The loop is bounded by `maxRounds` and
 * `maxToolCalls` so it always terminates.
 */
export async function generateWithTools({
  messages,
  systemInstruction,
  tools,
  executeTool,
  maxToolCalls,
  maxRounds,
  fallbackMessage,
}: GenerateWithToolsInput): Promise<ToolLoopResult> {
  if (messages.length === 0) {
    throw new Error("At least one message is required")
  }

  const ai = getGeminiClient()

  return runToolLoop({
    messages,
    tools,
    systemInstruction,
    executeTool,
    maxToolCalls,
    maxRounds,
    fallbackMessage,
    model: {
      async generate({ contents, tools: requestTools, systemInstruction: instruction }) {
        let lastError: unknown = null

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: GEMINI_MODEL,
              contents,
              config: {
                ...(instruction ? { systemInstruction: instruction } : {}),
                tools: requestTools,
              },
            })

            return {
              content: response.candidates?.[0]?.content,
              text: response.text,
              functionCalls: response.functionCalls,
            }
          } catch (error) {
            lastError = error

            // If this is a quota exhausted error, don't retry
            if (isQuotaExhausted(error)) {
              throw error
            }

            // If not a retriable rate limit, throw immediately
            if (!isRetriableRateLimit(error)) {
              throw error
            }

            // If we've exhausted retries, throw the last error
            if (attempt >= MAX_RETRIES) {
              throw error
            }

            // Calculate delay with exponential backoff
            const retryAfterDelay = getRetryAfterDelay(error)
            const baseDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
            const delay = retryAfterDelay ?? baseDelay

            console.log(`[gemini-client] Rate limited in tool loop (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying after ${delay}ms`)

            await sleep(delay)
          }
        }

        // This should never be reached, but TypeScript needs it
        throw lastError ?? new Error("Unknown error in generateWithTools")
      },
    },
  })
}
