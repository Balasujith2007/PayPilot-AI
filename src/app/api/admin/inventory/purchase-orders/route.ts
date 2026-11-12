import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export async function GET() {
  try {
    const purchaseOrders = await prisma.purchaseOrderDraft.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ purchaseOrders })
  } catch (error) {
    console.error("Failed to fetch purchase orders:", error)
    return NextResponse.json(
      { error: "Failed to fetch purchase orders", details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { supplierName, items, notes } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 })
    }

    const count = await prisma.purchaseOrderDraft.count()
    const poNumber = `PO-2026-${String(count + 101).padStart(4, "0")}`

    // Calculate totals
    const totalItems = items.reduce(
      (acc: number, it: { suggestedQuantity?: number; quantity?: number }) =>
        acc + (it.suggestedQuantity || it.quantity || 20),
      0
    )
    const totalCost = items.reduce(
      (acc: number, it: { totalCost?: number; unitCost?: number; quantity?: number; suggestedQuantity?: number }) =>
        acc + (it.totalCost || (it.unitCost || 50000) * (it.suggestedQuantity || it.quantity || 20)),
      0
    )

    const po = await prisma.purchaseOrderDraft.create({
      data: {
        poNumber,
        supplierName: supplierName || "Apex Garments & Electronics Supply Hub",
        status: "DRAFT",
        items,
        totalItems,
        totalCost,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
        notes: notes || "Restock order based on automated 30-day velocity forecast.",
      },
    })

    return NextResponse.json({ purchaseOrder: po, success: true }, { status: 201 })
  } catch (error) {
    console.error("Failed to create purchase order:", error)
    return NextResponse.json(
      { error: "Failed to create purchase order", details: String(error) },
      { status: 500 }
    )
  }
}

