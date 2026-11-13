import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncPromotionsData } from "@/lib/db/sync-promotions"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const count = await prisma.promotionalBanner.count()
    if (count === 0) {
      await syncPromotionsData()
    }

    const banners = await prisma.promotionalBanner.findMany({
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    })

    return NextResponse.json({ success: true, banners })
  } catch (error) {
    console.error("Failed to fetch promotional banners:", error)
    return NextResponse.json(
      { error: "Failed to fetch banners", details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      title,
      message,
      promoCode,
      linkText = "Shop Now",
      linkUrl = "/shop",
      badgeText = "OFFER",
      backgroundColor = "#000000",
      textColor = "#FFFFFF",
      startsAt,
      endsAt,
      priority = 1,
      isActive = true,
    } = body

    if (!title || !message) {
      return NextResponse.json(
        { error: "Title and message are required" },
        { status: 400 }
      )
    }

    const banner = await prisma.promotionalBanner.create({
      data: {
        title,
        message,
        promoCode: promoCode ? promoCode.trim().toUpperCase() : null,
        linkText,
        linkUrl,
        badgeText,
        backgroundColor,
        textColor,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        endsAt: endsAt ? new Date(endsAt) : null,
        priority: Number(priority) || 1,
        isActive,
      },
    })

    revalidatePath("/")
    revalidatePath("/shop")

    return NextResponse.json({ success: true, banner }, { status: 201 })
  } catch (error) {
    console.error("Failed to create promotional banner:", error)
    return NextResponse.json(
      { error: "Failed to create banner", details: String(error) },
      { status: 500 }
    )
  }
}
