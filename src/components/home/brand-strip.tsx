"use client"

import React from "react"

interface BrandStripProps {
  brands?: string[]
}

export function BrandStrip({ brands = [] }: BrandStripProps) {
  // Use catalog brands, or fallback if fewer than 4
  const displayBrands =
    brands.length >= 4
      ? brands
      : ["VERSACE", "ZARA", "GUCCI", "PRADA", "CALVIN KLEIN"]

  // Duplicate items for seamless continuous marquee loop
  const marqueeItems = [...displayBrands, ...displayBrands, ...displayBrands, ...displayBrands]

  return (
    <section
      aria-label="Featured Brands"
      className="w-full bg-black py-7 sm:py-9 overflow-hidden group select-none"
    >
      <div className="flex overflow-hidden motion-reduce:justify-center motion-reduce:flex-wrap motion-reduce:px-4">
        <div className="flex shrink-0 items-center gap-12 sm:gap-16 md:gap-24 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-8">
          {marqueeItems.map((brand, index) => (
            <span
              key={`${brand}-${index}`}
              className="font-display text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight text-white/90 hover:text-white transition-colors cursor-default whitespace-nowrap"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

