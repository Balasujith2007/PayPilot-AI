import { NextResponse } from "next/server"

import { capturePaypalCheckout } from "@/lib/paypal"
import { paypalCaptureRequestSchema } from "@/lib/validators"
import type { ApiError as ApiErrorBody, ApiResponse, PaypalCaptureResponse } from "@/types"

// Uses the server-side client secret, so it must run on Node.
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
 * Capture a PayPal order and verify the payment.
 *
 * Order of trust:
 *   1. the checkout reference must exist and belong to this PayPal order,
 *   2. PayPal's own capture response must report COMPLETED,
 *   3. its currency and amount must equal the totals this server calculated.
 *
 * Only then is an order marked paid. A client that simply claims "approved"
 * gets nothing: the amount comes from the stored checkout, never the request.
 * Replays are answered from the stored record without calling PayPal again, and
 * a concurrent duplicate is rejected instead of double-capturing.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "Request body must be valid JSON.")
  }

  const parsed = paypalCaptureRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "Invalid capture request.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    )
  }

  const result = await capturePaypalCheckout(parsed.data)
  if (!result.ok) {
    return errorResponse(result.status, result.code, result.message)
  }

  const response: ApiResponse<PaypalCaptureResponse> = { data: result.response }
  return NextResponse.json(response)
}
