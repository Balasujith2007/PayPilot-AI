import { proposalDiffersFrom } from "@/lib/ai/cart-approval"
import { executeAgentTool } from "@/lib/ai/tools"
import { parseCartProposal } from "@/lib/ai/tools/propose-cart-action"
import type { CartApprovalDecision, CartProposal, CartRejectionResult } from "@/types"

import {
  claimProposal,
  finalizeApproved,
  finalizeInvalid,
  finalizeRejected,
  registerProposal,
  toPublicProposal,
} from "./store"
import type {
  ProposalAuditRecord,
  ProposalDecisionResult,
  ProposalRequestLine,
  ProposalRevalidator,
  RevalidationResult,
} from "./types"

/** The registry entry that rebuilds a proposal from the server catalog. */
const PROPOSE_TOOL = "propose_cart_action"

/**
 * Rebuild a proposal from the *live* server catalog.
 *
 * Routed through the same registry entry the agent used, so the approval path
 * inherits identical Zod argument validation and identical price/stock rules.
 * Nothing here reads a price, a stock level or a product detail from the
 * client — the only input is the stored, server-validated line list.
 */
export const catalogRevalidator: ProposalRevalidator = async (items) => {
  const result = await executeAgentTool(PROPOSE_TOOL, { items })

  if (!result.ok) {
    return { ok: false, code: result.error.code, message: result.error.message }
  }

  const proposal = parseCartProposal(result.data)
  if (!proposal) {
    return {
      ok: false,
      code: "INVALID_PROPOSAL",
      message: "The proposal could not be rebuilt from the catalog.",
    }
  }

  return { ok: true, proposal }
}

/**
 * The lines a proposal was built from — accepted *and* rejected.
 *
 * Revalidation has to replay the original request, not just the accepted
 * lines: otherwise a line that was rejected at proposal time would silently
 * succeed on the second pass and every approval would be reported as stale.
 */
export function requestedLinesFromProposal(proposal: CartProposal): ProposalRequestLine[] {
  const accepted = proposal.items.map((line) => ({
    productId: line.productId,
    variantId: line.variantId,
    quantity: line.quantity,
  }))

  const rejected = proposal.rejected.map((line) => ({
    productId: line.productId,
    variantId: line.variantId ?? undefined,
    quantity: line.quantity,
  }))

  return [...accepted, ...rejected]
}

/**
 * Register a server-built proposal and return it with its single-use identity.
 *
 * Called once per proposal, at the moment the API hands it to the browser.
 * Registering never touches a cart and never starts a payment.
 */
export function registerCartProposal(proposal: CartProposal, now?: number): CartProposal {
  const record = registerProposal({
    proposal,
    requestedItems: requestedLinesFromProposal(proposal),
    now,
  })
  return toPublicProposal(record)
}

export interface ApproveProposalOptions {
  /** Catalog re-reader. Injectable so approval is testable against a fixed catalog. */
  revalidate?: ProposalRevalidator
  /** Injectable clock. */
  now?: number
}

/**
 * Decide an approval request.
 *
 * Order of operations matters and is deliberate:
 * 1. claim synchronously — before any `await` — so a concurrent double
 *    approval cannot both succeed;
 * 2. re-read the catalog (never the client) for the requested lines;
 * 3. compare the rebuilt proposal with the one the shopper was shown;
 * 4. only then mark it approved, and hand the revalidated lines back.
 *
 * Nothing in this function writes to a cart. Applying the returned lines is
 * the storefront's job, and only after this call reports `APPROVED`.
 */
export async function approveProposal(
  proposalId: string,
  options: ApproveProposalOptions = {}
): Promise<ProposalDecisionResult> {
  const now = options.now ?? Date.now()

  const claim = claimProposal(proposalId, now)
  if (!claim.ok) {
    if (claim.status === "NOT_FOUND") return { status: "NOT_FOUND", id: proposalId }
    if (claim.status === "EXPIRED") return { status: "EXPIRED", record: claim.record }
    return { status: "ALREADY_PROCESSED", record: claim.record }
  }

  const record = claim.record
  const revalidate = options.revalidate ?? catalogRevalidator

  let outcome: RevalidationResult
  try {
    outcome = await revalidate(record.requestedItems.map((line) => ({ ...line })))
  } catch {
    outcome = {
      ok: false,
      code: "REVALIDATION_FAILED",
      message: "The catalog could not be read, so nothing was added.",
    }
  }

  if (!outcome.ok) {
    const invalid = finalizeInvalid(record.id, now, outcome.message)
    return { status: "UNAVAILABLE", record: invalid, reason: outcome.message }
  }

  // The catalog moved on — a price, the availability, or an accepted line's
  // stock. Nothing is applied: the shopper gets a fresh proposal (new id and
  // expiry) and has to confirm again.
  if (proposalDiffersFrom(record.snapshot, outcome.proposal)) {
    const reason = "Prices or availability changed since this proposal was created."
    const stale = finalizeInvalid(record.id, now, reason)
    const replacement = registerProposal({
      proposal: outcome.proposal,
      requestedItems: record.requestedItems,
      now,
    })
    return { status: "STALE", record: stale, proposal: toPublicProposal(replacement) }
  }

  const approved = finalizeApproved(record.id, now)
  return { status: "APPROVED", record: approved, proposal: toPublicProposal(approved) }
}

export interface RejectProposalOptions {
  /** Injectable clock. */
  now?: number
}

/**
 * Decline a proposal.
 *
 * A rejection is only a state transition — it never touches a cart, and a
 * declined proposal can never be approved afterwards.
 */
export function rejectProposal(
  proposalId: string,
  options: RejectProposalOptions = {}
): ProposalDecisionResult {
  const now = options.now ?? Date.now()

  const claim = claimProposal(proposalId, now)
  if (!claim.ok) {
    if (claim.status === "NOT_FOUND") return { status: "NOT_FOUND", id: proposalId }
    if (claim.status === "EXPIRED") return { status: "EXPIRED", record: claim.record }
    return { status: "ALREADY_PROCESSED", record: claim.record }
  }

  return { status: "REJECTED", record: finalizeRejected(claim.record.id, now) }
}

export interface DecisionRefusal {
  status: number
  code: string
  message: string
}

/**
 * Map an unsuccessful decision onto an HTTP refusal, or `null` when the
 * decision succeeded (`APPROVED`, `STALE` or `REJECTED`).
 *
 * Kept in the library rather than the route so the mapping is unit-testable
 * and identical for both endpoints.
 */
export function refusalFor(result: ProposalDecisionResult): DecisionRefusal | null {
  switch (result.status) {
    case "NOT_FOUND":
      return {
        status: 404,
        code: "PROPOSAL_NOT_FOUND",
        message: "That proposal is no longer available. Ask the assistant to prepare a new one.",
      }
    case "EXPIRED":
      return {
        status: 410,
        code: "PROPOSAL_EXPIRED",
        message: "That proposal expired. Ask the assistant to prepare a new one.",
      }
    case "ALREADY_PROCESSED":
      return {
        status: 409,
        code: "PROPOSAL_ALREADY_PROCESSED",
        message: "That proposal has already been handled.",
      }
    case "UNAVAILABLE":
      return { status: 409, code: "CART_PROPOSAL_UNAVAILABLE", message: result.reason }
    default:
      return null
  }
}

/**
 * The browser-facing approval payload. Only reached for an applied proposal or
 * one that was superseded by newer catalog data.
 */
export function toApprovalDecision(
  result: Extract<ProposalDecisionResult, { status: "APPROVED" | "STALE" }>
): CartApprovalDecision {
  const decidedAt = result.record.decidedAt ?? result.record.createdAt

  if (result.status === "APPROVED") {
    return {
      status: "APPROVED",
      proposalId: result.record.id,
      decidedAt,
      proposal: result.proposal,
    }
  }

  return {
    status: "STALE",
    proposalId: result.record.id,
    decidedAt,
    reason: result.record.reason ?? "Prices or availability changed.",
    proposal: result.proposal,
  }
}

/** The browser-facing rejection payload. */
export function toRejectionResult(record: ProposalAuditRecord): CartRejectionResult {
  return {
    status: "REJECTED",
    proposalId: record.id,
    decidedAt: record.decidedAt ?? record.createdAt,
  }
}
