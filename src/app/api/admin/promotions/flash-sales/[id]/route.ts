import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      title,
      description,
      discountType,
      discountValue,
      appliesTo,
      targetCategorySlug,
      targetBrandSlug,
      bannerBadge,
      bannerHeadline,
      accentColor,
      startsAt,
      endsAt,
      isActive,
    } = body

    const updated = await prisma.flashSale.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(discountType !== undefined && { discountType }),
        ...(discountValue !== undefined && { discountValue: Number(discountValue) }),
        ...(appliesTo !== undefined && { appliesTo }),
        ...(targetCategorySlug !== undefined && { targetCategorySlug }),
        ...(targetBrandSlug !== undefined && { targetBrandSlug }),
        ...(bannerBadge !== undefined && { bannerBadge }),
        ...(bannerHeadline !== undefined && { bannerHeadline }),
        ...(accentColor !== undefined && { accentColor }),
        ...(startsAt !== undefined && { startsAt: new Date(startsAt) }),
        ...(endsAt !== undefined && { endsAt: new Date(endsAt) }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    revalidatePath("/")
    revalidatePath("/shop")

    return NextResponse.json({ success: true, flashSale: updated })
  } catch (error) {
    console.error("Failed to update flash sale:", error)
    return NextResponse.json(
      { error: "Failed to update flash sale", details: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.flashSale.delete({
      where: { id },
    })

    revalidatePath("/")
    revalidatePath("/shop")

    return NextResponse.json({ success: true, message: "Flash sale deleted" })
  } catch (error) {
    console.error("Failed to delete flash sale:", error)
    return NextResponse.json(
      { error: "Failed to delete flash sale", details: String(error) },
      { status: 500 }
    )
  }
}

