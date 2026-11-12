"use client"

import React, { useMemo } from "react"
import { useTranslations } from "next-intl"
import { Sparkles } from "lucide-react"
import { useCatalog } from "@/components/ai-assistant/CatalogProvider"
import { RecommendationCard } from "@/components/ai-assistant/chat/RecommendationCard"
import type { RecommendedProduct, CatalogProduct } from "@/types/ai-assistant"

export interface RecommendationListProps {
  products: RecommendedProduct[]
  isMock?: boolean
}

export function RecommendationList({
  products,
  isMock = false,
}: RecommendationListProps) {
  const t = useTranslations("assistant")
  const { getById } = useCatalog()

  // Resolve products through CatalogProvider; silently skip unresolvable IDs
  const resolvedItems = useMemo(() => {
    return products
      .map((item) => {
        const product = getById(item.productId)
        return product ? { product, reason: item.reason } : null
      })
      .filter(
        (item): item is { product: CatalogProduct; reason: string | undefined } =>
          item !== null
      )
  }, [products, getById])

  // If none resolve, render nothing
  if (resolvedItems.length === 0) return null

  return (
    <div className="mt-4 w-full max-w-full animate-fade-up motion-reduce:animate-none">
      {/* Section Header */}
      <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
        <Sparkles className="h-3.5 w-3.5 text-black" aria-hidden="true" />
        <h4 className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-black/80">
          {t("recommendedForYou")}
        </h4>
      </div>

      {/* Product List: Scroll-snap row on mobile (peek of next card), 2 cols on tablet, 3 on desktop */}
      <div
        role="list"
        aria-label={t("recommendedForYou")}
        className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-2 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0 scrollbar-none"
      >
        {resolvedItems.map(({ product, reason }) => (
          <div
            key={product.id}
            className="w-[230px] sm:w-auto shrink-0 sm:shrink snap-start"
          >
            <RecommendationCard
              product={product}
              reason={reason}
              isMock={isMock}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
