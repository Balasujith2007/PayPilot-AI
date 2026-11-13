import { prisma } from "@/lib/db/prisma"
import data from "@/data/products.json"
import { Prisma } from "@prisma/client"

/**
 * Synchronizes the actual storefront products, categories, and brands
 * from `src/data/products.json` into the live Neon PostgreSQL database.
 *
 * This ensures no dummy or mock data is used — only the real catalog.
 */
export async function syncCatalogToDatabase(force = false) {
  try {
    const existingProductCount = await prisma.product.count()

    // Skip if already populated and not forced
    if (existingProductCount > 0 && !force) {
      return { success: true, count: existingProductCount, message: "Database already populated" }
    }

    // 1. Sync Brands
    for (const b of data.brands) {
      await prisma.brand.upsert({
        where: { id: b.id },
        create: {
          id: b.id,
          name: b.name,
          slug: b.slug,
          description: b.description,
        },
        update: {
          name: b.name,
          slug: b.slug,
          description: b.description,
        },
      })
    }

    // 2. Sync Parent Categories (where parentId is null/undefined)
    const parentCategories = data.categories.filter((c) => !c.parentId)
    for (const c of parentCategories) {
      const imgVal = c.image ? (c.image as Prisma.InputJsonValue) : Prisma.JsonNull
      await prisma.category.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          image: imgVal,
          order: c.order || 0,
        },
        update: {
          name: c.name,
          slug: c.slug,
          description: c.description,
          image: imgVal,
          order: c.order || 0,
        },
      })
    }

    // 3. Sync Child Subcategories (where parentId is set)
    const childCategories = data.categories.filter((c) => c.parentId)
    for (const c of childCategories) {
      const imgVal = c.image ? (c.image as Prisma.InputJsonValue) : Prisma.JsonNull
      await prisma.category.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          image: imgVal,
          parentId: c.parentId,
          order: c.order || 0,
        },
        update: {
          name: c.name,
          slug: c.slug,
          description: c.description,
          image: imgVal,
          parentId: c.parentId,
          order: c.order || 0,
        },
      })
    }

    // 4. Sync Real Products and their Variants
    for (const p of data.products) {
      const statusValue =
        p.status === "archived" ? "ARCHIVED" : p.status === "draft" ? "DRAFT" : "ACTIVE"

      await prisma.product.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          body: p.body || null,
          images: p.images as unknown as Prisma.InputJsonValue,
          status: statusValue,
          brandId: p.brandId,
          tags: p.tags || [],
          rating: p.rating || 0,
          reviewCount: p.reviewCount || 0,
          featured: Boolean(p.featured),
          categories: {
            connect: (p.categoryIds || []).map((catId: string) => ({ id: catId })),
          },
        },
        update: {
          name: p.name,
          slug: p.slug,
          description: p.description,
          body: p.body || null,
          images: p.images as unknown as Prisma.InputJsonValue,
          status: statusValue,
          brandId: p.brandId,
          tags: p.tags || [],
          rating: p.rating || 0,
          reviewCount: p.reviewCount || 0,
          featured: Boolean(p.featured),
          categories: {
            set: (p.categoryIds || []).map((catId: string) => ({ id: catId })),
          },
        },
      })

      // Variants
      if (p.variants?.length) {
        for (const variantItem of p.variants) {
          const v = variantItem as {
            id: string
            sku: string
            name: string
            price: number
            compareAtPrice?: number | null
            currency?: string
            inventory?: { quantity?: number; trackInventory?: boolean; allowBackorder?: boolean }
            options?: unknown
            images?: unknown
          }

          await prisma.productVariant.upsert({
            where: { id: v.id },
            create: {
              id: v.id,
              productId: p.id,
              sku: v.sku,
              name: v.name,
              price: v.price,
              compareAtPrice: v.compareAtPrice || null,
              currency: v.currency || "INR",
              quantity: v.inventory?.quantity ?? 50,
              trackInventory: v.inventory?.trackInventory ?? true,
              allowBackorder: v.inventory?.allowBackorder ?? false,
              options: (v.options || []) as Prisma.InputJsonValue,
              images: (v.images || []) as Prisma.InputJsonValue,
            },
            update: {
              sku: v.sku,
              name: v.name,
              price: v.price,
              compareAtPrice: v.compareAtPrice || null,
              currency: v.currency || "INR",
              quantity: v.inventory?.quantity ?? 50,
              trackInventory: v.inventory?.trackInventory ?? true,
              allowBackorder: v.inventory?.allowBackorder ?? false,
              options: (v.options || []) as Prisma.InputJsonValue,
              images: (v.images || []) as Prisma.InputJsonValue,
            },
          })
        }
      }
    }

    const totalSynced = await prisma.product.count()
    return { success: true, count: totalSynced, message: `Successfully synced ${totalSynced} live products into database` }
  } catch (error) {
    console.error("Error in syncCatalogToDatabase:", error)
    return { success: false, error: String(error) }
  }
}
