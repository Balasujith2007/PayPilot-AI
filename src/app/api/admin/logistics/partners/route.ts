import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncLogisticsData } from "@/lib/db/sync-logistics"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const count = await prisma.logisticsPartner.count()
    if (count === 0) {
      await syncLogisticsData()
    }

    const partners = await prisma.logisticsPartner.findMany({
      orderBy: { successRate: "desc" },
    })

    return NextResponse.json({ partners })
  } catch (error) {
    console.error("Failed to fetch partners:", error)
    return NextResponse.json(
      { error: "Failed to fetch partners", details: String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, isActive, rating, trackingUrlTemplate } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const partner = await prisma.logisticsPartner.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(rating !== undefined && { rating }),
        ...(trackingUrlTemplate !== undefined && { trackingUrlTemplate }),
      },
    })

    return NextResponse.json({ partner, success: true })
  } catch (error) {
    console.error("Failed to update partner:", error)
    return NextResponse.json(
      { error: "Failed to update partner", details: String(error) },
      { status: 500 }
    )
  }
}

