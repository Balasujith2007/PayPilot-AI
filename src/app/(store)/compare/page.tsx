import type { Metadata } from "next"
import { productRepository } from "@/lib/repositories"
import { getProductComparison, parseProductIdsParam } from "@/lib/comparison/service"
import { CompareView, type CompareCatalogOption } from "@/components/compare/compare-view"
import type { Product } from "@/types"

export const metadata: Metadata = {
  title: "Compare Products",
  description: "Compare products side by side on price, rating, and specifications.",
  robots: { index: false },
}

interface ComparePageProps {
  searchParams: Promise<{ ids?: string | string[] }>
}

async function listActiveProducts(): Promise<Product[]> {
  const products: Product[] = []
  let page = 1
  for (;;) {
    const result = await productRepository.list(
      {},
      { field: "name", order: "asc" },
      { page, limit: 100 }
    )
    products.push(...result.items)
    if (!result.pagination.hasNext) break
    page += 1
  }
  return products
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { ids } = await searchParams
  const requestedIds = parseProductIdsParam(ids)

  const [lookup, activeProducts] = await Promise.all([
    getProductComparison(requestedIds),
    listActiveProducts(),
  ])

  const catalog: CompareCatalogOption[] = activeProducts.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
  }))

  return (
    <CompareView
      requestedIds={requestedIds}
      products={lookup.products}
      comparison={lookup.comparison}
      invalidIds={lookup.invalidIds}
      overLimitIds={lookup.overLimitIds}
      catalog={catalog}
    />
  )
}
