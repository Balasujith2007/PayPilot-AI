import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncBillingAndInvoices } from "@/lib/db/sync-billing"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const redemptionsCount = await prisma.couponRedemption.count()
    if (redemptionsCount === 0) {
      await syncBillingAndInvoices()
    }

    const redemptions = await prisma.couponRedemption.findMany({
      orderBy: { createdAt: "desc" },
    })

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
    })

    let totalDiscountExpense = 0 // total money saved by users
    let totalGrossRevenue = 0 // total order value where coupon was used

    // Group by coupon code
    const statsByCode: Record<
      string,
      {
        code: string
        title: string
        discountType: string
        redemptionCount: number
        totalDiscountGiven: number
        totalOrderRevenue: number
        netRevenue: number
        roiMultiplier: number
        avgOrderValue: number
      }
    > = {}

    // Initialize coupon metadata
    for (const c of coupons) {
      statsByCode[c.code] = {
        code: c.code,
        title: c.title,
        discountType: c.discountType,
        redemptionCount: 0,
        totalDiscountGiven: 0,
        totalOrderRevenue: 0,
        netRevenue: 0,
        roiMultiplier: 0,
        avgOrderValue: 0,
      }
    }

    // Aggregate redemption data
    for (const r of redemptions) {
      totalDiscountExpense += r.discountAmount
      totalGrossRevenue += r.orderTotal

      if (!statsByCode[r.couponCode]) {
        statsByCode[r.couponCode] = {
          code: r.couponCode,
          title: r.couponCode === "FIRST500" ? "Flat ₹500 Welcome Voucher" : "10% Off Storewide",
          discountType: r.couponCode === "FIRST500" ? "fixed" : "percentage",
          redemptionCount: 0,
          totalDiscountGiven: 0,
          totalOrderRevenue: 0,
          netRevenue: 0,
          roiMultiplier: 0,
          avgOrderValue: 0,
        }
      }

      const item = statsByCode[r.couponCode]
      item.redemptionCount += 1
      item.totalDiscountGiven += r.discountAmount
      item.totalOrderRevenue += r.orderTotal
    }

    // Compute derived metrics (ROI = Net Revenue / Discount Given)
    const breakdown = Object.values(statsByCode).map((item) => {
      const net = Math.max(0, item.totalOrderRevenue - item.totalDiscountGiven)
      const roi =
        item.totalDiscountGiven > 0
          ? Number((item.totalOrderRevenue / item.totalDiscountGiven).toFixed(2))
          : 0
      const aov =
        item.redemptionCount > 0 ? Math.round(item.totalOrderRevenue / item.redemptionCount) : 0

      return {
        ...item,
        netRevenue: net,
        roiMultiplier: roi,
        avgOrderValue: aov,
      }
    })

    const totalNetRevenue = Math.max(0, totalGrossRevenue - totalDiscountExpense)
    const overallRoi =
      totalDiscountExpense > 0
        ? Number((totalGrossRevenue / totalDiscountExpense).toFixed(2))
        : 0

    return NextResponse.json({
      summary: {
        totalDiscountExpense, // money saved by users in paise
        totalGrossRevenue, // gross sales driven in paise
        totalNetRevenue, // net revenue in paise
        overallRoi, // e.g. 6.8x
        totalRedemptions: redemptions.length,
      },
      breakdown,
      recentRedemptions: redemptions.slice(0, 10),
    })
  } catch (error) {
    console.error("Failed to fetch coupons audit:", error)
    return NextResponse.json(
      { error: "Failed to fetch coupons audit", details: String(error) },
      { status: 500 }
    )
  }
}

