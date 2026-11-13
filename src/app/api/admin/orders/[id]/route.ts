import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db/prisma"
import type { Prisma } from "@prisma/client"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        user: true,
      },
    })

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, order })
  } catch (error) {
    console.error("Failed to fetch order:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch order" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      status,
      carrier,
      trackingNumber,
      paymentStatus,
      staffNote,
      returnReason,
      refundStatus,
      authorName = "Balaganesh (Admin)",
    } = body

    const existing = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const billing: any = (existing.billingAddress as any) || {}
    const audit = billing._audit || { notes: [] }
    const notes = Array.isArray(audit.notes) ? [...audit.notes] : []

    // If staff added a note or status changed, log in activity timeline
    if (staffNote) {
      notes.push({
        id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        author: authorName,
        text: staffNote,
        createdAt: new Date().toISOString(),
        type: "staff",
      })
    } else if (status && status !== existing.status) {
      notes.push({
        id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        author: authorName,
        text: `Order status advanced to ${status.toUpperCase()}`,
        createdAt: new Date().toISOString(),
        type: "status",
      })
    }

    if (carrier && carrier !== existing.carrier) {
      notes.push({
        id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        author: authorName,
        text: `Courier allocated: ${carrier} (AWB: ${trackingNumber || existing.trackingNumber || "Pending"})`,
        createdAt: new Date().toISOString(),
        type: "logistics",
      })
    }

    if (returnReason) {
      notes.push({
        id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        author: authorName,
        text: `Return / Cancellation logged: "${returnReason}". Refund: ${refundStatus || "PENDING"}`,
        createdAt: new Date().toISOString(),
        type: "cancellation",
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedBilling: any = {
      ...billing,
      _audit: {
        ...audit,
        notes,
        ...(returnReason !== undefined && { returnReason }),
        ...(refundStatus !== undefined && { refundStatus }),
      },
    }

    // Map status enum safely
    let mappedStatus: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED" | undefined
    if (status) {
      const s = status.toUpperCase()
      if (["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].includes(s)) {
        mappedStatus = s as "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED"
      }
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        ...(mappedStatus && { status: mappedStatus }),
        ...(carrier !== undefined && { carrier }),
        ...(trackingNumber !== undefined && { trackingNumber }),
        ...(paymentStatus && { paymentStatus: paymentStatus.toUpperCase() }),
        billingAddress: updatedBilling as Prisma.InputJsonValue,
      },
      include: {
        items: true,
      },
    })

    try {
      revalidatePath("/account/orders")
      revalidatePath(`/account/orders/${id}`)
      revalidatePath(`/orders/${id}`)
      revalidatePath("/admin/orders")
    } catch (e) {
      console.warn("revalidatePath error:", e)
    }

    return NextResponse.json({ success: true, order: updated })
  } catch (error) {
    console.error("Failed to update order fulfillment:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update order fulfillment" },
      { status: 500 }
    )
  }
}
