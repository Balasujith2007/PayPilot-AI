import { NextResponse } from "next/server"

import { refusalFor, rejectProposal, toRejectionResult } from "@/lib/ai/approvals"
import { proposalDecisionRequestSchema } from "@/lib/validators"
import type { ApiError as ApiErrorBody, ApiResponse, CartRejectionResult } from "@/types"

// Rejection only touches the server-side proposal registry.
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
 * Decline a cart proposal.
 *
 * Rejection marks the proposal so it can never be approved afterwards and
 * never touches a cart — there is no code path from here into the Zustand
 * store. Like approval, the request body carries only the proposal id.
 *
 * Refusals:
 * - 400 `INVALID_REQUEST`             — malformed or missing proposal id
 * - 404 `PROPOSAL_NOT_FOUND`          — unknown or already evicted proposal
 * - 410 `PROPOSAL_EXPIRED`            — already expired, so no longer pending
 * - 409 `PROPOSAL_ALREADY_PROCESSED`  — already approved or already declined
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
      "Invalid rejection request.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    )
  }

  const decision = rejectProposal(parsed.data.proposalId)

  const refusal = refusalFor(decision)
  if (refusal) return errorResponse(refusal.status, refusal.code, refusal.message)

  if (decision.status !== "REJECTED") {
    // Unreachable: every other status is covered by refusalFor above.
    return errorResponse(500, "INTERNAL_ERROR", "The proposal could not be declined.")
  }

  const response: ApiResponse<CartRejectionResult> = { data: toRejectionResult(decision.record) }
  return NextResponse.json(response)
}
