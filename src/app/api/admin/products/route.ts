import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db/prisma"
import { syncCatalogToDatabase } from "@/lib/db/sync-catalog"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim().toLowerCase() || ""
    const category = searchParams.get("category") || ""
    const status = searchParams.get("status") || ""

    // Auto-sync real products from catalog if database is fresh/empty
    const count = await prisma.product.count()
    if (count === 0) {
      await syncCatalogToDatabase(false)
    }

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (category) {
      where.categories = {
        some: {
          slug: category,
        },
      }
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        variants: true,
        categories: true,
        brand: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({
      success: true,
      products,
      total: products.length,
    })
  } catch (error) {
    console.error("Failed to fetch products:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch products from database" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
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
      sku,
      quantity,
    } = body

    if (!name || !description) {
      return NextResponse.json(
        { success: false, error: "Product name and description are required" },
        { status: 400 }
      )
    }

    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`
    const productId = `prod-${Date.now().toString(36)}`

    // Default brand fallback if not selected
    let validBrandId = brandId
    if (!validBrandId) {
      const firstBrand = await prisma.brand.findFirst()
      validBrandId = firstBrand?.id || "brand-1"
    }

    const parsedPrice = Math.round(Number(price || 0) * 100)
    const parsedCompareAt = compareAtPrice ? Math.round(Number(compareAtPrice) * 100) : null
    const parsedQty = parseInt(String(quantity || 0), 10)

    const newProduct = await prisma.product.create({
      data: {
        id: productId,
        name,
        slug: uniqueSlug,
        description,
        body: longDescription || null,
        images: Array.isArray(images) && images.length > 0
          ? images
          : [
              {
                url: "/images/products/placeholder.svg",
                alt: name,
                width: 800,
                height: 800,
              },
            ],
        status: status ? status.toUpperCase() : "ACTIVE",
        brand: {
          connect: { id: validBrandId },
        },
        tags: Array.isArray(tags) ? tags : [],
        categories:
          Array.isArray(categoryIds) && categoryIds.length > 0
            ? {
                connect: categoryIds.map((id: string) => ({ id })),
              }
            : undefined,
        variants: {
          create: {
            id: `var-${Date.now().toString(36)}`,
            sku: sku || `SKU-${Date.now().toString(36).toUpperCase()}`,
            name: "Default",
            price: parsedPrice,
            compareAtPrice: parsedCompareAt,
            quantity: Number.isNaN(parsedQty) ? 50 : parsedQty,
            trackInventory: true,
            allowBackorder: false,
            options: [],
            images: [],
          },
        },
      },
      include: {
        variants: true,
        categories: true,
        brand: true,
      },
    })

    // Instantly purge Next.js cache so customer storefront reflects the new product
    try {
      revalidatePath("/", "layout")
      revalidatePath("/shop")
      revalidatePath("/admin/products")
      if (newProduct?.slug) {
        revalidatePath(`/${newProduct.slug}`)
      }
    } catch (e) {
      console.warn("revalidatePath error:", e)
    }

    return NextResponse.json({
      success: true,
      product: newProduct,
    })
  } catch (error) {
    console.error("Failed to create product:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create product in database" },
      { status: 500 }
    )
  }
}

