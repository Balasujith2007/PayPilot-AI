import { NextResponse } from "next/server"

import { executeAgentTool } from "@/lib/ai/tools"
import { parseCartProposal } from "@/lib/ai/tools/propose-cart-action"
import { proposeCartActionArgsSchema } from "@/lib/validators"
import type { ApiError as ApiErrorBody, ApiResponse, CartProposal } from "@/types"

// Revalidation reads the server-side catalog, so it must run on Node.
export const runtime = "nodejs"

/** The same tool the agent proposes with — see src/lib/ai/tools/index.ts. */
const PROPOSE_TOOL = "propose_cart_action"

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
 * Re-validate a cart proposal right before the shopper applies it.
 *
 * The proposal the AI produced is a snapshot: prices and stock may have moved
 * on since. This endpoint rebuilds it from the current catalog through the
 * *same* registry entry point the agent used — identical Zod argument
 * validation, identical server-side price and stock checks — so the client
 * never becomes the price authority.
 *
 * Like the proposal itself, this endpoint is side-effect free: it never adds
 * to a cart, never starts checkout and never touches a payment. Applying the
 * result is a separate, explicit user action in the storefront.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "Request body must be valid JSON.")
  }

  const parsed = proposeCartActionArgsSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "Invalid cart proposal.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    )
  }

  const result = await executeAgentTool(PROPOSE_TOOL, parsed.data)

  // Every line was rejected (unknown product or variant, out of stock, or the
  // quantity exceeds available stock) — the proposal can no longer be applied.
  if (!result.ok) {
    return errorResponse(409, "CART_PROPOSAL_UNAVAILABLE", result.error.message)
  }

  const proposal = parseCartProposal(result.data)
  if (!proposal) {
    return errorResponse(500, "INTERNAL_ERROR", "The cart proposal could not be validated.")
  }

  const response: ApiResponse<CartProposal> = { data: proposal }
  return NextResponse.json(response)
}
