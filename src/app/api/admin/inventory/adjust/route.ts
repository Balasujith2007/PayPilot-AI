import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { revalidatePath } from "next/cache"

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const {
      variantId,
      action = "SET", // "SET" | "INCREMENT" | "DECREMENT"
      amount,
      reason = "MANUAL_RECONCILIATION",
      notes,
      staffAuthor = "Balaganesh (Admin)",
    } = body

    if (!variantId || amount === undefined) {
      return NextResponse.json(
        { error: "variantId and amount are required" },
        { status: 400 }
      )
    }

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    })

    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 })
    }

    const previousQuantity = variant.quantity
    let newQuantity = previousQuantity
    let changeAmount = 0

    if (action === "SET") {
      newQuantity = Math.max(0, Number(amount))
      changeAmount = newQuantity - previousQuantity
    } else if (action === "INCREMENT") {
      changeAmount = Number(amount)
      newQuantity = previousQuantity + changeAmount
    } else if (action === "DECREMENT") {
      changeAmount = -Math.abs(Number(amount))
      newQuantity = Math.max(0, previousQuantity + changeAmount)
      changeAmount = newQuantity - previousQuantity
    }

    // Update variant quantity
    const updatedVariant = await prisma.productVariant.update({
      where: { id: variantId },
      data: { quantity: newQuantity },
    })

    // Log adjustment in DB
    const log = await prisma.stockAdjustmentLog.create({
      data: {
        variantId,
        sku: variant.sku,
        productTitle: variant.product.name,
        variantName: variant.name,
        previousQuantity,
        newQuantity,
        changeAmount,
        reason,
        notes: notes || `Stock updated via Admin Inventory Control (${action})`,
        staffAuthor,
      },
    })

    // Revalidate paths so storefront cards immediately show Out of Stock or Low Stock
    revalidatePath("/")
    revalidatePath("/shop")
    revalidatePath(`/${variant.product.slug}`)
    revalidatePath("/admin/inventory")
    revalidatePath("/admin/products")

    return NextResponse.json({
      success: true,
      variant: updatedVariant,
      log,
    })
  } catch (error) {
    console.error("Failed to adjust inventory:", error)
    return NextResponse.json(
      { error: "Failed to adjust inventory", details: String(error) },
      { status: 500 }
    )
  }
}
