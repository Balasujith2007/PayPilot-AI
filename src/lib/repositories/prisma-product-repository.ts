import type {
  Product,
  ProductFilters,
  ProductRepository,
  SortOption,
  PaginationParams,
  PaginatedResult,
  ProductStatus,
} from "@/types"
import { prisma } from "@/lib/db/prisma"
import { jsonProductRepository } from "./json-product-repository"

// Helper to convert Prisma record to domain Product
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPrismaProduct(p: any): Product {
  const rawStatus = typeof p.status === "string" ? p.status.toLowerCase() : "active"
  const status: ProductStatus =
    rawStatus === "archived" ? "archived" : rawStatus === "draft" ? "draft" : "active"

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    body: p.body ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    images: Array.isArray(p.images) ? (p.images as any) : [],
    status,
    brandId: p.brandId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categoryIds: Array.isArray(p.categories) ? p.categories.map((c: any) => c.id) : (p.categoryIds || []),
    tags: Array.isArray(p.tags) ? p.tags : [],
    variants: Array.isArray(p.variants) && p.variants.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? p.variants.map((v: any) => ({
          id: v.id,
          productId: v.productId,
          sku: v.sku,
          name: v.name,
          price: v.price,
          compareAtPrice: v.compareAtPrice ?? undefined,
          currency: v.currency || "INR",
          inventory: {
            quantity: v.quantity ?? 50,
            trackInventory: v.trackInventory ?? true,
            allowBackorder: v.allowBackorder ?? false,
          },
          options: Array.isArray(v.options) ? v.options : [],
          images: Array.isArray(v.images) ? v.images : [],
        }))
      : [
          {
            id: `var-${p.id}`,
            productId: p.id,
            sku: `SKU-${p.id}`,
            name: "Default",
            price: 199900,
            currency: "INR",
            inventory: {
              quantity: 50,
              trackInventory: true,
              allowBackorder: false,
            },
            options: [],
            images: [],
          },
        ],
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    featured: Boolean(p.featured),
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt || new Date().toISOString()),
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt || new Date().toISOString()),
  }
}

export const prismaProductRepository: ProductRepository = {
  async list(filters?: ProductFilters, sort?: SortOption, pagination?: PaginationParams): Promise<PaginatedResult<Product>> {
    try {
      const page = pagination?.page ?? 1
      const limit = pagination?.limit ?? 12
      const skip = (page - 1) * limit

      // Build Prisma Where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        status: "ACTIVE",
      }

      if (filters?.category) {
        where.categories = {
          some: {
            slug: filters.category,
          },
        }
      }

      if (filters?.search) {
        const query = filters.search.trim()
        where.OR = [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ]
      }

      if (filters?.tags && filters.tags.length > 0) {
        where.tags = {
          hasSome: filters.tags,
        }
      }

      // Order by
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let orderBy: any = { createdAt: "desc" }
      if (sort?.field === "name") {
        orderBy = { name: sort.order || "asc" }
      } else if (sort?.field === "createdAt") {
        orderBy = { createdAt: sort.order || "desc" }
      }

      const [dbProducts, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            variants: true,
            categories: true,
            brand: true,
          },
          orderBy,
          skip,
          take: limit,
        }),
        prisma.product.count({ where }),
      ])

      if (dbProducts.length === 0 && total === 0) {
        // Fallback to static JSON if database has no products yet
        return await jsonProductRepository.list(filters, sort, pagination)
      }

      const items = dbProducts.map(mapPrismaProduct)

      // Handle in-memory price sort if requested (since variants are relation)
      if (sort?.field === "price") {
        items.sort((a, b) => {
          const priceA = a.variants[0]?.price ?? 0
          const priceB = b.variants[0]?.price ?? 0
          return sort.order === "desc" ? priceB - priceA : priceA - priceB
        })
      }

      const totalPages = Math.ceil(total / limit) || 1

      return {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      }
    } catch (error) {
      console.warn("Prisma list failed, falling back to JSON repository:", error)
      return await jsonProductRepository.list(filters, sort, pagination)
    }
  },

  async getBySlug(slug: string): Promise<Product | null> {
    try {
      const product = await prisma.product.findFirst({
        where: {
          slug,
          status: "ACTIVE",
        },
        include: {
          variants: true,
          categories: true,
          brand: true,
        },
      })

      if (product) {
        return mapPrismaProduct(product)
      }

      return await jsonProductRepository.getBySlug(slug)
    } catch (error) {
      console.warn("Prisma getBySlug failed, falling back to JSON repository:", error)
      return await jsonProductRepository.getBySlug(slug)
    }
  },

  async getById(id: string): Promise<Product | null> {
    try {
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          variants: true,
          categories: true,
          brand: true,
        },
      })

      if (product) {
        return mapPrismaProduct(product)
      }

      return await jsonProductRepository.getById(id)
    } catch (error) {
      console.warn("Prisma getById failed, falling back to JSON repository:", error)
      return await jsonProductRepository.getById(id)
    }
  },

  async getFeatured(limit = 4): Promise<Product[]> {
    try {
      const products = await prisma.product.findMany({
        where: {
          featured: true,
          status: "ACTIVE",
        },
        include: {
          variants: true,
          categories: true,
          brand: true,
        },
        take: limit,
      })

      if (products.length > 0) {
        return products.map(mapPrismaProduct)
      }

      return await jsonProductRepository.getFeatured(limit)
    } catch (error) {
      console.warn("Prisma getFeatured failed, falling back to JSON repository:", error)
      return await jsonProductRepository.getFeatured(limit)
    }
  },

  async getByCategory(categorySlug: string, pagination?: PaginationParams): Promise<PaginatedResult<Product>> {
    return this.list({ category: categorySlug }, undefined, pagination)
  },

  async search(query: string, pagination?: PaginationParams): Promise<PaginatedResult<Product>> {
    return this.list({ search: query }, undefined, pagination)
  },
}

