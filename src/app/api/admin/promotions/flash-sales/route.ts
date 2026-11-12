import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncPromotionsData } from "@/lib/db/sync-promotions"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const count = await prisma.flashSale.count()
    if (count === 0) {
      await syncPromotionsData()
    }

    const flashSales = await prisma.flashSale.findMany({
      orderBy: { startsAt: "desc" },
    })

    return NextResponse.json({ flashSales })
  } catch (error) {
    console.error("Failed to fetch flash sales:", error)
    return NextResponse.json(
      { error: "Failed to fetch flash sales", details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      discountType = "percentage",
      discountValue,
      appliesTo = "STOREWIDE",
      targetCategorySlug,
      targetBrandSlug,
      bannerBadge = "FLASH SALE",
      bannerHeadline,
      accentColor = "#FF3333",
      startsAt,
      endsAt,
      isActive = true,
    } = body

    if (!title || discountValue === undefined || !startsAt || !endsAt) {
      return NextResponse.json(
        { error: "title, discountValue, startsAt and endsAt are required" },
        { status: 400 }
      )
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + `-${Date.now().toString().slice(-4)}`

    const flashSale = await prisma.flashSale.create({
      data: {
        title,
        slug,
        description: description || `Flash sale: ${discountValue}% off ${appliesTo.toLowerCase()}`,
        discountType,
        discountValue: Number(discountValue),
        appliesTo,
        targetCategorySlug: targetCategorySlug || null,
        targetBrandSlug: targetBrandSlug || null,
        bannerBadge: bannerBadge || "FLASH SALE",
        bannerHeadline: bannerHeadline || `${title}: ${discountValue}% OFF!`,
        accentColor: accentColor || "#FF3333",
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        isActive,
      },
    })

    revalidatePath("/")
    revalidatePath("/shop")

    return NextResponse.json({ flashSale, success: true }, { status: 201 })
  } catch (error) {
    console.error("Failed to create flash sale:", error)
    return NextResponse.json(
      { error: "Failed to create flash sale", details: String(error) },
      { status: 500 }
    )
  }
}

