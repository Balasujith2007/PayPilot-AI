import { NextResponse } from "next/server"

import { resolveCustomerIdentity } from "@/lib/orders/identity"
import { orderRepository } from "@/lib/repositories"
import { orderListQuerySchema } from "@/lib/validators"
import type { ApiError as ApiErrorBody, ApiResponse, Order, PaginatedResult } from "@/types"

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
 * GET /api/orders
 *
 * Returns paginated order history for the authenticated customer only.
 * Requires customer identity via headers (x-user-id, x-user-email, Authorization)
 * or query params (userId, email).
 */
export async function GET(request: Request) {
  const identity = resolveCustomerIdentity(request)
  if (!identity) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required to view orders.")
  }

  const url = new URL(request.url)
  const queryParams = {
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    email: url.searchParams.get("email") ?? undefined,
  }

  const parsed = orderListQuerySchema.safeParse(queryParams)
  if (!parsed.success) {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "Invalid order history query parameters.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    )
  }

  try {
    // If a specific userId was requested in query, ensure it matches the authenticated identity (unless admin)
    const isAdmin =
      identity.userId === "user-1" || identity.email === "admin@example.com"

    if (parsed.data.userId && !isAdmin && parsed.data.userId !== identity.userId) {
      return errorResponse(403, "FORBIDDEN", "You are not authorized to view orders for another user.")
    }

    if (parsed.data.email && !isAdmin && parsed.data.email.toLowerCase() !== identity.email?.toLowerCase()) {
      return errorResponse(403, "FORBIDDEN", "You are not authorized to view orders for another email.")
    }

    const filterTarget = identity.userId || identity.email

    const paginated = await orderRepository.list(filterTarget, {
      page: parsed.data.page,
      limit: parsed.data.limit,
    })

    const response: ApiResponse<PaginatedResult<Order>> = { data: paginated }
    return NextResponse.json(response)
  } catch (error) {
    console.error("[api/orders] Failed to fetch orders:", error)
    return errorResponse(500, "INTERNAL_ERROR", "Failed to retrieve order history.")
  }
}

