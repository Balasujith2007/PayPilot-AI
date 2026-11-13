import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db/prisma"
import { syncCatalogToDatabase } from "@/lib/db/sync-catalog"

export async function GET() {
  try {
    const count = await prisma.category.count()
    if (count === 0) {
      await syncCatalogToDatabase(false)
    }

    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: {
        order: "asc",
      },
    })

    return NextResponse.json({ success: true, categories })
  } catch (error) {
    console.error("Failed to fetch categories:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, image } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Category name is required" },
        { status: 400 }
      )
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
    const id = `cat-${Date.now().toString(36)}`

    const newCategory = await prisma.category.create({
      data: {
        id,
        name,
        slug,
        description: description || `All ${name} items`,
        image: image || {
          url: "/images/products/placeholder.svg",
          alt: name,
        },
      },
    })

    try {
      revalidatePath("/", "layout")
      revalidatePath("/shop")
      revalidatePath("/admin/categories")
    } catch (e) {
      console.warn("revalidatePath error:", e)
    }

    return NextResponse.json({ success: true, category: newCategory })
  } catch (error) {
    console.error("Failed to create category:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create category" },
      { status: 500 }
    )
  }
}

