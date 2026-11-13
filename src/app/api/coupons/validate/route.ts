import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { code, subtotal = 0, items = [], userId } = body

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, message: "Please enter a valid coupon code" },
        { status: 400 }
      )
    }

    const cleanCode = code.trim().toUpperCase()

    // 1. Query database for active coupon
    let coupon = null
    try {
      coupon = await prisma.coupon.findFirst({
        where: {
          code: cleanCode,
          isActive: true,
        },
      })
    } catch (e) {
      console.warn("DB coupon check failed, fallback to defaults:", e)
    }

    // 2. Built-in fallback if database is empty/fresh
    if (!coupon) {
      if (cleanCode === "FIRST500") {
        coupon = {
          id: "coupon-first500",
          code: "FIRST500",
          title: "New Customer Welcome Voucher",
          description: "Flat ₹500 off on your first order (min cart ₹999)",
          discountType: "fixed",
          discountValue: 50000,
          minOrderValue: 99900,
          maxDiscountAmount: null,
          targetScenario: "FIRST_PURCHASE",
          targetCategorySlug: null,
          targetBrandSlug: null,
          firstPurchaseOnly: true,
          isActive: true,
          startDate: null,
          expiresAt: null,
          usageLimit: null,
          usedCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      } else if (cleanCode === "PAYPILOT10") {
        coupon = {
          id: "coupon-paypilot10",
          code: "PAYPILOT10",
          title: "Storewide 10% Discount",
          description: "10% off entire order",
          discountType: "percentage",
          discountValue: 10,
          minOrderValue: null,
          maxDiscountAmount: 100000,
          targetScenario: "GENERAL",
          targetCategorySlug: null,
          targetBrandSlug: null,
          firstPurchaseOnly: false,
          isActive: true,
          startDate: null,
          expiresAt: null,
          usageLimit: null,
          usedCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }
    }

    if (!coupon || !coupon.isActive) {
      return NextResponse.json({
        success: false,
        message: `Coupon "${cleanCode}" is invalid or inactive.`,
      })
    }

    // Check start date
    if (coupon.startDate && new Date(coupon.startDate).getTime() > Date.now()) {
      return NextResponse.json({
        success: false,
        message: `Coupon "${cleanCode}" campaign has not started yet.`,
      })
    }

    // Check expiration date
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({
        success: false,
        message: `Coupon "${cleanCode}" has expired.`,
      })
    }

    // Check max total redemptions limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({
        success: false,
        message: `Coupon "${cleanCode}" redemption limit reached.`,
      })
    }

    // Check minimum order value
    if (coupon.minOrderValue && subtotal > 0 && subtotal < coupon.minOrderValue) {
      const minRequiredRupees = Math.round(coupon.minOrderValue / 100)
      return NextResponse.json({
        success: false,
        message: `Coupon requires minimum order value of ₹${minRequiredRupees.toLocaleString("en-IN")}.`,
      })
    }

    // Check scenario: FIRST_PURCHASE validation
    if (coupon.targetScenario === "FIRST_PURCHASE" || coupon.firstPurchaseOnly) {
      if (userId) {
        try {
          const pastOrders = await prisma.order.count({
            where: {
              userId,
              status: { notIn: ["CANCELLED"] },
            },
          })
          if (pastOrders > 0) {
            return NextResponse.json({
              success: false,
              message: `Coupon "${cleanCode}" is exclusively valid on your first order.`,
            })
          }
        } catch (e) {
          console.warn("Could not verify user order history for first purchase voucher:", e)
        }
      }
    }

    // Calculate discount
    let discount = 0
    if (coupon.discountType === "fixed") {
      discount = Math.min(coupon.discountValue, subtotal)
    } else {
      discount = Math.round((subtotal * coupon.discountValue) / 100)
      // Check max discount cap
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount
      }
    }

    return NextResponse.json({
      success: true,
      coupon: {
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderValue: coupon.minOrderValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        targetScenario: coupon.targetScenario,
      },
      discount,
      message: `Coupon ${coupon.code} applied! Saved ₹${Math.round(discount / 100).toLocaleString("en-IN")}`,
    })
  } catch (error) {
    console.error("Coupon validation error:", error)
    return NextResponse.json(
      { success: false, message: "Error validating coupon. Please try again." },
      { status: 500 }
    )
  }
}
