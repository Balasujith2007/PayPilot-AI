import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncBillingAndInvoices } from "@/lib/db/sync-billing"
import type { SettlementStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const gateway = searchParams.get("gateway")
    const status = searchParams.get("status")
    const search = searchParams.get("search")?.trim().toLowerCase()

    const count = await prisma.paymentSettlement.count()
    if (count === 0) {
      await syncBillingAndInvoices()
    }

    const where: Record<string, unknown> = {}
    if (gateway && gateway !== "ALL") {
      where.gateway = gateway
    }
    if (status && status !== "ALL") {
      where.status = status as SettlementStatus
    }
    if (search) {
      where.OR = [
        { gatewayTxnId: { contains: search, mode: "insensitive" } },
        { orderNumber: { contains: search, mode: "insensitive" } },
        { bankReference: { contains: search, mode: "insensitive" } },
      ]
    }

    const settlements = await prisma.paymentSettlement.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    // Compute metrics
    let totalCaptured = 0
    let totalFees = 0
    let totalTaxOnFees = 0
    let totalNetPayout = 0
    let pendingSettlement = 0
    let refundedVolume = 0

    for (const s of settlements) {
      if (s.status === "RECONCILED" || s.status === "CAPTURED") {
        totalCaptured += s.amount
        totalFees += s.fee
        totalTaxOnFees += s.taxOnFee
        totalNetPayout += s.netPayout
        if (s.status === "CAPTURED") {
          pendingSettlement += s.netPayout
        }
      } else if (s.status === "REFUNDED") {
        refundedVolume += s.amount
      }
    }

    return NextResponse.json({
      settlements,
      metrics: {
        totalCaptured,
        totalFees,
        totalTaxOnFees,
        totalNetPayout,
        pendingSettlement,
        refundedVolume,
        totalTransactions: settlements.length,
      },
    })
  } catch (error) {
    console.error("Failed to fetch settlements:", error)
    return NextResponse.json(
      { error: "Failed to fetch settlements", details: String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { ids, status, bankReference } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 })
    }

    const updated = await prisma.paymentSettlement.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        ...(status && { status }),
        ...(bankReference && { bankReference }),
        ...(status === "RECONCILED" && { settledAt: new Date() }),
      },
    })

    return NextResponse.json({ success: true, count: updated.count })
  } catch (error) {
    console.error("Failed to update settlement:", error)
    return NextResponse.json(
      { error: "Failed to update settlement", details: String(error) },
      { status: 500 }
    )
  }
}

