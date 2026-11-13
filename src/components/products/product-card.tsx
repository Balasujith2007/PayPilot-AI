"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Heart, Package, ShoppingBag, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompareToggleButton } from "@/components/compare/compare-toggle-button"
import { formatPrice, cn } from "@/lib/utils"
import { useWishlistStore } from "@/store/wishlist"
import { useCartStore } from "@/store/cart"
import { useHydrated } from "@/hooks/use-hydrated"
import { toast } from "sonner"
import type { Product } from "@/types"

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const [imageError, setImageError] = useState(false)
  const isClient = useHydrated()

  const wishlistItems = useWishlistStore((s) => s.items)
  const addToWishlist = useWishlistStore((s) => s.addItem)
  const removeFromWishlist = useWishlistStore((s) => s.removeItem)
  const addToCart = useCartStore((s) => s.addItem)

  const defaultVariant = product.variants[0]
  if (!defaultVariant) return null

  const price = defaultVariant.price
  const compareAtPrice = defaultVariant.compareAtPrice
  const isOnSale = Boolean(compareAtPrice && compareAtPrice > price)
  const discountPercent =
    isOnSale && compareAtPrice
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
      : null

  const image = product.images[0]
  const isMissingImage =
    !image?.url ||
    image.url === "" ||
    image.url.includes("placeholder.svg") ||
    imageError

  // Real-time stock status across variants
  const totalStock = product.variants.reduce((acc, v) => acc + (v.inventory?.quantity ?? 10), 0)
  const isOutOfStock = totalStock === 0
  const isLowStock = !isOutOfStock && totalStock <= 5

  const isWishlisted =
    isClient && wishlistItems.some((i) => i.productId === product.id)

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (isWishlisted) {
      removeFromWishlist(product.id)
      toast("Removed from wishlist")
    } else {
      addToWishlist({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        price,
        image: image ?? { url: "", alt: product.name },
      })
      toast.success("Added to wishlist")
    }
  }

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    addToCart({
      variantId: defaultVariant.id,
      productId: product.id,
      name: product.name,
      variantName: defaultVariant.name,
      image: image ?? { url: "", alt: product.name },
      slug: product.slug,
      price,
      quantity: 1,
    })
    toast.success(`Added "${product.name}" to cart`)
  }

  return (
    <Link
      href={`/${product.slug}`}
      className="group flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4 rounded-[20px] text-left"
    >
      {/* Square #F0EEED rounded-[20px] image tile */}
      <div className="relative aspect-square w-full overflow-hidden rounded-[20px] bg-[#F0EEED]">
        {isMissingImage ? (
          <div className="flex h-full w-full items-center justify-center bg-[#F0EEED] transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xs">
              <Package className="h-8 w-8 text-black/40" />
            </div>
          </div>
        ) : (
          <Image
            src={image.url}
            alt={image.alt || product.name}
            fill
            unoptimized={Boolean(image.url?.startsWith("data:") || image.url?.startsWith("http"))}
            className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
            onError={() => setImageError(true)}
          />
        )}

        {/* Stock & Discount Badges */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
          {isOutOfStock ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs">
              Out of Stock
            </span>
          ) : isLowStock ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs">
              Only {totalStock} Left
            </span>
          ) : discountPercent ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-white shadow-xs">
              -{discountPercent}%
            </span>
          ) : null}
        </div>

        {/* Wishlist toggle button (hover on desktop, always visible on touch) */}
        <button
          type="button"
          onClick={handleWishlist}
          className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-xs transition-all duration-200 hover:scale-110 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              isWishlisted
                ? "fill-[#FF3333] text-[#FF3333]"
                : "text-black/60 hover:text-black"
            )}
          />
        </button>
        {/* Compare toggle button */}
        <CompareToggleButton product={product} className="absolute top-14 right-2 z-10" />

        {/* Quick add button (slides up on hover, always visible on touch) */}
        <div className="product-quick-add absolute inset-x-3 bottom-3 z-10">
          <Button
            type="button"
            size="sm"
            disabled={isOutOfStock}
            onClick={handleQuickAdd}
            className={cn(
              "w-full gap-2 rounded-full text-xs font-semibold shadow-md focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1",
              isOutOfStock
                ? "bg-zinc-300 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed"
                : "bg-black text-white hover:bg-black/85"
            )}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            {isOutOfStock ? "Sold Out" : "Quick add"}
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="mt-3 flex flex-1 flex-col">
        {/* Name */}
        <h3 className="text-base sm:text-lg font-bold text-black line-clamp-1 transition-colors group-hover:text-black/70">
          {product.name}
        </h3>

        {/* Yellow stars with "4.5/5" */}
        <div className="mt-1 flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "h-3.5 w-3.5 sm:h-4 sm:w-4",
                  star <= Math.floor(product.rating)
                    ? "fill-[#FFC633] text-[#FFC633]"
                    : star - 0.5 <= product.rating
                      ? "fill-[#FFC633]/60 text-[#FFC633]"
                      : "fill-none text-neutral-300"
                )}
              />
            ))}
          </div>
          <span className="text-xs sm:text-sm font-normal text-black">
            <span className="font-semibold text-black">{product.rating}</span>
            <span className="text-black/70">/5</span>
          </span>
        </div>

        {/* Bold ₹ price, struck original price, and pink -20% pill */}
        <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
          <span className="text-lg sm:text-xl font-bold text-black tracking-tight">
            {formatPrice(price, defaultVariant.currency)}
          </span>
          {isOnSale && compareAtPrice && (
            <span className="text-sm sm:text-base font-semibold text-black/60 line-through">
              {formatPrice(compareAtPrice, defaultVariant.currency)}
            </span>
          )}
          {discountPercent && discountPercent > 0 && (
            <span className="rounded-full bg-[#FFEBEB] px-2.5 py-0.5 text-xs font-bold text-[#FF3333]">
              -{discountPercent}%
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
