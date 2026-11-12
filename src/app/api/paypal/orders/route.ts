import { NextResponse } from "next/server"

import { orderRepository } from "@/lib/repositories"
import { createPaypalCheckout, getCheckoutRecord } from "@/lib/paypal"
import { checkoutRefSchema, paypalCreateOrderRequestSchema } from "@/lib/validators"
import type {
  ApiError as ApiErrorBody,
  ApiResponse,
  PaypalOrderLookup,
  PaypalOrderResponse,
} from "@/types"

// Talks to PayPal and reads the server-side catalog, so it must run on Node.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
 * Create a PayPal order for the current cart.
 *
 * The body carries product ids, variant ids and quantities only. Every price,
 * name and stock figure is re-read from the server-side catalog here, so a
 * browser that edits the cart payload cannot change what PayPal is asked for.
 *
 * This endpoint never writes to the shopper's cart and never marks anything as
 * paid — the shopper still has to approve inside the PayPal window, and only
 * /api/paypal/capture can produce a paid order.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "Request body must be valid JSON.")
  }

  const parsed = paypalCreateOrderRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "Invalid checkout request.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    )
  }

  const result = await createPaypalCheckout({
    items: parsed.data.items,
    customerEmail: parsed.data.customerEmail,
    customerName: parsed.data.customerName,
    userId: parsed.data.userId,
    // The address is descriptive only: it can never influence the total that
    // PayPal is asked to charge, which is always rebuilt from the catalog.
    shippingAddress: parsed.data.shippingAddress
      ? {
          id: "paypal-shipping",
          type: "shipping",
          ...parsed.data.shippingAddress,
          isDefault: false,
        }
      : undefined,
  })
  if (!result.ok) {
    return errorResponse(result.status, result.code, result.message)
  }

  const response: ApiResponse<PaypalOrderResponse> = { data: result.response }
  return NextResponse.json(response)
}

/**
 * Read back a checkout for the order confirmation page.
 *
 * The server-issued reference is a UUID, so it is unguessable; it acts as the
 * confirmation-link capability, exactly like an order number in an email.
 * The order itself is only ever returned when the capture was verified.
 */
export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get("ref") ?? ""

  const parsed = checkoutRefSchema.safeParse(ref)
  if (!parsed.success) {
    return errorResponse(400, "INVALID_REQUEST", "A valid checkout reference is required.")
  }

  const record = getCheckoutRecord(parsed.data)
  if (!record) {
    const existingOrder = await orderRepository.getById(parsed.data)
    if (existingOrder) {
      const data: PaypalOrderLookup = {
        checkoutRef: existingOrder.id,
        status: "COMPLETED",
        amounts: {
          subtotal: existingOrder.subtotal,
          shipping: existingOrder.shipping,
          tax: existingOrder.tax,
          total: existingOrder.total,
          currency: existingOrder.currency,
        },
        createdAt: existingOrder.createdAt,
        expiresAt: existingOrder.updatedAt,
        captureId: existingOrder.paymentReference,
        order: existingOrder,
      }
      return NextResponse.json({ data })
    }
    return errorResponse(404, "CHECKOUT_NOT_FOUND", "This checkout could not be found.")
  }

  const data: PaypalOrderLookup = {
    checkoutRef: record.reference,
    status: record.status,
    amounts: record.amounts,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  }

  if (record.status === "COMPLETED") {
    if (record.captureId) data.captureId = record.captureId
    if (record.order) data.order = record.order
  }

  const response: ApiResponse<PaypalOrderLookup> = { data }
  return NextResponse.json(response)
}
