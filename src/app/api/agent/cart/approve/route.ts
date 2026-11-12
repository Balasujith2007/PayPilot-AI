import { NextResponse } from "next/server"

import { approveProposal, refusalFor, toApprovalDecision } from "@/lib/ai/approvals"
import { proposalDecisionRequestSchema } from "@/lib/validators"
import type { ApiError as ApiErrorBody, ApiResponse, CartApprovalDecision } from "@/types"

// Approval re-reads the server-side catalog, so it must run on Node.
export const runtime = "nodejs"

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
 * Decide a cart proposal the shopper asked to approve.
 *
 * The request body carries *only* the proposal id. Prices, stock levels, and
 * product details are re-read from the server catalog by the lifecycle, so
 * the browser cannot influence what would be added — it can only say "yes" to
 * a proposal the server already built.
 *
 * This endpoint decides; it does not apply. The response carries the
 * server-revalidated lines and the storefront is the only place that writes
 * them into the Zustand cart, and only after this call reports `APPROVED`.
 *
 * Refusals (all of which leave the cart untouched):
 * - 400 `INVALID_REQUEST`             — malformed or missing proposal id
 * - 404 `PROPOSAL_NOT_FOUND`          — unknown or already evicted proposal
 * - 410 `PROPOSAL_EXPIRED`            — past its expiry
 * - 409 `PROPOSAL_ALREADY_PROCESSED`  — replay, or already approved/rejected
 * - 409 `CART_PROPOSAL_UNAVAILABLE`   — the lines can no longer be ordered
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "Request body must be valid JSON.")
  }

  const parsed = proposalDecisionRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "Invalid approval request.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    )
  }

  const decision = await approveProposal(parsed.data.proposalId)

  const refusal = refusalFor(decision)
  if (refusal) return errorResponse(refusal.status, refusal.code, refusal.message)

  if (decision.status !== "APPROVED" && decision.status !== "STALE") {
    // Unreachable: every other status is covered by refusalFor above.
    return errorResponse(500, "INTERNAL_ERROR", "The proposal could not be decided.")
  }

  const response: ApiResponse<CartApprovalDecision> = { data: toApprovalDecision(decision) }
  return NextResponse.json(response)
}
