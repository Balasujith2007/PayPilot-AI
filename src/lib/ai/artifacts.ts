import { parseCartProposal } from "./tools/propose-cart-action"
import type {
  AgentBudgetResult,
  AgentChatArtifacts,
  AgentComparisonResult,
  AgentSearchResult,
} from "@/types"

/**
 * Shape of one executed tool call as recorded by the tool loop.
 * Kept structural so this module does not depend on the loop implementation.
 */
interface ToolExecutionRecord {
  name: string
  ok: boolean
  data?: unknown
}

/**
 * Turn the tool results of a single agent turn into the structured artifacts
 * the chat UI renders.
 *
 * Every value originates from the server-side catalog: the model only chose
 * which tool to run and with which arguments. Nothing here is derived from
 * model text, so the UI never displays a price or a stock level the model
 * could have invented.
 *
 * Later calls win, so re-running a tool replaces the earlier artifact.
 */
export function collectArtifacts(
  executions: readonly ToolExecutionRecord[]
): AgentChatArtifacts {
  const artifacts: AgentChatArtifacts = {}

  for (const execution of executions) {
    if (!execution.ok || execution.data === undefined) continue

    switch (execution.name) {
      case "search_products":
        artifacts.search = execution.data as AgentSearchResult
        break
      case "compare_products":
        artifacts.comparison = execution.data as AgentComparisonResult
        break
      case "check_budget":
        artifacts.budget = execution.data as AgentBudgetResult
        break
      case "propose_cart_action": {
        // Validated rather than cast: the approval UI trusts `requiresApproval`
        // and `applied` before it is allowed to touch the cart.
        const proposal = parseCartProposal(execution.data)
        if (proposal) artifacts.cartProposal = proposal
        break
      }
      default:
        break
    }
  }

  return artifacts
}
