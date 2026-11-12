import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncPromotionsData } from "@/lib/db/sync-promotions"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const flashCount = await prisma.flashSale.count()
    if (flashCount === 0) {
      await syncPromotionsData()
    }

    const now = new Date()

    // 1. Find the best active flash sale
    const activeFlashSale = await prisma.flashSale.findFirst({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { startsAt: "desc" },
    })

    // 2. Find the highest priority active promotional banner
    const activeBanner = await prisma.promotionalBanner.findFirst({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [
          { endsAt: null },
          { endsAt: { gte: now } },
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    })

    // 3. Find featured active coupons for shoppers
    const featuredCoupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: now } },
        ],
      },
      select: {
        code: true,
        title: true,
        description: true,
        discountType: true,
        discountValue: true,
        minOrderValue: true,
        firstPurchaseOnly: true,
        targetScenario: true,
        targetCategorySlug: true,
        expiresAt: true,
      },
      take: 4,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      flashSale: activeFlashSale,
      banner: activeBanner,
      featuredCoupons,
    })
  } catch (error) {
    console.error("Failed to fetch active promotions:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch promotions" },
      { status: 500 }
    )
  }
}
