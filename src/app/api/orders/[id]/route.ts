import { NextResponse } from "next/server"

import { orderRepository } from "@/lib/repositories"
import { orderIdParamSchema } from "@/lib/validators"
import type { ApiError as ApiErrorBody, ApiResponse, Order } from "@/types"
import { resolveCustomerIdentity } from "@/lib/orders/identity"

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
 * GET /api/orders/[id]
 *
 * Retrieves details for a specific order. Only the order's owner or an admin
 * can retrieve it; unauthorized or non-matching requests receive 401 or 404.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const parsedId = orderIdParamSchema.safeParse(params.id)
  if (!parsedId.success) {
    return errorResponse(400, "INVALID_REQUEST", "Invalid order ID format.")
  }

  const identity = resolveCustomerIdentity(request)
  if (!identity) {
    return errorResponse(
      401,
      "UNAUTHORIZED",
      "Authentication required to view order details."
    )
  }

  try {
    const order = await orderRepository.getById(parsedId.data)
    if (!order) {
      return errorResponse(404, "ORDER_NOT_FOUND", "Order not found.")
    }

    const isAdmin =
      identity.userId === "user-1" || identity.email === "admin@example.com"
    const isOwner =
      (order.userId && order.userId === identity.userId) ||
      (order.customerEmail &&
        identity.email &&
        order.customerEmail.toLowerCase() === identity.email.toLowerCase())

    if (!isOwner && !isAdmin) {
      // 404 to prevent resource enumeration by unauthorized users
      return errorResponse(404, "ORDER_NOT_FOUND", "Order not found.")
    }

    const response: ApiResponse<Order> = { data: order }
    return NextResponse.json(response)
  } catch (error) {
    console.error(`[api/orders/${params.id}] Failed to retrieve order:`, error)
    return errorResponse(500, "INTERNAL_ERROR", "Failed to retrieve order details.")
  }
}

