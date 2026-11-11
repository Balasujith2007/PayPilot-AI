"use client"

import React from "react"
import Link from "next/link"
import { ProductCard } from "@/components/products/product-card"
import { Reveal } from "@/components/home/reveal"
import type { Product } from "@/types"

interface ProductShelfSectionProps {
  title: string
  products: Product[]
  viewAllHref: string
}

export function ProductShelfSection({
  title,
  products,
  viewAllHref,
}: ProductShelfSectionProps) {
  if (!products || products.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      {/* Centered .font-display heading */}
      <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-center uppercase tracking-tight text-black mb-8 sm:mb-12">
        {title}
      </h2>

      {/* Grid: 4 columns desktop, 2 columns tablet & mobile */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-8">
        {products.map((product, idx) => (
          <Reveal key={product.id} delay={idx * 0.08}>
            <ProductCard product={product} />
          </Reveal>
        ))}
      </div>

      {/* Centered outlined pill "View All" link */}
      <div className="mt-10 sm:mt-12 flex justify-center">
        <Link
          href={viewAllHref}
          className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-14 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-black hover:bg-[#F0EEED] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          View All
        </Link>
      </div>
    </section>
  )
}

