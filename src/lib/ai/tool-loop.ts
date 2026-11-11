import type { Content, FunctionCall, Part, Tool } from "@google/genai"

import type { AgentToolResult } from "./tools/types"

/** Simplified message shape used by agent code (independent of the SDK types). */
export interface ToolLoopMessage {
  role: "user" | "model"
  text: string
}

/**
 * The subset of a Gemini response the loop needs. Both the real SDK adapter
 * (see gemini-client.ts) and the deterministic test doubles implement this.
 */
export interface ToolLoopModelResponse {
  /** The model turn, echoed back verbatim on the next request. */
  content?: Content
  text?: string
  functionCalls?: FunctionCall[]
}

export interface ToolLoopModelRequest {
  contents: Content[]
  tools: Tool[]
  systemInstruction?: string
}

/**
 * Anything that can produce a model turn. Kept as a function type so the loop
 * can be exercised with scripted responses in tests — no SDK required.
 */
export interface ToolLoopModel {
  generate(request: ToolLoopModelRequest): Promise<ToolLoopModelResponse>
}

export interface AgentToolCallRecord {
  name: string
  ok: boolean
}

/**
 * One executed tool call including its server-built payload. `data` is kept
 * opaque here so the loop stays tool-agnostic; callers that know a tool's
 * contract (see collectArtifacts) narrow it.
 */
export interface ToolLoopToolExecution {
  name: string
  ok: boolean
  data?: unknown
  errorCode?: string
}

export interface ToolLoopInput {
  model: ToolLoopModel
  messages: ToolLoopMessage[]
  tools: Tool[]
  systemInstruction?: string
  /** Called for every model-requested tool. Must be the validated registry entry point. */
  executeTool: (name: string, args: Record<string, unknown>) => Promise<AgentToolResult>
  /** Upper bound on tools executed in one request. */
  maxToolCalls: number
  /** Upper bound on model round trips. */
  maxRounds: number
  /** Returned when no usable answer could be produced. */
  fallbackMessage: string
}

export interface ToolLoopResult {
  text: string
  toolCalls: AgentToolCallRecord[]
  /** Every executed call with its payload, in execution order. */
  toolExecutions: ToolLoopToolExecution[]
  rounds: number
  /** True when a cap stopped the loop before the model finished. */
  limitReached: boolean
  /** True when the model requested a tool that is not registered. */
  blockedCall: boolean
}

/**
 * Echo the model turn back into the conversation. Some SDK responses omit
 * `content`, so fall back to reconstructing it from the function calls —
 * Gemini requires the model's function calls to appear in the history.
 */
function modelTurnContent(
  response: ToolLoopModelResponse,
  calls: FunctionCall[]
): Content {
  if (response.content) return response.content
  return { role: "model", parts: calls.map((call) => ({ functionCall: call })) }
}

/**
 * Run the bounded tool-calling loop.
 *
 * Steps: send the conversation → let the model decide → validate and execute
 * any registered tools server-side → feed the results back → let the model
 * answer. The loop always terminates: at most `maxRounds` model turns and at
 * most `maxToolCalls` executions, after which it returns the fallback text.
 */
export async function runToolLoop(input: ToolLoopInput): Promise<ToolLoopResult> {
  const {
    model,
    messages,
    tools,
    systemInstruction,
    executeTool,
    maxToolCalls,
    maxRounds,
    fallbackMessage,
  } = input

  const contents: Content[] = messages.map((message) => ({
    role: message.role,
    parts: [{ text: message.text }],
  }))

  const toolCalls: AgentToolCallRecord[] = []
  const toolExecutions: ToolLoopToolExecution[] = []
  let blockedCall = false
  let rounds = 0

  while (rounds < maxRounds) {
    rounds += 1

    const response = await model.generate({ contents, tools, systemInstruction })
    const calls = response.functionCalls ?? []

    // No tool requested — this is the model's final answer.
    if (calls.length === 0) {
      return {
        text: response.text?.trim() || fallbackMessage,
        toolCalls,
        toolExecutions,
        rounds,
        limitReached: false,
        blockedCall,
      }
    }

    contents.push(modelTurnContent(response, calls))

    const responseParts: Part[] = []
    let limitReached = false

    for (const call of calls) {
      const name = call.name ?? ""

      if (toolCalls.length >= maxToolCalls) {
        // Every call must still get a response so the request stays valid for
        // Gemini, but nothing else is executed.
        limitReached = true
        responseParts.push({
          functionResponse: {
            id: call.id,
            name,
            response: {
              error: {
                code: "LIMIT_REACHED",
                message: `This request reached its limit of ${maxToolCalls} tool calls.`,
              },
            },
          },
        })
        continue
      }

      const result = await executeTool(name, call.args ?? {})
      toolCalls.push({ name: result.tool, ok: result.ok })
      toolExecutions.push(
        result.ok
          ? { name: result.tool, ok: true, data: result.data }
          : { name: result.tool, ok: false, errorCode: result.error.code }
      )
      if (!result.ok && result.error.code === "UNKNOWN_TOOL") blockedCall = true

      responseParts.push({
        functionResponse: {
          id: call.id,
          name: result.tool,
          response: result.ok ? { output: result.data } : { error: result.error },
        },
      })
    }

    contents.push({ role: "user", parts: responseParts })

    if (limitReached) {
      // Ask once more so the model can summarise what it did manage to do,
      // then stop regardless of what it returns.
      const final = await model.generate({ contents, tools, systemInstruction })
      rounds += 1
      return {
        text: final.text?.trim() || fallbackMessage,
        toolCalls,
        toolExecutions,
        rounds,
        limitReached: true,
        blockedCall,
      }
    }
  }

  // Ran out of rounds while the model kept asking for tools.
  return {
    text: fallbackMessage,
    toolCalls,
    toolExecutions,
    rounds,
    limitReached: true,
    blockedCall,
  }
}
