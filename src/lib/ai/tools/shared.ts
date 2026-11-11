import { brandRepository, categoryRepository } from "@/lib/repositories"
import { siteConfig } from "@/lib/config"
import { formatPrice } from "@/lib/utils"
import type { Product, ProductVariant } from "@/types"

import type {
  AgentToolDefinition,
  AgentToolErrorCode,
  AgentToolResult,
  RegisteredAgentTool,
} from "./types"

/**
 * Flat shipping fee applied below the free-shipping threshold. Kept in sync
 * with the storefront summary in src/components/cart/cart-summary.tsx.
 */
export const FLAT_SHIPPING_RATE = 599

/**
 * Adapt a strongly-typed tool definition into the registry's erased shape.
 * This is the only place the argument type is widened, and it happens after
 * the tool's own Zod schema has already validated the input.
 */
export function defineAgentTool<TArgs>(
  definition: AgentToolDefinition<TArgs>
): RegisteredAgentTool {
  return {
    name: definition.name,
    description: definition.description,
    parameters: definition.parameters,
    schema: definition.schema,
    execute: (args) => definition.execute(args as TArgs),
  }
}

export function toolSuccess<TData extends Record<string, unknown>>(
  tool: string,
  data: TData
): AgentToolResult<TData> {
  return { ok: true, tool, data }
}

export function toolFailure(
  tool: string,
  code: Exclude<AgentToolErrorCode, "UNKNOWN_TOOL">,
  message: string
): AgentToolResult {
  return { ok: false, tool, error: { code, message } }
}

/** Compact, model-friendly product shape. Always derived from the catalog. */
export interface ProductSummary {
  id: string
  name: string
  slug: string
  url: string
  description: string
  /** Primary catalog image URL, or null when the product has none. */
  image: string | null
  price: number
  priceFormatted: string
  compareAtPrice?: number
  currency: string
  rating: number
  reviewCount: number
  brand: string | null
  categories: string[]
  tags: string[]
  inStock: boolean
}

/**
 * Cart totals, mirroring src/components/cart/cart-summary.tsx so any quote the
 * agent gives a shopper matches what the storefront will charge.
 */
export function computeCartTotals(subtotal: number) {
  const shipping =
    subtotal >= siteConfig.freeShippingThreshold ? 0 : FLAT_SHIPPING_RATE
  const tax = Math.round(subtotal * siteConfig.taxRate)
  return { subtotal, shipping, tax, total: subtotal + shipping + tax }
}

/** The variant a shopper sees first (matches repository price filtering). */
export function primaryVariant(product: Product): ProductVariant | undefined {
  return product.variants[0]
}

export function isPurchasable(variant: ProductVariant | undefined): boolean {
  if (!variant) return false
  return variant.inventory.quantity > 0 || variant.inventory.allowBackorder
}

export function productUrl(slug: string): string {
  return `/${slug}`
}

export function stockFor(variant: ProductVariant): number {
  return variant.inventory.allowBackorder
    ? Number.MAX_SAFE_INTEGER
    : variant.inventory.quantity
}

async function resolveBrandName(brandId?: string): Promise<string | null> {
  if (!brandId) return null
  const brand = await brandRepository.getById(brandId)
  return brand?.name ?? null
}

async function resolveCategoryNames(categoryIds?: string[]): Promise<string[]> {
  if (!categoryIds || categoryIds.length === 0) return []
  const wanted = new Set(categoryIds)
  const categories = await categoryRepository.list()
  return categories.filter((category) => wanted.has(category.id)).map((category) => category.name)
}

/**
 * Resolve free-text category input (slug, id or display name) to a category
 * slug understood by the product repository. Returns null when nothing matches
 * so the caller can report it back instead of silently searching everything.
 */
export async function resolveCategorySlug(input: string): Promise<string | null> {
  const needle = input.trim().toLowerCase()
  if (!needle) return null

  const categories = await categoryRepository.list()
  const match = categories.find(
    (category) =>
      category.slug.toLowerCase() === needle ||
      category.id.toLowerCase() === needle ||
      category.name.toLowerCase() === needle
  )
  return match?.slug ?? null
}

export async function toProductSummary(product: Product): Promise<ProductSummary> {
  const variant = primaryVariant(product)
  const [brand, categories] = await Promise.all([
    resolveBrandName(product.brandId),
    resolveCategoryNames(product.categoryIds),
  ])

  const price = variant?.price ?? 0
  const currency = variant?.currency ?? siteConfig.currency

  const summary: ProductSummary = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    url: productUrl(product.slug),
    description: product.description,
    // Same precedence the cart proposal uses, so the card thumbnail matches.
    image: variant?.images[0]?.url ?? product.images[0]?.url ?? null,
    price,
    priceFormatted: formatPrice(price, currency),
    currency,
    rating: product.rating,
    reviewCount: product.reviewCount,
    brand,
    categories,
    tags: product.tags,
    inStock: product.variants.some(isPurchasable),
  }

  if (variant?.compareAtPrice !== undefined) {
    summary.compareAtPrice = variant.compareAtPrice
  }

  return summary
}

export function formatCents(amount: number, currency: string = siteConfig.currency): string {
  return formatPrice(amount, currency)
}
