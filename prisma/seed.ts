/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Prisma 7 seed script — seeds all tables from src/data JSON files.
 *
 * Run with:  npx tsx prisma/seed.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"
import productsData from "../src/data/products.json"
import blogData from "../src/data/blog.json"
import pagesData from "../src/data/pages.json"

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({
  adapter,
  log: ["warn", "error"],
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const cents = (n: number) => Math.round(n)

// Map JSON product status → Prisma enum
const mapStatus = (s: string): "ACTIVE" | "DRAFT" | "ARCHIVED" =>
  s.toUpperCase() === "ACTIVE"
    ? "ACTIVE"
    : s.toUpperCase() === "DRAFT"
    ? "DRAFT"
    : "ARCHIVED"

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🌱 Starting seed...")

  // -------------------------------------------------------------------------
  // 1. Brands (derive from products.json if present, else inline defaults)
  // -------------------------------------------------------------------------
  const brandsRaw = (productsData as any).brands ?? []
  if (brandsRaw.length === 0) {
    // products.json may not have a top-level brands key — use the brandIds we see in products
    const brandIds = [...new Set((productsData.products as any[]).map((p: any) => p.brandId))]
    for (const brandId of brandIds) {
      await prisma.brand.upsert({
        where: { id: brandId },
        create: {
          id: brandId,
          name: brandId.replace("brand-", "Brand "),
          slug: brandId,
          description: "Quality brand",
        },
        update: {},
      })
    }
    console.log(`✅ Upserted ${brandIds.length} brand(s)`)
  } else {
    for (const brand of brandsRaw) {
      await prisma.brand.upsert({
        where: { id: brand.id },
        create: {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          description: brand.description ?? "",
        },
        update: { name: brand.name, description: brand.description ?? "" },
      })
    }
    console.log(`✅ Upserted ${brandsRaw.length} brand(s)`)
  }

  // -------------------------------------------------------------------------
  // 2. Categories (sorted so parents come before children)
  // -------------------------------------------------------------------------
  const categories = (productsData as any).categories ?? []
  const sorted = [...categories].sort((a: any, b: any) => {
    if (!a.parentId && b.parentId) return -1
    if (a.parentId && !b.parentId) return 1
    return 0
  })

  for (const cat of sorted) {
    await prisma.category.upsert({
      where: { id: cat.id },
      create: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description ?? "",
        image: cat.image ?? undefined,
        parentId: cat.parentId ?? null,
        order: cat.order ?? 0,
      },
      update: {
        name: cat.name,
        description: cat.description ?? "",
        image: cat.image ?? undefined,
        parentId: cat.parentId ?? null,
        order: cat.order ?? 0,
      },
    })
  }
  console.log(`✅ Upserted ${sorted.length} categories`)

  // -------------------------------------------------------------------------
  // 3. Products + Variants
  // -------------------------------------------------------------------------
  const products = (productsData as any).products ?? []
  for (const p of products) {
    // Upsert product
    await prisma.product.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description ?? "",
        body: p.body ?? null,
        images: p.images ?? [],
        status: mapStatus(p.status ?? "ACTIVE"),
        brandId: p.brandId,
        tags: p.tags ?? [],
        rating: p.rating ?? 0,
        reviewCount: p.reviewCount ?? 0,
        featured: p.featured ?? false,
        createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        categories: {
          connect: (p.categoryIds ?? []).map((id: string) => ({ id })),
        },
      },
      update: {
        name: p.name,
        description: p.description ?? "",
        body: p.body ?? null,
        images: p.images ?? [],
        status: mapStatus(p.status ?? "ACTIVE"),
        tags: p.tags ?? [],
        rating: p.rating ?? 0,
        reviewCount: p.reviewCount ?? 0,
        featured: p.featured ?? false,
        categories: {
          set: (p.categoryIds ?? []).map((id: string) => ({ id })),
        },
      },
    })

    // Upsert variants
    for (const v of p.variants ?? []) {
      await prisma.productVariant.upsert({
        where: { id: v.id },
        create: {
          id: v.id,
          productId: p.id,
          sku: v.sku,
          name: v.name,
          price: cents(v.price),
          compareAtPrice: v.compareAtPrice ? cents(v.compareAtPrice) : null,
          currency: v.currency ?? "USD",
          quantity: v.inventory?.quantity ?? 0,
          trackInventory: v.inventory?.trackInventory ?? true,
          allowBackorder: v.inventory?.allowBackorder ?? false,
          options: v.options ?? [],
          images: v.images ?? [],
          weight: v.weight ?? null,
          length: v.length ?? null,
          width: v.width ?? null,
          height: v.height ?? null,
        },
        update: {
          name: v.name,
          price: cents(v.price),
          compareAtPrice: v.compareAtPrice ? cents(v.compareAtPrice) : null,
          quantity: v.inventory?.quantity ?? 0,
          trackInventory: v.inventory?.trackInventory ?? true,
          allowBackorder: v.inventory?.allowBackorder ?? false,
          options: v.options ?? [],
          images: v.images ?? [],
        },
      })
    }
  }
  console.log(`✅ Upserted ${products.length} products with variants`)

  // -------------------------------------------------------------------------
  // 4. Blog posts
  // -------------------------------------------------------------------------
  const posts = (blogData as any).posts ?? []
  for (const post of posts) {
    await prisma.blogPost.upsert({
      where: { id: post.id },
      create: {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? "",
        body: post.body ?? "",
        author: post.author ?? "The Team",
        tags: post.tags ?? [],
        coverImage: post.coverImage ?? undefined,
        publishedAt: new Date(post.publishedAt),
        updatedAt: post.updatedAt ? new Date(post.updatedAt) : null,
      },
      update: {
        title: post.title,
        excerpt: post.excerpt ?? "",
        body: post.body ?? "",
        author: post.author ?? "The Team",
        tags: post.tags ?? [],
      },
    })
  }
  console.log(`✅ Upserted ${posts.length} blog posts`)

  // -------------------------------------------------------------------------
  // 5. CMS Pages
  // -------------------------------------------------------------------------
  const pages = (pagesData as any).pages ?? (Array.isArray(pagesData) ? pagesData : [])
  for (const page of pages) {
    await prisma.cmsPage.upsert({
      where: { id: page.id },
      create: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        excerpt: page.excerpt ?? null,
        body: page.body ?? "",
        publishedAt: page.publishedAt ? new Date(page.publishedAt) : new Date(),
        updatedAt: page.updatedAt ? new Date(page.updatedAt) : null,
      },
      update: {
        title: page.title,
        excerpt: page.excerpt ?? null,
        body: page.body ?? "",
      },
    })
  }
  console.log(`✅ Upserted ${pages.length} CMS pages`)

  console.log("\n🎉 Seed completed successfully!")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
