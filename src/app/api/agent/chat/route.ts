import { ApiError } from "@google/genai"
import { NextResponse } from "next/server"

import { GeminiConfigError, GEMINI_MODEL, generateWithTools, isGeminiConfigured } from "@/lib/ai/gemini-client"
import type { GeminiMessage } from "@/lib/ai/gemini-client"
import { collectArtifacts } from "@/lib/ai/artifacts"
import { PAYPILOT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt"
import {
  AGENT_MAX_TOOL_CALLS,
  AGENT_MAX_TOOL_ROUNDS,
  AGENT_TOOL_DECLARATIONS,
  AGENT_TOOL_FALLBACK_MESSAGE,
  executeAgentTool,
} from "@/lib/ai/tools"
import { agentChatRequestSchema } from "@/lib/validators"
import type { AgentChatMessage } from "@/lib/validators"
import type { AgentChatResult, ApiError as ApiErrorBody, ApiResponse } from "@/types"

// The Gemini SDK requires the Node.js runtime and must never run on the edge
// or in the browser. The API key stays server-side and is never returned.
export const runtime = "nodejs"

const AI_UNAVAILABLE_MESSAGE = "The AI assistant is not available right now."

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, string[]>
) {
  const body: ApiResponse<never> = { error: { code, message, details } as ApiErrorBody }
  return NextResponse.json(body, { status })
}

/**
 * Collapse the client conversation into a valid Gemini request: consecutive
 * same-role turns are merged and any leading assistant turn is dropped, since
 * Gemini requires an alternating conversation that starts with the user.
 */
function toGeminiMessages(messages: AgentChatMessage[]): GeminiMessage[] {
  const normalized: GeminiMessage[] = []

  for (const message of messages) {
    const role: GeminiMessage["role"] = message.role === "assistant" ? "model" : "user"
    const last = normalized[normalized.length - 1]

    if (last && last.role === role) {
      last.text = `${last.text}\n${message.content}`
    } else {
      normalized.push({ role, text: message.content })
    }
  }

  while (normalized.length > 0 && normalized[0].role === "model") {
    normalized.shift()
  }

  return normalized
}

function getProviderStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status
    return typeof status === "number" ? status : undefined
  }
  return undefined
}

/**
 * True for transport-level failures (connection reset, DNS, timeout). These
 * carry no HTTP status but are upstream faults, not bugs in this route.
 */
function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const cause = (error as { cause?: unknown }).cause
  const causeCode =
    typeof cause === "object" && cause !== null && "code" in cause
      ? String((cause as { code?: unknown }).code ?? "")
      : ""

  return (
    /^E[A-Z]+$/.test(causeCode) ||
    /fetch failed|socket hang up|network|timed out/i.test(error.message)
  )
}

/**
 * Map a failure from the Gemini call to a safe, client-facing response.
 *
 * Configuration-class problems (missing/invalid credentials, unavailable
 * model) fail closed as 503 `AI_UNAVAILABLE` so provider internals are never
 * exposed. Only genuine upstream faults surface as 502.
 */
function classifyProviderError(error: unknown): {
  status: number
  code: string
  message: string
} {
  const providerStatus = getProviderStatus(error)
  const providerMessage = error instanceof Error ? error.message : ""

  const isCredentialProblem =
    providerStatus === 401 ||
    providerStatus === 403 ||
    /API[_-]?KEY[_-]?INVALID|API key not valid/i.test(providerMessage)

  // Missing config, rejected credentials, or a model this key cannot use.
  if (error instanceof GeminiConfigError || isCredentialProblem || providerStatus === 404) {
    return { status: 503, code: "AI_UNAVAILABLE", message: AI_UNAVAILABLE_MESSAGE }
  }

  if (providerStatus === 429) {
    return {
      status: 429,
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again shortly.",
    }
  }

  if (providerStatus !== undefined || isNetworkError(error)) {
    return { status: 502, code: "PROVIDER_ERROR", message: "The AI provider returned an error." }
  }

  return { status: 500, code: "INTERNAL_ERROR", message: "Something went wrong." }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "Request body must be valid JSON.")
  }

  const parsed = agentChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "Invalid chat request.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    )
  }

  const messages = toGeminiMessages(parsed.data.messages)
  if (messages.length === 0) {
    return errorResponse(400, "INVALID_REQUEST", "A user message is required.")
  }

  // Fail closed: refuse to serve the agent when Gemini is not configured.
  // Checked after validation so malformed requests still receive a 400.
  if (!isGeminiConfigured()) {
    return errorResponse(503, "AI_UNAVAILABLE", AI_UNAVAILABLE_MESSAGE)
  }

  try {
    const { text, toolCalls, toolExecutions } = await generateWithTools({
      messages,
      systemInstruction: PAYPILOT_SYSTEM_PROMPT,
      tools: AGENT_TOOL_DECLARATIONS,
      // The registry is the only thing that can run a tool: it rejects any
      // name Gemini was not given and validates every argument with Zod.
      executeTool: executeAgentTool,
      maxToolCalls: AGENT_MAX_TOOL_CALLS,
      maxRounds: AGENT_MAX_TOOL_ROUNDS,
      fallbackMessage: AGENT_TOOL_FALLBACK_MESSAGE,
    })

    const result: AgentChatResult = {
      reply: text,
      model: GEMINI_MODEL,
      toolCalls,
      // Structured, catalog-derived results for the UI. The model only chose
      // the tools; every product, price and total here comes from the server.
      // A cart proposal is returned as data only — it is never applied here.
      artifacts: collectArtifacts(toolExecutions),
    }
    const response: ApiResponse<AgentChatResult> = { data: result }
    return NextResponse.json(response)
  } catch (error) {
    const { status, code, message } = classifyProviderError(error)

    // Log only a safe label — never the API key or the raw provider payload.
    console.error(
      "[agent/chat] Gemini request failed:",
      code,
      getProviderStatus(error) ?? "no-status"
    )

    return errorResponse(status, code, message)
  }
}
