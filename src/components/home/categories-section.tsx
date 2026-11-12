"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowUpRight,
  Laptop,
  Shirt,
  Home,
  Watch,
  Coffee,
  Package,
} from "lucide-react"
import { Reveal } from "@/components/home/reveal"
import { cn } from "@/lib/utils"
import type { Category } from "@/types"

export interface CategoryWithCount extends Category {
  count?: number
}

interface CategoriesSectionProps {
  categories: CategoryWithCount[]
}

const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  electronics: Laptop,
  clothing: Shirt,
  "home-kitchen": Home,
  accessories: Watch,
  "food-drink": Coffee,
}

const CATEGORY_ONLINE_IMAGES: Record<string, string> = {
  "home-kitchen":
    "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80",
  accessories:
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
  electronics:
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
  "food-drink":
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
  clothing:
    "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80",
}

const CATEGORY_FALLBACK_URLS: Record<string, string> = {
  "home-kitchen": "/images/home/cat-home-kitchen.jpg",
  accessories: "/images/home/cat-accessories.jpg",
  electronics: "/images/home/cat-electronics.jpg",
  "food-drink": "/images/home/cat-food-drink.jpg",
  clothing: "/images/home/cat-clothing.jpg",
}

// Proportions per tile in the 3-column desktop grid:
// Row 1: 1/3 + 2/3 (md:col-span-1, md:col-span-2)
// Row 2: 2/3 + 1/3 (md:col-span-2, md:col-span-1)
const BENTO_CLASSES = [
  "md:col-span-1",
  "md:col-span-2",
  "md:col-span-2",
  "md:col-span-1",
]

function CategoryTile({
  category,
  className,
}: {
  category: CategoryWithCount
  className?: string
}) {
  const [imageError, setImageError] = useState(false)
  const [useLocalFallback, setUseLocalFallback] = useState(false)
  const Icon = CATEGORY_ICONS[category.slug] ?? Package

  const imageSrc = useLocalFallback
    ? (CATEGORY_FALLBACK_URLS[category.slug] ?? `/images/home/cat-${category.slug}.jpg`)
    : (CATEGORY_ONLINE_IMAGES[category.slug] ?? `/images/home/cat-${category.slug}.jpg`)

  function handleImageError() {
    if (!useLocalFallback && CATEGORY_FALLBACK_URLS[category.slug]) {
      setUseLocalFallback(true)
    } else {
      setImageError(true)
    }
  }

  return (
    <Link
      href={`/${category.slug}`}
      className={cn(
        "group relative flex w-full h-[200px] sm:h-[240px] md:h-[260px] lg:h-[280px] overflow-hidden rounded-[20px] bg-white p-6 sm:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
        className
      )}
    >
      {/* Category Name top-left in bold */}
      <div className="z-10 flex flex-col text-left">
        <span className="font-bold text-2xl sm:text-3xl text-black tracking-tight leading-tight">
          {category.name}
        </span>
        {category.count !== undefined && (
          <span className="mt-1 text-xs sm:text-sm font-medium text-black/70">
            {category.count} {category.count === 1 ? "product" : "products"}
          </span>
        )}
      </div>

      {/* Arrow icon that fades in at top-right on hover */}
      <div
        className="absolute top-5 right-5 sm:top-7 sm:right-7 z-10 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm"
        aria-hidden="true"
      >
        <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>

      {/* Image or Soft Gradient + Large Lucide Icon Fallback */}
      {!imageError ? (
        <div className="absolute right-0 top-0 bottom-0 w-3/5 sm:w-1/2 overflow-hidden pointer-events-none">
          <Image
            src={imageSrc}
            alt={category.name}
            fill
            unoptimized
            className="object-cover object-center transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100 select-none"
            sizes="(min-width: 1024px) 33vw, 100vw"
            onError={handleImageError}
          />
          {/* Subtle gradient feathering into the white card background */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent" />
        </div>
      ) : (
        <div
          className="absolute -right-6 -bottom-6 flex h-48 w-48 sm:h-56 sm:w-56 items-center justify-center rounded-full bg-gradient-to-br from-black/[0.04] to-black/[0.08] transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100 pointer-events-none"
          aria-hidden="true"
        >
          <Icon className="h-24 w-24 sm:h-28 sm:w-28 text-black/15 transition-transform duration-500 group-hover:scale-110 group-hover:text-black/25 motion-reduce:group-hover:scale-100" />
        </div>
      )}
    </Link>
  )
}

export function CategoriesSection({ categories }: CategoriesSectionProps) {
  // Use 4 categories for the bento grid
  const bentoCategories = categories.slice(0, 4)

  if (bentoCategories.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Large #F0EEED container with rounded-[40px] */}
      <div className="rounded-[40px] bg-[#F0EEED] px-6 py-10 sm:px-12 sm:py-16 md:px-16 md:py-20 text-center">
        {/* Centered .font-display heading */}
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-black mb-8 sm:mb-14">
          BROWSE BY CATEGORY
        </h2>

        {/* Bento grid: 4 tiles, 1/3 + 2/3 row 1, 2/3 + 1/3 row 2 on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {bentoCategories.map((category, index) => {
            const bentoSpan = BENTO_CLASSES[index] ?? "md:col-span-1"

            return (
              <div key={category.id} className={cn("w-full", bentoSpan)}>
                <Reveal delay={index * 0.08}>
                  <CategoryTile category={category} />
                </Reveal>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
