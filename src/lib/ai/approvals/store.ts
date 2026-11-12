import { randomUUID } from "node:crypto"

import { AGENT_PROPOSAL_TTL_MS } from "@/lib/validators"
import type { CartProposal } from "@/types"

import type { ProposalAuditRecord, ProposalLookup, ProposalRequestLine } from "./types"

/**
 * In-memory cart-proposal registry (Task 19).
 *
 * LIMITATIONS — read before trusting this.
 *
 * Records live in the Node process's memory only:
 * - a server restart or a redeploy forgets every pending proposal, so an
 *   already-displayed proposal becomes unapprovable (the UI reports it as
 *   expired/invalid and the shopper asks the assistant again);
 * - a second server instance cannot decide a proposal registered on the
 *   first, so approvals are not safe under horizontal scaling;
 * - the store is unbounded apart from the pruning below, so it is not a
 *   durable audit log.
 *
 * This project has no database: product data is a JSON file read through
 * `jsonProductRepository`. An in-process registry is therefore the smallest
 * mechanism that can satisfy the real requirements (server-issued id,
 * single-use, expiry, atomic claim) without introducing a storage layer that
 * does not exist anywhere else in the codebase. The production path is a
 * shared store (Redis or a `proposal` table) keyed by proposal id; the
 * lifecycle module is written so only this file would need to change.
 */
const records = new Map<string, ProposalAuditRecord>()

/**
 * Proposal ids currently owned by an in-flight decision.
 *
 * {@link claimProposal} adds to this set synchronously, and Node runs
 * synchronous code on one thread — so two concurrent approve requests can
 * never both observe an unclaimed PENDING proposal. The second one sees the
 * claim and is refused. This, rather than a database lock, is what makes a
 * proposal single-use here.
 */
const claims = new Set<string>()

/** Upper bound on retained records, so a long-lived process cannot grow forever. */
const MAX_RECORDS = 500

/** How long a finished record is retained past its expiry, only for the audit trail. */
const AUDIT_RETENTION_MS = 60 * 60 * 1000

export interface RegisterProposalInput {
  /** The proposal exactly as the shopper will see it (no identity fields). */
  proposal: CartProposal
  /** The server-validated lines the proposal was built from. */
  requestedItems: ProposalRequestLine[]
  /** Injectable clock, so expiry is testable without waiting. */
  now?: number
  /** Injectable TTL, defaulting to {@link AGENT_PROPOSAL_TTL_MS}. */
  ttlMs?: number
}

function cloneRecord(record: ProposalAuditRecord): ProposalAuditRecord {
  return {
    ...record,
    requestedItems: record.requestedItems.map((line) => ({ ...line })),
    snapshot: record.snapshot,
  }
}

/** Drop records that can no longer matter, so the map cannot leak. */
function prune(now: number): void {
  for (const [id, record] of records) {
    if (claims.has(id)) continue
    const expiresAt = Date.parse(record.expiresAt)
    if (!Number.isFinite(expiresAt)) continue
    if (now - expiresAt <= AUDIT_RETENTION_MS) continue
    records.delete(id)
  }

  if (records.size <= MAX_RECORDS) return

  // Last resort: evict the oldest finished records. A pending, unclaimed
  // proposal is never evicted while it can still be approved.
  const evictable = [...records.values()]
    .filter((record) => !claims.has(record.id) && record.status !== "PENDING")
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

  for (const record of evictable) {
    if (records.size <= MAX_RECORDS) break
    records.delete(record.id)
  }
}

/**
 * Register a freshly built proposal and issue its server-side identity.
 *
 * Registration has no side effects beyond this map: it never touches a cart,
 * never starts checkout and never takes a payment.
 */
export function registerProposal(input: RegisterProposalInput): ProposalAuditRecord {
  const now = input.now ?? Date.now()
  const ttl = input.ttlMs ?? AGENT_PROPOSAL_TTL_MS

  prune(now)

  const record: ProposalAuditRecord = {
    id: `prop_${randomUUID()}`,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
    status: "PENDING",
    outcome: "PENDING",
    decidedAt: null,
    requestedItems: input.requestedItems.map((line) => ({ ...line })),
    snapshot: input.proposal,
  }

  records.set(record.id, record)
  return record
}

/** Look a proposal up, without ever leaking `undefined` to a caller. */
export function getProposal(id: string): ProposalLookup {
  const record = records.get(id)
  return record ? { found: true, record: cloneRecord(record) } : { found: false, id }
}

/**
 * The whole audit trail, oldest first.
 *
 * Contains only proposal ids, timestamps, outcomes and catalog identities —
 * no secrets and nothing payment related. Intentionally not exposed over HTTP:
 * there is no authentication on the agent routes, so a public audit endpoint
 * would let anyone enumerate proposals.
 */
export function listProposalAuditRecords(): ProposalAuditRecord[] {
  return [...records.values()]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map(cloneRecord)
}

/** Test-only: forget every proposal and claim. */
export function resetProposalStore(): void {
  records.clear()
  claims.clear()
}

export type ClaimResult =
  | { ok: true; record: ProposalAuditRecord }
  | { ok: false; status: "NOT_FOUND"; id: string }
  | { ok: false; status: "EXPIRED" | "ALREADY_PROCESSED"; record: ProposalAuditRecord }

/**
 * Atomically move a PENDING proposal into "being decided".
 *
 * Everything here is synchronous, which is the whole point: the caller must
 * not `await` before calling this, or two concurrent approvals could both win.
 */
export function claimProposal(id: string, now: number = Date.now()): ClaimResult {
  const record = records.get(id)
  if (!record) return { ok: false, status: "NOT_FOUND", id }

  // Single-use: only a PENDING proposal may move. A terminal proposal is
  // refused before expiry is even considered, so a rejected proposal can
  // never be approved later, and an approval can never be replayed.
  if (record.status !== "PENDING") {
    return { ok: false, status: "ALREADY_PROCESSED", record }
  }

  const expiresAt = Date.parse(record.expiresAt)
  if (Number.isFinite(expiresAt) && now >= expiresAt) {
    record.status = "EXPIRED"
    record.outcome = "EXPIRED"
    record.decidedAt = new Date(now).toISOString()
    record.reason = "The proposal expired before it was approved."
    return { ok: false, status: "EXPIRED", record }
  }

  if (claims.has(id)) {
    return { ok: false, status: "ALREADY_PROCESSED", record }
  }

  claims.add(id)
  return { ok: true, record }
}

function finish(
  id: string,
  patch: {
    status: ProposalAuditRecord["status"]
    outcome: ProposalAuditRecord["outcome"]
    decidedAt: string
    reason?: string
  }
): ProposalAuditRecord {
  const record = records.get(id)
  if (!record) throw new Error(`Proposal ${id} is not registered.`)

  record.status = patch.status
  record.outcome = patch.outcome
  record.decidedAt = patch.decidedAt
  if (patch.reason !== undefined) record.reason = patch.reason

  claims.delete(id)
  return cloneRecord(record)
}

/** The proposal was revalidated and applied by the shopper. */
export function finalizeApproved(id: string, decidedAt: number): ProposalAuditRecord {
  return finish(id, {
    status: "APPROVED",
    outcome: "APPLIED",
    decidedAt: new Date(decidedAt).toISOString(),
  })
}

/** The shopper declined it. The cart is untouched. */
export function finalizeRejected(id: string, decidedAt: number): ProposalAuditRecord {
  return finish(id, {
    status: "REJECTED",
    outcome: "REJECTED_BY_USER",
    decidedAt: new Date(decidedAt).toISOString(),
    reason: "The shopper declined this proposal.",
  })
}

/**
 * The proposal was claimed but could not be applied: the catalog moved on, or
 * the lines are no longer orderable. It is terminal and can never be approved,
 * but the status is EXPIRED rather than a bespoke one because the lifecycle
 * only has four states — `outcome` (`VALIDATION_FAILED`) and `reason` carry
 * the detail.
 */
export function finalizeInvalid(id: string, decidedAt: number, reason: string): ProposalAuditRecord {
  return finish(id, {
    status: "EXPIRED",
    outcome: "VALIDATION_FAILED",
    decidedAt: new Date(decidedAt).toISOString(),
    reason,
  })
}

/**
 * The browser-facing view of a record: the proposal the shopper reviewed, plus
 * its server-issued identity. This is the only proposal shape a client sees.
 */
export function toPublicProposal(record: ProposalAuditRecord): CartProposal {
  return {
    ...record.snapshot,
    proposalId: record.id,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  }
}
