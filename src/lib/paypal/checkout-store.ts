import { randomUUID } from "node:crypto"

import { PAYPAL_CHECKOUT_TTL_MS } from "@/lib/validators"
import type {
  Address,
  Order,
  PaypalCheckoutAmounts,
  PaypalCheckoutLine,
  PaypalCheckoutStatus,
} from "@/types"

/**
 * Server-side record of one PayPal checkout attempt.
 *
 * This is the authority on what the shopper owes: `amounts` is calculated from
 * the catalog when the PayPal order is created and is never re-read from the
 * browser. The capture endpoint compares PayPal's response against it.
 */
export interface PaypalCheckoutRecord {
  /** Server-issued reference, e.g. `chk_<uuid>`. */
  reference: string
  status: PaypalCheckoutStatus
  currency: string
  /** All amounts are in cents. */
  amounts: PaypalCheckoutAmounts
  lines: PaypalCheckoutLine[]
  customerEmail?: string
  customerName?: string
  userId?: string
  shippingAddress?: Address
  /** Set once PayPal has issued an order id for this checkout. */
  paypalOrderId: string | null
  createdAt: string
  expiresAt: string
  captureId?: string
  capturedAt?: string
  failureReason?: string
  /** The paid order. Only ever populated by a verified capture. */
  order?: Order
}

export interface CreateCheckoutRecordInput {
  lines: PaypalCheckoutLine[]
  amounts: PaypalCheckoutAmounts
  customerEmail?: string
  customerName?: string
  userId?: string
  shippingAddress?: Address
  now?: number
  ttlMs?: number
}

/**
 * In-memory registry.
 *
 * LIMITATIONS — stated plainly, because this is not durable storage:
 *  - A process restart loses every pending checkout. The PayPal order itself
 *    still exists at PayPal, but this app can no longer verify it, so the
 *    shopper is asked to start checkout again (no money moves until capture).
 *  - Not safe under horizontal scaling: instance B cannot capture a checkout
 *    created by instance A.
 *  - Retention is bounded (see MAX_RECORDS / RECORD_RETENTION_MS).
 *
 * The project has no database (the catalog is JSON files), so inventing one
 * here would be a bigger, riskier change than the checkout needs. Moving to a
 * `paypal_checkout` table or Redis means replacing this file only.
 */
const records = new Map<string, PaypalCheckoutRecord>()
const referenceByOrderId = new Map<string, string>()
/** Guards against two capture attempts running concurrently. */
const capturesInFlight = new Set<string>()

/** Roughly a day of checkouts; oldest entries are evicted first. */
const MAX_RECORDS = 500
const RECORD_RETENTION_MS = 24 * 60 * 60 * 1000

function prune(now: number): void {
  for (const [reference, record] of records) {
    const created = Date.parse(record.createdAt)
    if (Number.isFinite(created) && now - created > RECORD_RETENTION_MS) {
      drop(reference)
    }
  }

  while (records.size > MAX_RECORDS) {
    const oldest = records.keys().next()
    if (oldest.done) break
    drop(oldest.value)
  }
}

function drop(reference: string): void {
  const record = records.get(reference)
  if (!record) return
  if (record.paypalOrderId) referenceByOrderId.delete(record.paypalOrderId)
  records.delete(reference)
}

export function createCheckoutRecord(
  input: CreateCheckoutRecordInput
): PaypalCheckoutRecord {
  const now = input.now ?? Date.now()
  const ttl = input.ttlMs ?? PAYPAL_CHECKOUT_TTL_MS
  prune(now)

  const record: PaypalCheckoutRecord = {
    reference: `chk_${randomUUID()}`,
    status: "PENDING",
    currency: input.amounts.currency,
    amounts: input.amounts,
    lines: input.lines.map((line) => ({ ...line })),
    paypalOrderId: null,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
  }

  if (input.customerEmail) record.customerEmail = input.customerEmail
  if (input.customerName) record.customerName = input.customerName
  if (input.userId) record.userId = input.userId
  if (input.shippingAddress) record.shippingAddress = input.shippingAddress

  records.set(record.reference, record)
  return record
}

export function getCheckoutRecord(reference: string): PaypalCheckoutRecord | undefined {
  return records.get(reference)
}

/** Link the PayPal order id PayPal issued to this checkout. */
export function attachPaypalOrder(
  reference: string,
  paypalOrderId: string
): PaypalCheckoutRecord | undefined {
  const record = records.get(reference)
  if (!record) return undefined
  record.paypalOrderId = paypalOrderId
  referenceByOrderId.set(paypalOrderId, reference)
  return record
}

/** Reverse lookup, used to prove a PayPal order belongs to this store. */
export function getCheckoutByPaypalOrderId(
  paypalOrderId: string
): PaypalCheckoutRecord | undefined {
  const reference = referenceByOrderId.get(paypalOrderId)
  return reference ? records.get(reference) : undefined
}

export function isCheckoutExpired(
  record: PaypalCheckoutRecord,
  now: number = Date.now()
): boolean {
  const expiresAt = Date.parse(record.expiresAt)
  return Number.isFinite(expiresAt) && now >= expiresAt
}

export type CaptureClaim = { ok: true } | { ok: false; reason: "IN_PROGRESS" }

/**
 * Atomically claim the right to capture one PayPal order.
 *
 * Runs synchronously before the caller's first `await`, so of two concurrent
 * capture requests exactly one proceeds and the other is told to wait — the
 * same technique the cart-approval registry uses.
 */
export function claimCapture(paypalOrderId: string): CaptureClaim {
  if (capturesInFlight.has(paypalOrderId)) {
    return { ok: false, reason: "IN_PROGRESS" }
  }
  capturesInFlight.add(paypalOrderId)
  return { ok: true }
}

export function releaseCapture(paypalOrderId: string): void {
  capturesInFlight.delete(paypalOrderId)
}

/**
 * Record a verified capture.
 *
 * Only ever called after PayPal's own response has been checked against the
 * stored amounts, so a paid order can never be produced from a client claim.
 */
export function markCaptured(
  reference: string,
  outcome: { captureId: string; order: Order; capturedAt?: string }
): PaypalCheckoutRecord | undefined {
  const record = records.get(reference)
  if (!record) return undefined
  record.status = "COMPLETED"
  record.captureId = outcome.captureId
  record.order = outcome.order
  record.capturedAt = outcome.capturedAt ?? new Date().toISOString()
  delete record.failureReason
  return record
}

export function markFailed(
  reference: string,
  reason: string
): PaypalCheckoutRecord | undefined {
  const record = records.get(reference)
  if (!record) return undefined
  record.status = "FAILED"
  record.failureReason = reason
  return record
}

export function markExpired(reference: string): PaypalCheckoutRecord | undefined {
  const record = records.get(reference)
  if (!record) return undefined
  record.status = "FAILED"
  record.failureReason = "This checkout expired before the payment was confirmed."
  return record
}

/** Test-only: empty the registry. */
export function resetPaypalCheckoutStore(): void {
  records.clear()
  referenceByOrderId.clear()
  capturesInFlight.clear()
}

/** Test-only introspection. */
export function listCheckoutRecords(): PaypalCheckoutRecord[] {
  return [...records.values()]
}
