import type { Category, Product } from "@/types"
import {
  brandRepository,
  categoryRepository,
  productRepository,
} from "@/lib/repositories"
import { productIdSchema } from "@/lib/validators"
import {
  MAX_COMPARE_PRODUCTS,
  MIN_COMPARE_PRODUCTS,
  compareProducts,
  toComparableProduct,
} from "./compare-products"
import type { ComparableProduct, ProductComparison } from "./types"

/**
 * Splits `?ids=a,b` / repeated `?ids=a&ids=b` params into a clean list.
 * Duplicates are dropped unless `dedupe: false` (strict API validation).
 */
export function parseProductIdsParam(
  value: string | string[] | null | undefined,
  { dedupe = true }: { dedupe?: boolean } = {}
): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : []
  const ids = raw
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean)
  return dedupe ? [...new Set(ids)] : ids
}

async function loadCategories(product: Product): Promise<Category[]> {
  const categories = await Promise.all(
    product.categoryIds.map((id) => categoryRepository.getById(id))
  )
  return categories.filter((c): c is Category => c !== null)
}

/**
 * Looks up products through the product repository. Unknown or non-active
 * products are reported in `notFoundIds` instead of being guessed.
 */
export async function loadComparableProducts(ids: string[]): Promise<{
  products: ComparableProduct[]
  notFoundIds: string[]
}> {
  const found = await Promise.all(ids.map((id) => productRepository.getById(id)))
  const products: ComparableProduct[] = []
  const notFoundIds: string[] = []

  await Promise.all(
    found.map(async (product, i) => {
      if (!product || product.status !== "active") {
        notFoundIds.push(ids[i])
        return
      }
      const [brand, categories] = await Promise.all([
        brandRepository.getById(product.brandId),
        loadCategories(product),
      ])
      products[i] = toComparableProduct(product, { brand, categories })
    })
  )

  return {
    products: products.filter(Boolean),
    notFoundIds: ids.filter((id) => notFoundIds.includes(id)),
  }
}

export interface ComparisonLookup {
  /** Present when at least two valid products were resolved */
  comparison: ProductComparison | null
  /** Valid products, in requested order */
  products: ComparableProduct[]
  /** Malformed IDs or IDs not found in the catalog */
  invalidIds: string[]
  /** Valid IDs dropped because the request exceeded the maximum */
  overLimitIds: string[]
}

/**
 * Lenient lookup used by the compare page: compares whatever valid products
 * were requested and reports the rest so the UI can explain what happened.
 */
export async function getProductComparison(ids: string[]): Promise<ComparisonLookup> {
  const uniqueIds = [...new Set(ids)]
  const wellFormed = uniqueIds.filter((id) => productIdSchema.safeParse(id).success)
  const malformed = uniqueIds.filter((id) => !wellFormed.includes(id))

  const { products: resolved, notFoundIds } = await loadComparableProducts(wellFormed)
  const products = resolved.slice(0, MAX_COMPARE_PRODUCTS)
  const overLimitIds = resolved.slice(MAX_COMPARE_PRODUCTS).map((p) => p.id)

  return {
    comparison: products.length >= MIN_COMPARE_PRODUCTS ? compareProducts(products) : null,
    products,
    invalidIds: [...malformed, ...notFoundIds],
    overLimitIds,
  }
}
