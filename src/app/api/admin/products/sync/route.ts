import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { syncCatalogToDatabase } from "@/lib/db/sync-catalog"

export async function POST() {
  try {
    const result = await syncCatalogToDatabase(true)
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to sync catalog" },
        { status: 500 }
      )
    }

    try {
      revalidatePath("/", "layout")
      revalidatePath("/shop")
      revalidatePath("/admin/products")
    } catch (e) {
      console.warn("revalidatePath error:", e)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Failed to run catalog sync:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error syncing catalog" },
      { status: 500 }
    )
  }
}

