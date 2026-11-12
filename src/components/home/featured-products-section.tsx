"use client"

import React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { ProductGrid } from "@/components/products/product-grid"
import { ScrollReveal } from "@/components/ui/scroll-reveal"
import type { Product } from "@/types"

interface FeaturedProductsSectionProps {
  products: Product[]
}

export function FeaturedProductsSection({
  products,
}: FeaturedProductsSectionProps) {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
      {/* Header with animated arrow */}
      <ScrollReveal className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Featured Products
        </h2>
        <Link
          href="/shop"
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary transition-colors hover:text-brand-primary/80"
        >
          View all
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </ScrollReveal>

      {/* Grid: 4-column desktop / 2 tablet / 2 mobile */}
      <ScrollReveal delayMs={120} className="mt-8">
        <ProductGrid products={products} />
      </ScrollReveal>
    </section>
  )
}

