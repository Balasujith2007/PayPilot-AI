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
      message,
      promoCode,
      linkText,
      linkUrl,
      badgeText,
      backgroundColor,
      textColor,
      startsAt,
      endsAt,
      priority,
      isActive,
    } = body

    const updated = await prisma.promotionalBanner.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(message !== undefined && { message }),
        ...(promoCode !== undefined && {
          promoCode: promoCode ? promoCode.trim().toUpperCase() : null,
        }),
        ...(linkText !== undefined && { linkText }),
        ...(linkUrl !== undefined && { linkUrl }),
        ...(badgeText !== undefined && { badgeText }),
        ...(backgroundColor !== undefined && { backgroundColor }),
        ...(textColor !== undefined && { textColor }),
        ...(startsAt !== undefined && {
          startsAt: startsAt ? new Date(startsAt) : undefined,
        }),
        ...(endsAt !== undefined && {
          endsAt: endsAt ? new Date(endsAt) : null,
        }),
        ...(priority !== undefined && { priority: Number(priority) }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    revalidatePath("/")
    revalidatePath("/shop")

    return NextResponse.json({ success: true, banner: updated })
  } catch (error) {
    console.error("Failed to update promotional banner:", error)
    return NextResponse.json(
      { error: "Failed to update banner", details: String(error) },
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
    await prisma.promotionalBanner.delete({
      where: { id },
    })

    revalidatePath("/")
    revalidatePath("/shop")

    return NextResponse.json({ success: true, message: "Banner deleted" })
  } catch (error) {
    console.error("Failed to delete banner:", error)
    return NextResponse.json(
      { error: "Failed to delete banner", details: String(error) },
      { status: 500 }
    )
  }
}
