import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { siteConfig } from "@/lib/config"
import { productRepository, categoryRepository, brandRepository } from "@/lib/repositories"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HeroSection } from "@/components/hero/hero-section"
import { BrandStrip } from "@/components/home/brand-strip"
import { ProductShelfSection } from "@/components/home/product-shelf-section"
import { CategoriesSection } from "@/components/home/categories-section"
import { CustomerReviewsSection } from "@/components/home/customer-reviews-section"
import { WhyUsSection } from "@/components/home/why-us-section"
import { ScrollProgressBar } from "@/components/layout/scroll-progress-bar"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = {
  title: "PayPilot AI — Shop Smarter with Your Personal AI Assistant",
  description:
    "An AI-powered ecommerce experience with smart discovery, side-by-side comparisons, transparent recommendations, and seamless checkout.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "PayPilot AI — Shop Smarter with Your Personal AI Assistant",
    description:
      "An AI-powered ecommerce experience with smart discovery, side-by-side comparisons, transparent recommendations, and seamless checkout.",
    type: "website",
    url: siteConfig.url,
  },
}

export default async function HomePage() {
  const allCategories = await categoryRepository.list()
  const topCategories = allCategories.filter((c) => !c.parentId)
  const { items: allProducts } = await productRepository.list(undefined, undefined, { page: 1, limit: 100 })
  const allBrands = await brandRepository.list()

  // 1. New Arrivals: 4 newest products from catalog
  const { items: newArrivals } = await productRepository.list(
    undefined,
    { field: "createdAt", order: "desc" },
    { page: 1, limit: 4 }
  )

  // 2. Top Rated: 4 highest-rated active products (since catalog has no sales data)
  const allActiveProducts = allProducts.filter((p) => p.status === "active")
  const topRated = [...allActiveProducts]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4)

  // 3. Brand names for brand strip
  const brandNames =
    allBrands.length >= 4
      ? allBrands.map((b) => b.name)
      : allCategories.map((c) => c.name)

  const stats = {
    products: allProducts.length,
    brands: allBrands.length,
    categories: allCategories.length,
  }

  const categoriesWithCounts = topCategories.map((cat) => {
    const childCategories = allCategories.filter((c) => c.parentId === cat.id)
    const catIds = [cat.id, ...childCategories.map((c) => c.id)]
    const count = allProducts.filter((p) =>
      p.categoryIds.some((id) => catIds.includes(id))
    ).length
    return {
      ...cat,
      count,
    }
  })

  const top4Categories = [...categoriesWithCounts]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 4)

  return (
    <div className="flex flex-col">
      {/* Scroll Progress Bar */}
      <ScrollProgressBar />

      {/* Hero */}
      <section className="relative flex h-[650px] items-center justify-center bg-neutral-50">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <Badge variant="secondary" className="mb-4">
            Free shipping on orders over {formatPrice(siteConfig.freeShippingThreshold)}
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Next.js Ecommerce Starter
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            A free, open-source ecommerce template built with Next.js, Tailwind CSS, and shadcn/ui.
            Production-ready, fully responsive, and designed to connect to any checkout system.
          </p>
          <div className="mt-8 flex justify-center">
            <Button size="lg" asChild>
              <Link href="/shop">
                Shop Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 1. Brand Strip */}
      <BrandStrip brands={brandNames} />

      {/* 2. NEW ARRIVALS */}
      <ProductShelfSection
        title="NEW ARRIVALS"
        products={newArrivals}
        viewAllHref="/shop?sort=newest"
      />

      {/* Thin divider */}
      <hr className="mx-auto max-w-[1440px] border-t border-black/10 px-4 sm:px-6 lg:px-8" />

      {/* 3. TOP RATED (named TOP RATED because catalog has no sales data) */}
      <ProductShelfSection
        title="TOP RATED"
        products={topRated}
        viewAllHref="/shop"
      />

      {/* Thin divider */}
      <hr className="mx-auto max-w-[1440px] border-t border-black/10 px-4 sm:px-6 lg:px-8" />

      {/* 4. BROWSE BY CATEGORY (Bento Grid) */}
      <CategoriesSection categories={top4Categories} />

      {/* 5. OUR HAPPY CUSTOMERS */}
      <CustomerReviewsSection />

      {/* Why Shop With Us (4 Trust Badges) */}
      <WhyUsSection />
    </div>
  )
}
