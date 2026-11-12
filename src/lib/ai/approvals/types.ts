import type { CartProposal } from "@/types"

/**
 * Lifecycle states a registered cart proposal can be in.
 *
 * `PENDING` is the only state from which a decision can be taken; the other
 * three are terminal.
 */
export type ProposalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"

/**
 * What ultimately happened to the proposal. Recorded separately from
 * {@link ProposalStatus} because a proposal can be claimed and then fail
 * revalidation — the audit trail needs to say why, not just that it ended.
 */
export type ProposalOutcome =
  | "PENDING"
  | "APPLIED"
  | "REJECTED_BY_USER"
  | "EXPIRED"
  | "VALIDATION_FAILED"

/**
 * A line the model asked for, after the `propose_cart_action` schema accepted
 * it. Kept alongside the snapshot so approval can re-read the catalog for
 * exactly what was requested — including lines that were rejected at
 * proposal time, so revalidation reproduces the same proposal.
 */
export interface ProposalRequestLine {
  productId: string
  variantId?: string
  quantity: number
}

/**
 * The full audit record for one proposal.
 *
 * This is the only server-side record of a proposal: it carries no payment
 * data and no secrets. `snapshot` is exactly what the shopper was shown, and
 * is what a revalidated proposal is compared against.
 */
export interface ProposalAuditRecord {
  id: string
  /** ISO timestamp the proposal was registered. */
  createdAt: string
  /** ISO timestamp after which approval is refused. */
  expiresAt: string
  status: ProposalStatus
  outcome: ProposalOutcome
  /** ISO timestamp of the approve/reject decision, or null while pending. */
  decidedAt: string | null
  /** Validation or decision reason, when there is one. */
  reason?: string
  /** The model-requested lines, server-validated. */
  requestedItems: ProposalRequestLine[]
  /** The proposal the shopper reviewed. */
  snapshot: CartProposal
}

/** Result of looking a proposal up, so callers never see `undefined`. */
export type ProposalLookup =
  | { found: true; record: ProposalAuditRecord }
  | { found: false; id: string }

/**
 * Domain-level result of an approve/reject attempt. The API routes map these
 * onto HTTP status codes; tests assert on them directly.
 */
export type ProposalDecisionResult =
  | { status: "APPROVED"; record: ProposalAuditRecord; proposal: CartProposal }
  | { status: "REJECTED"; record: ProposalAuditRecord }
  | { status: "EXPIRED"; record: ProposalAuditRecord }
  | { status: "ALREADY_PROCESSED"; record: ProposalAuditRecord }
  | { status: "NOT_FOUND"; id: string }
  | { status: "STALE"; record: ProposalAuditRecord; proposal: CartProposal }
  | { status: "UNAVAILABLE"; record: ProposalAuditRecord; reason: string }

/** Outcome of re-reading the catalog for a proposal's requested lines. */
export type RevalidationResult =
  | { ok: true; proposal: CartProposal }
  | { ok: false; code: string; message: string }

/**
 * Re-reads the catalog for a proposal. Injectable so the lifecycle can be
 * exercised without a mutable catalog; the default reads the real catalog
 * through the `propose_cart_action` registry entry.
 */
export type ProposalRevalidator = (items: ProposalRequestLine[]) => Promise<RevalidationResult>
