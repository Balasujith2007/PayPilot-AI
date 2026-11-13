import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        categories: true,
        brand: true,
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error("Failed to fetch product:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch product" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      name,
      description,
      body: longDescription,
      brandId,
      categoryIds,
      images,
      tags,
      status,
      price,
      compareAtPrice,
      quantity,
    } = body

    // Update product base fields
    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(longDescription !== undefined && { body: longDescription }),
        ...(status && { status: status.toUpperCase() }),
        ...(images && { images }),
        ...(tags && { tags }),
        ...(brandId && { brand: { connect: { id: brandId } } }),
        ...(categoryIds && {
          categories: {
            set: categoryIds.map((catId: string) => ({ id: catId })),
          },
        }),
      },
      include: {
        variants: true,
        categories: true,
        brand: true,
      },
    })

    // If pricing or inventory was updated, update default variant
    if (price !== undefined || compareAtPrice !== undefined || quantity !== undefined) {
      const defaultVariant = updated.variants[0]
      if (defaultVariant) {
        const parsedPrice = price !== undefined ? Math.round(Number(price) * 100) : defaultVariant.price
        const parsedCompareAt = compareAtPrice ? Math.round(Number(compareAtPrice) * 100) : null
        const parsedQty = quantity !== undefined ? parseInt(String(quantity), 10) : defaultVariant.quantity

        await prisma.productVariant.update({
          where: { id: defaultVariant.id },
          data: {
            price: parsedPrice,
            compareAtPrice: parsedCompareAt,
            quantity: Number.isNaN(parsedQty) ? defaultVariant.quantity : parsedQty,
          },
        })
      }
    }

    const reloaded = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        categories: true,
        brand: true,
      },
    })

    // Purge and revalidate Next.js cache so customer storefront updates instantly
    try {
      revalidatePath("/", "layout")
      revalidatePath("/shop")
      revalidatePath("/admin/products")
      if (reloaded?.slug) {
        revalidatePath(`/${reloaded.slug}`)
      }
    } catch (e) {
      console.warn("revalidatePath error:", e)
    }

    return NextResponse.json({ success: true, product: reloaded })
  } catch (error) {
    console.error("Failed to update product:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update product" },
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

    // Check if product is in any orders
    const orderItemsCount = await prisma.orderItem.count({
      where: { productId: id },
    })

    if (orderItemsCount > 0) {
      // Soft-archive to preserve order history integrity
      const archived = await prisma.product.update({
        where: { id },
        data: { status: "ARCHIVED" },
      })
      return NextResponse.json({
        success: true,
        message: "Product is associated with orders; status set to ARCHIVED",
        product: archived,
      })
    }

    // Otherwise safe delete
    await prisma.product.delete({
      where: { id },
    })

    // Purge and revalidate Next.js cache
    try {
      revalidatePath("/", "layout")
      revalidatePath("/shop")
      revalidatePath("/admin/products")
    } catch (e) {
      console.warn("revalidatePath error:", e)
    }

    return NextResponse.json({
      success: true,
      message: "Product deleted successfully from database",
    })
  } catch (error) {
    console.error("Failed to delete product:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete product from database" },
      { status: 500 }
    )
  }
}

