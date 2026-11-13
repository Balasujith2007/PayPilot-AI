import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncPromotionsData } from "@/lib/db/sync-promotions"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const count = await prisma.coupon.count()
    if (count === 0) {
      await syncPromotionsData()
    }

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, coupons })
  } catch (error) {
    console.error("Failed to fetch coupons:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch coupons from database" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      code,
      title,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscountAmount,
      firstPurchaseOnly,
      targetScenario = "GENERAL",
      targetCategorySlug,
      targetBrandSlug,
      usageLimit,
      startDate,
      expiresAt,
    } = body

    if (!code || !title || discountValue === undefined) {
      return NextResponse.json(
        { success: false, error: "Code, title, and discount value are required" },
        { status: 400 }
      )
    }

    const cleanCode = code.trim().toUpperCase()
    const existing = await prisma.coupon.findUnique({
      where: { code: cleanCode },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Coupon ${cleanCode} already exists` },
        { status: 409 }
      )
    }

    const newCoupon = await prisma.coupon.create({
      data: {
        code: cleanCode,
        title,
        description: description || `${title} (${cleanCode})`,
        discountType: discountType === "percentage" ? "percentage" : "fixed",
        discountValue:
          discountType === "percentage"
            ? parseInt(discountValue)
            : Math.round(parseFloat(discountValue) * 100), // convert to paise
        minOrderValue: minOrderValue ? Math.round(parseFloat(minOrderValue) * 100) : null,
        maxDiscountAmount: maxDiscountAmount
          ? Math.round(parseFloat(maxDiscountAmount) * 100)
          : null,
        firstPurchaseOnly: targetScenario === "FIRST_PURCHASE" ? true : Boolean(firstPurchaseOnly),
        targetScenario,
        targetCategorySlug: targetCategorySlug || null,
        targetBrandSlug: targetBrandSlug || null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        startDate: startDate ? new Date(startDate) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      },
    })

    return NextResponse.json({ success: true, coupon: newCoupon }, { status: 201 })
  } catch (error) {
    console.error("Failed to create coupon:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create coupon in database" },
      { status: 500 }
    )
  }
}
