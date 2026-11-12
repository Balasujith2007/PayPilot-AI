import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncLogisticsData } from "@/lib/db/sync-logistics"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const count = await prisma.shippingRule.count()
    if (count === 0) {
      await syncLogisticsData()
    }

    const rules = await prisma.shippingRule.findMany({
      orderBy: { baseFee: "asc" },
    })

    return NextResponse.json({ rules })
  } catch (error) {
    console.error("Failed to fetch shipping rules:", error)
    return NextResponse.json(
      { error: "Failed to fetch shipping rules", details: String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, baseFee, freeThreshold, estimatedDaysMin, estimatedDaysMax, isActive } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const rule = await prisma.shippingRule.update({
      where: { id },
      data: {
        ...(baseFee !== undefined && { baseFee }),
        ...(freeThreshold !== undefined && { freeThreshold }),
        ...(estimatedDaysMin !== undefined && { estimatedDaysMin }),
        ...(estimatedDaysMax !== undefined && { estimatedDaysMax }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ rule, success: true })
  } catch (error) {
    console.error("Failed to update shipping rule:", error)
    return NextResponse.json(
      { error: "Failed to update shipping rule", details: String(error) },
      { status: 500 }
    )
  }
}

