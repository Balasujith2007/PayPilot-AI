"use client"

import React, { useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Star, Package, ShoppingBag, Check, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { useCartStore } from "@/store/cart"
import { toast } from "sonner"
import type { CatalogProduct } from "@/types/ai-assistant"

export interface ComparisonTableProps {
  products: CatalogProduct[]
  reasons?: Record<string, string>
}

export function ComparisonTable({ products, reasons = {} }: ComparisonTableProps) {
  const t = useTranslations("assistant")
  const addToCart = useCartStore((s) => s.addItem)

  // Compute Lowest Price and Highest Rated winner IDs
  const { lowestPriceId, highestRatedId } = useMemo(() => {
    if (products.length === 0) return { lowestPriceId: null, highestRatedId: null }

    let minPrice = Infinity
    let minId: string | null = null
    let maxRating = -1
    let maxRatingId: string | null = null

    products.forEach((p) => {
      const lowestVariantPrice = Math.min(...p.variants.map((v) => v.price))
      if (lowestVariantPrice < minPrice) {
        minPrice = lowestVariantPrice
        minId = p.id
      }
      if (p.rating > maxRating && p.rating > 0) {
        maxRating = p.rating
        maxRatingId = p.id
      }
    })

    return {
      lowestPriceId: minId,
      highestRatedId: maxRatingId,
    }
  }, [products])

  const handleAddToCart = (product: CatalogProduct, e: React.MouseEvent) => {
    e.preventDefault()
    const defaultVariant = product.variants[0]
    if (!defaultVariant) return

    addToCart({
      variantId: defaultVariant.id,
      productId: product.id,
      name: product.name,
      variantName: defaultVariant.name,
      image: product.image ?? { url: "", alt: product.name },
      slug: product.slug,
      price: defaultVariant.price,
      quantity: 1,
    })

    toast.success(t("addedToCart"))
  }

  if (products.length === 0) return null

  return (
    <div className="w-full overflow-x-auto border border-black/10 rounded-[16px] bg-white scrollbar-thin">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{t("compareTableCaption")}</caption>

        {/* Product Columns Header */}
        <thead>
          <tr className="border-b border-black/10 bg-[#F0EEED]/60">
            <th
              scope="col"
              className="sticky left-0 z-20 bg-[#F0EEED] p-3 sm:p-4 text-xs font-bold uppercase tracking-wider text-black/70 min-w-[120px] sm:min-w-[150px]"
            >
              {t("rowProduct")}
            </th>
            {products.map((product) => {
              const defaultVariant = product.variants[0]
              const lowestPrice = Math.min(...product.variants.map((v) => v.price))
              const formattedPrice = formatPrice(lowestPrice, defaultVariant?.currency)

              const isLowestPrice = product.id === lowestPriceId && products.length > 1
              const isHighestRated = product.id === highestRatedId && products.length > 1

              return (
                <th
                  key={product.id}
                  scope="col"
                  className="p-3 sm:p-4 min-w-[200px] sm:min-w-[240px] max-w-[260px] align-top font-normal"
                >
                  <div className="flex flex-col items-start gap-2">
                    {/* Highlight Pills */}
                    <div className="flex flex-wrap gap-1.5 min-h-[22px]">
                      {isLowestPrice && (
                        <span className="rounded-full bg-[#10B981]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#047857]">
                          {t("lowestPrice")}
                        </span>
                      )}
                      {isHighestRated && (
                        <span className="rounded-full bg-[#FFC633]/25 px-2.5 py-0.5 text-[10px] font-bold text-black">
                          {t("highestRated")}
                        </span>
                      )}
                    </div>

                    {/* Image */}
                    <div className="relative aspect-square w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-[#F0EEED] overflow-hidden border border-black/5">
                      {product.image?.url ? (
                        <Image
                          src={product.image.url}
                          alt={product.image.alt || product.name}
                          fill
                          unoptimized={Boolean(product.image.url?.startsWith("data:") || product.image.url?.startsWith("http"))}
                          sizes="112px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-black/30">
                          <Package className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <Link
                      href={`/${product.slug}`}
                      className="font-bold text-sm sm:text-base text-black hover:underline line-clamp-2 break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-xs"
                    >
                      {product.name}
                    </Link>

                    <p className="font-bold text-base sm:text-lg text-black">
                      {formattedPrice}
                    </p>
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody className="divide-y divide-black/10">
          {/* Price Row */}
          <tr>
            <th
              scope="row"
              className="sticky left-0 z-10 bg-white p-3 sm:p-4 text-xs font-semibold text-black/70 border-r border-black/5"
            >
              {t("rowPrice")}
            </th>
            {products.map((p) => {
              const lowestPrice = Math.min(...p.variants.map((v) => v.price))
              return (
                <td key={p.id} className="p-3 sm:p-4 font-bold text-black">
                  {formatPrice(lowestPrice, p.variants[0]?.currency)}
                </td>
              )
            })}
          </tr>

          {/* Rating Row */}
          <tr>
            <th
              scope="row"
              className="sticky left-0 z-10 bg-white p-3 sm:p-4 text-xs font-semibold text-black/70 border-r border-black/5"
            >
              {t("rowRating")}
            </th>
            {products.map((p) => (
              <td key={p.id} className="p-3 sm:p-4 text-black">
                {p.rating > 0 ? (
                  <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm">
                    <Star className="h-4 w-4 fill-[#FFC633] text-[#FFC633]" />
                    <span>{p.rating.toFixed(1)} / 5</span>
                    <span className="text-black/60 font-normal">({p.reviewCount})</span>
                  </div>
                ) : (
                  <span className="text-black/60 text-xs">—</span>
                )}
              </td>
            ))}
          </tr>

          {/* Brand Row */}
          <tr>
            <th
              scope="row"
              className="sticky left-0 z-10 bg-white p-3 sm:p-4 text-xs font-semibold text-black/70 border-r border-black/5"
            >
              {t("rowBrand")}
            </th>
            {products.map((p) => (
              <td key={p.id} className="p-3 sm:p-4 text-black font-medium">
                {p.brandName || "—"}
              </td>
            ))}
          </tr>

          {/* Category Row */}
          <tr>
            <th
              scope="row"
              className="sticky left-0 z-10 bg-white p-3 sm:p-4 text-xs font-semibold text-black/70 border-r border-black/5"
            >
              {t("rowCategory")}
            </th>
            {products.map((p) => (
              <td key={p.id} className="p-3 sm:p-4 text-black/80">
                {p.categoryNames.join(", ") || "—"}
              </td>
            ))}
          </tr>

          {/* Stock Status */}
          <tr>
            <th
              scope="row"
              className="sticky left-0 z-10 bg-white p-3 sm:p-4 text-xs font-semibold text-black/70 border-r border-black/5"
            >
              {t("rowStock")}
            </th>
            {products.map((p) => {
              const inStock = p.variants.some(
                (v) => v.inventory.quantity > 0 || v.inventory.allowBackorder
              )
              return (
                <td key={p.id} className="p-3 sm:p-4">
                  {inStock ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#047857]">
                      <Check className="h-3.5 w-3.5" />
                      <span>{t("inStock")}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                      <X className="h-3.5 w-3.5" />
                      <span>{t("outOfStock")}</span>
                    </span>
                  )}
                </td>
              )
            })}
          </tr>

          {/* Variants Count */}
          <tr>
            <th
              scope="row"
              className="sticky left-0 z-10 bg-white p-3 sm:p-4 text-xs font-semibold text-black/70 border-r border-black/5"
            >
              {t("rowVariants")}
            </th>
            {products.map((p) => (
              <td key={p.id} className="p-3 sm:p-4 text-black/80 font-medium">
                {t("optionsCount", { count: p.variants.length })}
              </td>
            ))}
          </tr>

          {/* Key Tags */}
          <tr>
            <th
              scope="row"
              className="sticky left-0 z-10 bg-white p-3 sm:p-4 text-xs font-semibold text-black/70 border-r border-black/5"
            >
              {t("rowTags")}
            </th>
            {products.map((p) => (
              <td key={p.id} className="p-3 sm:p-4">
                <div className="flex flex-wrap gap-1">
                  {p.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#F0EEED] px-2 py-0.5 text-[10px] font-medium text-black/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </td>
            ))}
          </tr>

          {/* Reason */}
          {Object.keys(reasons).length > 0 && (
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-white p-3 sm:p-4 text-xs font-semibold text-black/70 border-r border-black/5"
              >
                {t("rowReason")}
              </th>
              {products.map((p) => (
                <td key={p.id} className="p-3 sm:p-4 text-xs text-black/60 italic leading-relaxed">
                  {reasons[p.id] || "—"}
                </td>
              ))}
            </tr>
          )}

          {/* Action Row */}
          <tr>
            <th
              scope="row"
              className="sticky left-0 z-10 bg-white p-3 sm:p-4 text-xs font-semibold text-black/70 border-r border-black/5"
            >
              {t("rowAction")}
            </th>
            {products.map((product) => {
              const inStock = product.variants.some(
                (v) => v.inventory.quantity > 0 || v.inventory.allowBackorder
              )
              const isSingleVariant = product.variants.length === 1

              return (
                <td key={product.id} className="p-3 sm:p-4 align-middle">
                  {!inStock ? (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-full bg-black/10 text-black/40 text-xs font-semibold py-2.5 min-h-[44px] cursor-not-allowed select-none"
                    >
                      {t("outOfStock")}
                    </button>
                  ) : isSingleVariant ? (
                    <button
                      type="button"
                      onClick={(e) => handleAddToCart(product, e)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-black text-white text-xs font-semibold py-2.5 min-h-[44px] hover:bg-black/85 active:scale-95 motion-reduce:active:scale-100 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1 cursor-pointer"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span>{t("addToCart")}</span>
                    </button>
                  ) : (
                    <Link
                      href={`/${product.slug}`}
                      className="w-full inline-flex items-center justify-center gap-1 rounded-full border border-black/20 bg-white text-black text-xs font-semibold py-2.5 min-h-[44px] hover:bg-[#F0EEED] active:scale-95 motion-reduce:active:scale-100 transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1"
                    >
                      <span>{t("viewProduct")} &rarr;</span>
                    </Link>
                  )}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

