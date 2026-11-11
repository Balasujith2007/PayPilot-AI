import type { Tool } from "@google/genai"

import { checkBudgetTool } from "./check-budget"
import { compareProductsTool } from "./compare-products"
import { proposeCartActionTool } from "./propose-cart-action"
import { searchProductsTool } from "./search-products"
import type { AgentToolResult, RegisteredAgentTool } from "./types"

/**
 * Hard caps for a single chat request. The agent loop stops as soon as either
 * is reached, so a misbehaving model can never run away with tool calls.
 */
export const AGENT_MAX_TOOL_CALLS = 6
export const AGENT_MAX_TOOL_ROUNDS = 4

/** Shown when the agent cannot produce an answer (tool loop exhausted, etc). */
export const AGENT_TOOL_FALLBACK_MESSAGE =
  "I couldn't complete that request. Could you rephrase it, or browse the shop and I'll help from there?"

/**
 * The complete, server-side allow-list of tools. Nothing outside this list can
 * ever be executed — see {@link executeAgentTool}.
 */
const TOOL_LIST: readonly RegisteredAgentTool[] = [
  searchProductsTool,
  compareProductsTool,
  checkBudgetTool,
  proposeCartActionTool,
]

/** A Map is used so lookups can never hit `__proto__` or `constructor`. */
const TOOL_REGISTRY = new Map<string, RegisteredAgentTool>(
  TOOL_LIST.map((tool) => [tool.name, tool])
)

/** Registered tool names, useful for assertions and diagnostics. */
export const AGENT_TOOL_NAMES: readonly string[] = TOOL_LIST.map((tool) => tool.name)

/** Declarations advertised to Gemini. The model may only request these. */
export const AGENT_TOOL_DECLARATIONS: Tool[] = [
  {
    functionDeclarations: TOOL_LIST.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  },
]

export function getAgentTool(name: string): RegisteredAgentTool | undefined {
  return TOOL_REGISTRY.get(name)
}

function summarizeValidationErrors(flat: {
  formErrors: string[]
  fieldErrors: Record<string, string[] | undefined>
}): string {
  const fieldProblems = Object.entries(flat.fieldErrors).map(
    ([field, messages]) => `${field}: ${(messages ?? []).join(", ")}`
  )
  const problems = [...fieldProblems, ...flat.formErrors].filter(Boolean)
  return problems.length > 0 ? problems.join("; ") : "arguments did not match the tool schema"
}

/**
 * The single execution boundary for agent tools.
 *
 * Security contract:
 * - only names present in the registry are ever looked up (unknown names are
 *   rejected before any tool code runs);
 * - every argument object is validated by that tool's own Zod schema, so the
 *   model's JSON never reaches business logic unchecked;
 * - failures are converted into a stable, non-sensitive result instead of
 *   leaking stack traces or catalog internals to the model.
 */
export async function executeAgentTool(
  name: unknown,
  args: unknown
): Promise<AgentToolResult> {
  const requested = typeof name === "string" ? name.trim() : ""
  const tool = requested ? getAgentTool(requested) : undefined

  if (!tool) {
    const label = requested || "(unnamed)"
    return {
      ok: false,
      tool: label,
      error: { code: "UNKNOWN_TOOL", message: `Tool "${label}" is not available.` },
    }
  }

  const parsed = tool.schema.safeParse(args ?? {})
  if (!parsed.success) {
    return {
      ok: false,
      tool: tool.name,
      error: {
        code: "INVALID_ARGUMENTS",
        message: `Invalid arguments for ${tool.name}: ${summarizeValidationErrors(
          parsed.error.flatten()
        )}`,
      },
    }
  }

  try {
    return await tool.execute(parsed.data)
  } catch {
    // Deliberately swallow the original error: it may contain file paths or
    // catalog internals that must not be echoed into the conversation.
    return {
      ok: false,
      tool: tool.name,
      error: { code: "TOOL_FAILED", message: `${tool.name} could not complete the request.` },
    }
  }
}
