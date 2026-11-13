import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncCatalogToDatabase } from "@/lib/db/sync-catalog"

export async function GET() {
  try {
    const count = await prisma.brand.count()
    if (count === 0) {
      await syncCatalogToDatabase(false)
    }

    const brands = await prisma.brand.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json({ success: true, brands })
  } catch (error) {
    console.error("Failed to fetch brands:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch brands" },
      { status: 500 }
    )
  }
}

