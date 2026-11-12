import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db/prisma"
import { syncOrdersToDatabase } from "@/lib/db/sync-orders"
import type { Prisma } from "@prisma/client"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim().toLowerCase() || ""
    const status = searchParams.get("status") || ""
    const carrier = searchParams.get("carrier") || ""

    // Auto-sync real initial orders from file if database order count is 0
    const count = await prisma.order.count()
    if (count === 0) {
      await syncOrdersToDatabase()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (status) {
      where.status = status.toUpperCase()
    }

    if (carrier) {
      where.carrier = { contains: carrier, mode: "insensitive" }
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { trackingNumber: { contains: search, mode: "insensitive" } },
      ]
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({
      success: true,
      orders,
      total: orders.length,
    })
  } catch (error) {
    console.error("Failed to fetch admin orders:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders from database" },
      { status: 500 }
    )
  }
}

// Bulk Batch Operations (e.g. bulk status update, bulk carrier assignment, bulk export)
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { orderIds, status, carrier, actionNote, returnReason, refundStatus } = body

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please select at least one order" },
        { status: 400 }
      )
    }

    const updateData: {
      status?: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED"
      carrier?: string
    } = {}

    if (status) {
      const s = status.toUpperCase()
      if (["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].includes(s)) {
        updateData.status = s as "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED"
      }
    }

    if (carrier) {
      updateData.carrier = carrier
    }

    // Process each order with audit log entry
    for (const id of orderIds) {
      const order = await prisma.order.findUnique({ where: { id } })
      if (!order) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingBilling = (order.billingAddress as any) || {}
      const existingAudit = existingBilling._audit || { notes: [] }
      const existingNotes = Array.isArray(existingAudit.notes) ? existingAudit.notes : []

      if (actionNote || status || carrier) {
        existingNotes.push({
          id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          author: "Balaganesh (Admin)",
          text:
            actionNote ||
            `Bulk update: ${status ? `Status changed to ${status}` : ""} ${carrier ? `Carrier assigned: ${carrier}` : ""}`.trim(),
          createdAt: new Date().toISOString(),
          type: "audit",
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newBilling: any = {
        ...existingBilling,
        _audit: {
          ...existingAudit,
          notes: existingNotes,
          ...(returnReason !== undefined && { returnReason }),
          ...(refundStatus !== undefined && { refundStatus }),
        },
      }

      await prisma.order.update({
        where: { id },
        data: {
          ...updateData,
          billingAddress: newBilling as Prisma.InputJsonValue,
        },
      })
    }

    try {
      revalidatePath("/account/orders")
      revalidatePath("/admin/orders")
    } catch (e) {
      console.warn("revalidatePath error:", e)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${orderIds.length} orders in database`,
      count: orderIds.length,
    })
  } catch (error) {
    console.error("Bulk orders update error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to perform bulk orders update" },
      { status: 500 }
    )
  }
}

