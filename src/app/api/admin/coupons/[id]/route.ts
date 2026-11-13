import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      isActive,
      usageLimit,
      expiresAt,
      minOrderValue,
      maxDiscountAmount,
      title,
      description,
    } = body

    const updated = await prisma.coupon.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(usageLimit !== undefined && {
          usageLimit: usageLimit === null ? null : parseInt(usageLimit),
        }),
        ...(expiresAt !== undefined && {
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        }),
        ...(minOrderValue !== undefined && {
          minOrderValue:
            minOrderValue === null ? null : Math.round(parseFloat(minOrderValue) * 100),
        }),
        ...(maxDiscountAmount !== undefined && {
          maxDiscountAmount:
            maxDiscountAmount === null ? null : Math.round(parseFloat(maxDiscountAmount) * 100),
        }),
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
      },
    })

    return NextResponse.json({ success: true, coupon: updated })
  } catch (error) {
    console.error("Failed to update coupon:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update coupon" },
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
    await prisma.coupon.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "Coupon deleted" })
  } catch (error) {
    console.error("Failed to delete coupon:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete coupon" },
      { status: 500 }
    )
  }
}
