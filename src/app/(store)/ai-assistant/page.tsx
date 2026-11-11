import type { Metadata } from "next"
import { productRepository, categoryRepository, brandRepository } from "@/lib/repositories"
import { ShoppingAssistant } from "@/components/ai-assistant/ShoppingAssistant"
import { CatalogProvider } from "@/components/ai-assistant/CatalogProvider"
import type { CatalogProduct } from "@/types/ai-assistant"

export const metadata: Metadata = {
  title: "AI Shopping Assistant — PayPilot AI",
  description:
    "Ask PayPilot AI anything about products, prices, and recommendations. Your personal shopping concierge.",
  alternates: { canonical: "/ai-assistant" },
  openGraph: {
    title: "AI Shopping Assistant — PayPilot AI",
    description:
      "Ask PayPilot AI anything about products, prices, and recommendations. Your personal shopping concierge.",
    type: "website",
  },
}

export default async function AiAssistantPage() {
  const [{ items: products }, brands, categories] = await Promise.all([
    productRepository.list(undefined, undefined, { page: 1, limit: 100 }),
    brandRepository.list(),
    categoryRepository.list(),
  ])

  const brandMap = new Map(brands.map((b) => [b.id, b.name]))
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))

  const catalogProducts: CatalogProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    image: p.images[0],
    rating: p.rating,
    reviewCount: p.reviewCount,
    tags: p.tags,
    brandName: brandMap.get(p.brandId),
    categoryNames: p.categoryIds
      .map((id) => categoryMap.get(id))
      .filter((name): name is string => Boolean(name)),
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      currency: v.currency,
      inventory: v.inventory,
      options: v.options,
    })),
  }))

  return (
    <CatalogProvider products={catalogProducts}>
      <ShoppingAssistant />
    </CatalogProvider>
  )
}
