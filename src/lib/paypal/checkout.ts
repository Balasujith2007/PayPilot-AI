import { computeCartTotals, stockFor } from "@/lib/ai/tools/shared"
import { siteConfig } from "@/lib/config"
import { orderRepository, productRepository } from "@/lib/repositories"
import { PLACEHOLDER_IMAGE } from "@/lib/constants"
import { MAX_CHECKOUT_QUANTITY } from "@/lib/validators"
import type {
  Address,
  Order,
  PaypalCaptureResponse,
  PaypalCheckoutAmounts,
  PaypalCheckoutLine,
  PaypalCheckoutLineInput,
  PaypalOrderResponse,
} from "@/types"

import {
  centsToDecimalString,
  createPaypalClient,
  PaypalApiError,
  type PaypalClient,
  type PaypalOrder,
  type PaypalPurchaseUnitInput,
} from "./client"
import { readPaypalConfig } from "./config"
import {
  attachPaypalOrder,
  claimCapture,
  createCheckoutRecord,
  getCheckoutRecord,
  isCheckoutExpired,
  markCaptured,
  markExpired,
  markFailed,
  releaseCapture,
  type PaypalCheckoutRecord,
} from "./checkout-store"

const NOT_CONFIGURED_MESSAGE =
  "PayPal is not configured on this server. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable checkout."

export type CheckoutErrorCode =
  | "PAYPAL_NOT_CONFIGURED"
  | "EMPTY_CART"
  | "INVALID_QUANTITY"
  | "PRODUCT_NOT_FOUND"
  | "VARIANT_NOT_FOUND"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_STOCK"
  | "CURRENCY_MISMATCH"
  | "CATALOG_UNAVAILABLE"
  | "PAYPAL_UNAVAILABLE"
  | "PAYPAL_ORDER_REJECTED"
  | "CHECKOUT_NOT_FOUND"
  | "CHECKOUT_MISMATCH"
  | "CHECKOUT_EXPIRED"
  | "CHECKOUT_FAILED"
  | "CAPTURE_IN_PROGRESS"
  | "PAYMENT_VERIFICATION_FAILED"

export interface CheckoutFailure {
  ok: false
  code: CheckoutErrorCode
  message: string
  /** HTTP status the route should use. */
  status: number
}

export type CheckoutBuildResult =
  | { ok: true; lines: PaypalCheckoutLine[]; amounts: PaypalCheckoutAmounts }
  | CheckoutFailure

export type CreateCheckoutResult =
  | { ok: true; response: PaypalOrderResponse }
  | CheckoutFailure

export type CaptureCheckoutResult =
  | { ok: true; response: PaypalCaptureResponse }
  | CheckoutFailure

export interface PaypalCheckoutDeps {
  /** Injected in tests; production builds a client from the environment. */
  client?: PaypalClient
  fetchImpl?: typeof fetch
  now?: number
}

function failure(
  code: CheckoutErrorCode,
  status: number,
  message: string
): CheckoutFailure {
  return { ok: false, code, status, message }
}

function resolveClient(
  deps: PaypalCheckoutDeps
): { ok: true; client: PaypalClient } | CheckoutFailure {
  if (deps.client) return { ok: true, client: deps.client }

  const config = readPaypalConfig()
  if (!config.ok) return failure("PAYPAL_NOT_CONFIGURED", 503, NOT_CONFIGURED_MESSAGE)

  return {
    ok: true,
    client: createPaypalClient(config.config, { fetchImpl: deps.fetchImpl }),
  }
}

/**
 * Rebuild a checkout from the server-side catalog.
 *
 * The browser supplies product ids, variant ids and quantities only. Every
 * price, name, sku, image and stock figure below comes from the repository, so
 * a manipulated client cannot influence what the shopper is charged.
 */
export async function buildCheckout(
  requested: PaypalCheckoutLineInput[]
): Promise<CheckoutBuildResult> {
  if (requested.length === 0) {
    return failure("EMPTY_CART", 400, "There is nothing to check out.")
  }

  // Quantities are re-checked here, not just in the request schema: this
  // function is the last gate before money is involved, and repeated variants
  // can sum above the per-line cap the browser sent.
  for (const line of requested) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      return failure("INVALID_QUANTITY", 400, "Quantities must be whole numbers of at least 1.")
    }
  }

  // The cart merges by variant, but a hand-made request could repeat a variant.
  // Quantities are summed first so the stock check sees the real total.
  const wanted = new Map<string, PaypalCheckoutLineInput>()
  for (const line of requested) {
    const existing = wanted.get(line.variantId)
    if (existing) {
      existing.quantity += line.quantity
    } else {
      wanted.set(line.variantId, { ...line })
    }
  }

  for (const line of wanted.values()) {
    if (line.quantity > MAX_CHECKOUT_QUANTITY) {
      return failure(
        "INVALID_QUANTITY",
        400,
        `At most ${MAX_CHECKOUT_QUANTITY} units of one option can be ordered.`
      )
    }
  }

  const lines: PaypalCheckoutLine[] = []
  let currency: string | null = null

  for (const line of wanted.values()) {
    let product
    try {
      product = await productRepository.getById(line.productId)
    } catch {
      return failure(
        "CATALOG_UNAVAILABLE",
        502,
        "The product catalog could not be read, so nothing was charged."
      )
    }

    if (!product) {
      return failure("PRODUCT_NOT_FOUND", 409, `Product ${line.productId} is no longer available.`)
    }

    const variant = product.variants.find((candidate) => candidate.id === line.variantId)
    if (!variant) {
      return failure(
        "VARIANT_NOT_FOUND",
        409,
        `The selected option for ${product.name} is no longer available.`
      )
    }

    const lineCurrency = variant.currency || siteConfig.currency
    if (lineCurrency !== siteConfig.currency) {
      return failure(
        "CURRENCY_MISMATCH",
        409,
        `This store only charges in ${siteConfig.currency}.`
      )
    }
    currency = lineCurrency

    const available = stockFor(variant)
    if (available <= 0) {
      return failure("OUT_OF_STOCK", 409, `${product.name} is out of stock.`)
    }
    if (line.quantity > available) {
      return failure(
        "INSUFFICIENT_STOCK",
        409,
        `Only ${available} of ${product.name} remain in stock.`
      )
    }

    const image = variant.images[0] ?? product.images[0] ?? {
      url: PLACEHOLDER_IMAGE,
      alt: product.name,
    }

    lines.push({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantName: variant.name,
      sku: variant.sku,
      image,
      unitPrice: variant.price,
      quantity: line.quantity,
      lineTotal: variant.price * line.quantity,
    })
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
  const totals = computeCartTotals(subtotal)

  return {
    ok: true,
    lines,
    amounts: { ...totals, currency: currency ?? siteConfig.currency },
  }
}

/** Convert a stored checkout into the purchase unit PayPal expects. */
function toPurchaseUnit(record: PaypalCheckoutRecord): PaypalPurchaseUnitInput {
  const { amounts, currency } = record

  return {
    referenceId: record.reference,
    currency,
    value: centsToDecimalString(amounts.total),
    breakdown: {
      itemTotal: centsToDecimalString(amounts.subtotal),
      shipping: centsToDecimalString(amounts.shipping),
      taxTotal: centsToDecimalString(amounts.tax),
    },
    items: record.lines.map((line) => ({
      // PayPal caps item names at 127 characters.
      name: `${line.name}${line.variantName ? ` — ${line.variantName}` : ""}`.slice(0, 127),
      sku: line.sku,
      quantity: String(line.quantity),
      unitAmount: centsToDecimalString(line.unitPrice),
      currency,
    })),
  }
}

function orderNumberFor(now: number, reference: string): string {
  return `PP-${now.toString(36).toUpperCase()}-${reference.slice(-6).toUpperCase()}`
}

function shippingAddressFor(record: PaypalCheckoutRecord): Address {
  return (
    record.shippingAddress ?? {
      id: "paypal-shipping",
      type: "shipping",
      firstName: "",
      lastName: "",
      line1: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      isDefault: false,
    }
  )
}

/**
 * Build a paid order from a verified capture.
 *
 * Every monetary value is copied from the stored checkout, which was itself
 * calculated from the catalog — never from the browser or from PayPal's echo.
 */
function buildOrder(record: PaypalCheckoutRecord, captureId: string, now: number): Order {
  const isoTimestamp = new Date(now).toISOString()

  return {
    id: record.reference,
    orderNumber: orderNumberFor(now, record.reference),
    items: record.lines.map((line) => ({
      id: line.variantId,
      productId: line.productId,
      variantId: line.variantId,
      name: line.name,
      variantName: line.variantName,
      sku: line.sku,
      image: line.image,
      price: line.unitPrice,
      quantity: line.quantity,
      total: line.lineTotal,
    })),
    status: "processing",
    paymentStatus: "captured",
    subtotal: record.amounts.subtotal,
    tax: record.amounts.tax,
    shipping: record.amounts.shipping,
    total: record.amounts.total,
    currency: record.currency,
    shippingAddress: shippingAddressFor(record),
    customerEmail: record.customerEmail ?? "",
    customerName: record.customerName ?? "",
    userId: record.userId,
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    paymentMethod: "paypal",
    paymentReference: captureId,
    paypalOrderId: record.paypalOrderId ?? undefined,
    completedAt: isoTimestamp,
  }
}

/**
 * Create a PayPal order for the current cart.
 *
 * Nothing is written to the user's cart or to an order here: the shopper still
 * has to approve inside the PayPal window, and only the capture endpoint can
 * turn an approval into a paid order.
 */
export async function createPaypalCheckout(
  input: {
    items: PaypalCheckoutLineInput[]
    customerEmail?: string
    customerName?: string
    userId?: string
    shippingAddress?: Address
  },
  deps: PaypalCheckoutDeps = {}
): Promise<CreateCheckoutResult> {
  const resolved = resolveClient(deps)
  if (!resolved.ok) return resolved
  const client = resolved.client

  const build = await buildCheckout(input.items)
  if (!build.ok) return build

  const now = deps.now ?? Date.now()
  const record = createCheckoutRecord({
    lines: build.lines,
    amounts: build.amounts,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    userId: input.userId,
    shippingAddress: input.shippingAddress,
    now,
  })

  let paypalOrderId: string
  try {
    const order = await client.createOrder(toPurchaseUnit(record))
    if (order.status !== "CREATED") {
      markFailed(record.reference, `PayPal returned order status ${order.status}.`)
      return failure(
        "PAYPAL_ORDER_REJECTED",
        502,
        "PayPal refused to open this order. Nothing was charged."
      )
    }
    paypalOrderId = order.id
  } catch (error) {
    const message =
      error instanceof PaypalApiError
        ? error.message
        : "The payment provider could not be reached."
    markFailed(record.reference, message)
    return failure("PAYPAL_UNAVAILABLE", 502, message)
  }

  attachPaypalOrder(record.reference, paypalOrderId)

  return {
    ok: true,
    response: {
      checkoutRef: record.reference,
      paypalOrderId,
      amounts: record.amounts,
      expiresAt: record.expiresAt,
    },
  }
}

function verificationFailure(
  record: PaypalCheckoutRecord,
  reason: string
): CheckoutFailure {
  markFailed(record.reference, reason)
  return failure("PAYMENT_VERIFICATION_FAILED", 409, reason)
}

/**
 * Capture and verify a PayPal order.
 *
 * The capture is only accepted when PayPal reports a completed capture whose
 * currency and amount match the totals this server calculated when the order
 * was created. Anything else leaves the checkout un-paid.
 */
export async function capturePaypalCheckout(
  input: { checkoutRef: string; paypalOrderId: string },
  deps: PaypalCheckoutDeps = {}
): Promise<CaptureCheckoutResult> {
  const resolved = resolveClient(deps)
  if (!resolved.ok) return resolved
  const client = resolved.client

  const record = getCheckoutRecord(input.checkoutRef)
  if (!record) {
    const existingOrder = await orderRepository.getById(input.checkoutRef)
    if (existingOrder && existingOrder.paypalOrderId === input.paypalOrderId) {
      return {
        ok: true,
        response: {
          status: "COMPLETED",
          checkoutRef: existingOrder.id,
          paypalOrderId: input.paypalOrderId,
          captureId: existingOrder.paymentReference,
          order: existingOrder,
        },
      }
    }
    return failure(
      "CHECKOUT_NOT_FOUND",
      404,
      "This checkout could not be found. Start checkout again."
    )
  }

  if (record.paypalOrderId !== input.paypalOrderId) {
    return failure(
      "CHECKOUT_MISMATCH",
      409,
      "That PayPal order does not belong to this checkout."
    )
  }

  // Idempotent replay: the same capture attempt always returns the same answer
  // and never calls PayPal a second time.
  if (record.status === "COMPLETED") {
    return {
      ok: true,
      response: {
        status: "COMPLETED",
        checkoutRef: record.reference,
        paypalOrderId: input.paypalOrderId,
        captureId: record.captureId,
        order: record.order,
      },
    }
  }

  if (record.status === "FAILED") {
    return failure(
      "CHECKOUT_FAILED",
      409,
      record.failureReason ?? "This checkout can no longer be captured."
    )
  }

  const now = deps.now ?? Date.now()
  if (isCheckoutExpired(record, now)) {
    markExpired(record.reference)
    return failure(
      "CHECKOUT_EXPIRED",
      410,
      "This checkout expired before the payment was confirmed. Nothing was charged."
    )
  }

  const claim = claimCapture(input.paypalOrderId)
  if (!claim.ok) {
    return failure(
      "CAPTURE_IN_PROGRESS",
      409,
      "This payment is already being confirmed. Please wait a moment."
    )
  }

  try {
    const order = await captureWithRetry(client, input.paypalOrderId)

    if (order.status !== "COMPLETED") {
      return verificationFailure(
        record,
        `PayPal reported the payment as ${order.status}. Nothing was charged.`
      )
    }

    const unit =
      order.purchase_units?.find((candidate) => candidate.reference_id === record.reference) ??
      order.purchase_units?.[0]
    const capture = unit?.payments?.captures?.find((candidate) => candidate.status === "COMPLETED")

    if (!capture) {
      return verificationFailure(
        record,
        "PayPal did not confirm a completed capture. Nothing was charged."
      )
    }

    if (!capture.amount) {
      return verificationFailure(
        record,
        "PayPal did not return a captured amount. Nothing was charged."
      )
    }

    if (capture.amount.currency_code !== record.currency) {
      return verificationFailure(
        record,
        `PayPal settled in ${capture.amount.currency_code}, but this checkout is in ${record.currency}.`
      )
    }

    const expected = centsToDecimalString(record.amounts.total)
    if (capture.amount.value !== expected) {
      return verificationFailure(
        record,
        `PayPal settled ${capture.amount.value} but this checkout totals ${expected}.`
      )
    }

    const paidOrder = buildOrder(record, capture.id, now)
    markCaptured(record.reference, { captureId: capture.id, order: paidOrder })
    await orderRepository.create(paidOrder)

    return {
      ok: true,
      response: {
        status: "COMPLETED",
        checkoutRef: record.reference,
        paypalOrderId: input.paypalOrderId,
        captureId: capture.id,
        order: paidOrder,
      },
    }
  } catch (error) {
    // Transport-level failure: the checkout stays PENDING so the shopper can
    // safely retry, and PayPal's idempotency key protects against a double
    // capture on that retry.
    const message =
      error instanceof PaypalApiError
        ? error.message
        : "The payment provider could not be reached."
    return failure("PAYPAL_UNAVAILABLE", 502, message)
  } finally {
    releaseCapture(input.paypalOrderId)
  }
}

/**
 * Capture, tolerating the one case where a retry is genuinely safe:
 * PayPal already captured the order on a previous attempt, in which case the
 * existing capture is fetched and verified instead of capturing again.
 */
async function captureWithRetry(
  client: PaypalClient,
  paypalOrderId: string
): Promise<PaypalOrder> {
  try {
    return await client.captureOrder(paypalOrderId)
  } catch (error) {
    if (error instanceof PaypalApiError && error.code === "ORDER_ALREADY_CAPTURED") {
      return client.getOrder(paypalOrderId)
    }
    throw error
  }
}
