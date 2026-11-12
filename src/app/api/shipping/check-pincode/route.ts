import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pincode = searchParams.get("pincode")?.trim()
    const cartTotalParam = searchParams.get("cartTotal") // in paise or rupees
    const cartTotalPaise = cartTotalParam ? Number(cartTotalParam) : 0

    if (!pincode || pincode.length !== 6) {
      return NextResponse.json(
        { error: "Valid 6-digit Indian PIN code required" },
        { status: 400 }
      )
    }

    const zone = await prisma.deliveryZone.findUnique({
      where: { pincode },
    })

    const standardRule = await prisma.shippingRule.findUnique({
      where: { code: "STANDARD" },
    })

    const expressRule = await prisma.shippingRule.findUnique({
      where: { code: "EXPRESS" },
    })

    if (!zone || !zone.isServiceable) {
      return NextResponse.json({
        isServiceable: false,
        pincode,
        message: "Delivery is currently unserviceable to this PIN code.",
      })
    }

    // Dynamic shipping fee calculation
    const freeThreshold = standardRule?.freeThreshold ?? 99900
    const isFreeDelivery = cartTotalPaise >= freeThreshold
    const standardFee = isFreeDelivery ? 0 : (standardRule?.baseFee ?? 9900)
    const expressFee = expressRule?.baseFee ?? 19900

    return NextResponse.json({
      isServiceable: true,
      pincode: zone.pincode,
      city: zone.city,
      state: zone.state,
      areaName: zone.areaName,
      zoneType: zone.zoneType,
      codAvailable: zone.codAvailable,
      expressAvailable: zone.expressAvailable,
      standardDelivery: {
        days: zone.standardDays,
        fee: standardFee,
        isFree: isFreeDelivery,
        freeThreshold,
      },
      expressDelivery: {
        available: zone.expressAvailable,
        days: zone.expressDays,
        fee: expressFee,
      },
      preferredCourier: zone.preferredPartner,
    })
  } catch (error) {
    console.error("Failed to check pincode serviceability:", error)
    return NextResponse.json(
      { error: "Failed to check serviceability", details: String(error) },
      { status: 500 }
    )
  }
}

