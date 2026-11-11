import type { Schema } from "@google/genai"
import type { z } from "zod"

/**
 * Stable, non-sensitive error codes. A tool never forwards provider text,
 * stack traces or catalog internals to the model — only these codes plus a
 * short message written for a shopper.
 */
export type AgentToolErrorCode =
  | "UNKNOWN_TOOL"
  | "INVALID_ARGUMENTS"
  | "NOT_FOUND"
  | "TOOL_FAILED"

export interface AgentToolError {
  code: AgentToolErrorCode
  message: string
}

/**
 * The only shape a tool may return.
 *
 * `data` is always rebuilt from the server-side catalog, so a hallucinated or
 * manipulated model response can never inject prices, stock levels or product
 * details into the conversation.
 */
export type AgentToolResult<TData = Record<string, unknown>> =
  | { ok: true; tool: string; data: TData }
  | { ok: false; tool: string; error: AgentToolError }

/** Definition authored by each tool module. */
export interface AgentToolDefinition<TArgs> {
  /** Must match the Gemini function declaration name exactly. */
  name: string
  description: string
  /** JSON schema advertised to Gemini (descriptive only — not trusted). */
  parameters: Schema
  /** Authoritative, server-side argument validator. */
  schema: z.ZodType<TArgs>
  execute: (args: TArgs) => Promise<AgentToolResult>
}

/**
 * Type-erased tool as stored in the registry. Tools are held behind this shape
 * so the registry can validate and run any of them uniformly.
 */
export interface RegisteredAgentTool {
  name: string
  description: string
  parameters: Schema
  schema: z.ZodType
  execute: (args: unknown) => Promise<AgentToolResult>
}
