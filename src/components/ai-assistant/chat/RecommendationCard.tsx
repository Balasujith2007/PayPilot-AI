"use client"

import React, { memo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Star, Package, ShoppingBag } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { useCartStore } from "@/store/cart"
import { CompareToggle } from "@/components/ai-assistant/compare/CompareToggle"
import { toast } from "sonner"
import type { CatalogProduct } from "@/types/ai-assistant"

export interface RecommendationCardProps {
  product: CatalogProduct
  reason?: string
  isMock?: boolean
}

export const RecommendationCard = memo(function RecommendationCard({
  product,
  reason,
  isMock = false,
}: RecommendationCardProps) {
  const t = useTranslations("assistant")
  const [imageError, setImageError] = useState(false)
  const addToCart = useCartStore((s) => s.addItem)

  const defaultVariant = product.variants[0]
  if (!defaultVariant) return null

  // Lowest variant price
  const lowestPrice = Math.min(...product.variants.map((v) => v.price))
  const formattedPrice = formatPrice(lowestPrice, defaultVariant.currency)

  // In-stock status
  const inStock = product.variants.some(
    (v) => v.inventory.quantity > 0 || v.inventory.allowBackorder
  )

  const isSingleVariant = product.variants.length === 1

  const image = product.image
  const isMissingImage = !image?.url || image.url.includes("placeholder.svg") || imageError

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    addToCart({
      variantId: defaultVariant.id,
      productId: product.id,
      name: product.name,
      variantName: defaultVariant.name,
      image: image ?? { url: "", alt: product.name },
      slug: product.slug,
      price: defaultVariant.price,
      quantity: 1,
    })

    toast.success(t("addedToCart"))
  }

  return (
    <div
      role="listitem"
      className="group relative flex flex-col justify-between rounded-[20px] bg-white border border-black/10 p-3 sm:p-3.5 shadow-2xs hover:shadow-xs transition-shadow duration-200"
    >
      <div>
        {/* Clickable Card Link with Descriptive Aria-Label */}
        <Link
          href={`/${product.slug}`}
          aria-label={`${product.name}, ${formattedPrice}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-[16px]"
        >
          {/* Image Tile with Reserved Aspect Ratio */}
          <div className="relative aspect-square w-full overflow-hidden rounded-[16px] bg-[#F0EEED]">
            {isMock && (
              <span className="absolute top-2 left-2 z-10 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs select-none">
                {t("demoPick")}
              </span>
            )}

            {/* Compare Toggle Pill on Top Right */}
            <div
              className="absolute top-1.5 right-1.5 z-20"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <CompareToggle productId={product.id} />
            </div>

            {isMissingImage ? (
              <div className="flex h-full w-full items-center justify-center bg-[#F0EEED]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-xs">
                  <Package className="h-6 w-6 text-black/30" />
                </div>
              </div>
            ) : (
              <Image
                src={image.url}
                alt={image.alt || product.name}
                fill
                sizes="(max-width: 640px) 240px, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:group-hover:scale-100"
                onError={() => setImageError(true)}
              />
            )}
          </div>

          {/* Product Meta */}
          <div className="mt-2.5">
            <h3 className="text-xs sm:text-sm font-bold text-black tracking-tight line-clamp-1 group-hover:underline">
              {product.name}
            </h3>

            {/* Rating if present */}
            {product.rating > 0 && (
              <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-black">
                <Star className="h-3 w-3 fill-[#FFC633] text-[#FFC633]" aria-hidden="true" />
                <span>{product.rating.toFixed(1)}</span>
                {product.reviewCount > 0 && (
                  <span className="text-black/40 font-normal">({product.reviewCount})</span>
                )}
              </div>
            )}

            {/* Price */}
            <p className="mt-1 text-sm sm:text-base font-bold text-black tracking-tight">
              {formattedPrice}
            </p>
          </div>
        </Link>

        {/* Reason Line (Plain Text) */}
        {reason && (
          <p className="mt-2 text-[11px] sm:text-xs text-black/60 line-clamp-2 leading-relaxed">
            {reason}
          </p>
        )}
      </div>

      {/* Action Button: Add to Cart (single variant) vs View Product (multivariant) vs Out of Stock */}
      <div className="mt-3 pt-2 border-t border-black/5">
        {!inStock ? (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="w-full flex items-center justify-center rounded-full bg-black/5 text-black/40 text-xs font-semibold py-2.5 min-h-[44px] cursor-not-allowed select-none"
          >
            {t("outOfStock")}
          </button>
        ) : isSingleVariant ? (
          <button
            type="button"
            onClick={handleAddToCart}
            className="w-full flex items-center justify-center gap-1.5 rounded-full bg-black text-white text-xs font-semibold py-2.5 hover:bg-black/85 active:scale-95 transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1"
            aria-label={`${t("addToCart")} ${product.name}`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>{t("addToCart")}</span>
          </button>
        ) : (
          <Link
            href={`/${product.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full flex items-center justify-center gap-1 rounded-full border border-black/20 bg-white text-black text-xs font-semibold py-2.5 hover:bg-[#F0EEED] active:scale-95 transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1 text-center"
            aria-label={`${t("viewProduct")} ${product.name}`}
          >
            <span>{t("viewProduct")} &rarr;</span>
          </Link>
        )}
      </div>
    </div>
  )
})
