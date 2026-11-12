"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { Trash2, Minus, Plus, Package } from "lucide-react"
import { formatPrice, cn } from "@/lib/utils"
import { useCartStore } from "@/store/cart"
import type { CartItem as CartItemType } from "@/types"

interface CartItemProps {
  item: CartItemType
}

function parseVariantOptions(variantName: string): { label: string; value: string }[] {
  if (!variantName || variantName.toLowerCase() === "default") return []

  if (variantName.includes(" / ")) {
    const parts = variantName.split(" / ")
    return [
      { label: "Color", value: parts[0] },
      { label: "Size", value: parts[1] },
    ]
  }

  const isSize = /^(xs|s|m|l|xl|xxl|\d+oz|\d+lb|a\d)$/i.test(variantName.trim())
  return [{ label: isSize ? "Size" : "Option", value: variantName }]
}

export function CartItem({ item }: CartItemProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)

  const [isRemoving, setIsRemoving] = useState(false)
  const [imageError, setImageError] = useState(false)
  const prevQuantityRef = useRef(item.quantity)
  const [isFlashing, setIsFlashing] = useState(false)

  const options = parseVariantOptions(item.variantName)

  useEffect(() => {
    if (item.quantity !== prevQuantityRef.current) {
      prevQuantityRef.current = item.quantity
      const flashId = window.requestAnimationFrame(() => setIsFlashing(true))
      const timer = setTimeout(() => setIsFlashing(false), 300)
      return () => {
        window.cancelAnimationFrame(flashId)
        clearTimeout(timer)
      }
    }
  }, [item.quantity])

  function handleRemove() {
    setIsRemoving(true)
    setTimeout(() => {
      removeItem(item.variantId)
    }, 250)
  }

  return (
    <div
      className={cn(
        "flex gap-4 sm:gap-5 py-4 sm:py-6 transition-all duration-300 ease-out",
        isRemoving && "opacity-0 -translate-x-4 max-h-0 py-0 overflow-hidden"
      )}
    >
      {/* Square #F0EEED Image Tile */}
      <Link
        href={`/${item.slug}`}
        className="group relative aspect-square w-24 sm:w-28 lg:w-32 rounded-[16px] bg-[#F0EEED] overflow-hidden shrink-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        tabIndex={0}
      >
        {item.image?.url && !imageError ? (
          <Image
            src={item.image.url}
            alt={item.image.alt ?? item.name}
            fill
            unoptimized
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500 motion-reduce:group-hover:scale-100 select-none"
            sizes="(max-width: 640px) 96px, 128px"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-black/30">
            <Package className="h-8 w-8 stroke-[1.5]" />
          </div>
        )}
      </Link>

      {/* Item Details */}
      <div className="flex flex-1 flex-col justify-between min-w-0">
        <div>
          {/* Name & Red Trash Icon */}
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/${item.slug}`}
              className="font-bold text-base sm:text-lg lg:text-xl text-black hover:underline line-clamp-1 text-left"
            >
              {item.name}
            </Link>

            <button
              type="button"
              onClick={handleRemove}
              aria-label={`Remove ${item.name} from cart`}
              className="text-red-500 hover:text-red-600 transition-colors p-1 -m-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-md active:scale-90"
            >
              <Trash2 className="h-5 w-5 stroke-[1.75]" />
            </button>
          </div>

          {/* Options (Size, Color) if present */}
          {options.length > 0 && (
            <div className="mt-1 space-y-0.5 text-left">
              {options.map((opt, i) => (
                <p key={i} className="text-xs sm:text-sm text-black/60">
                  <span className="text-black font-medium">{opt.label}: </span>
                  <span>{opt.value}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Price & Quantity Stepper */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span
            className={cn(
              "font-bold text-lg sm:text-xl lg:text-2xl text-black transition-transform duration-200 tabular-nums",
              isFlashing && "scale-105 text-black"
            )}
          >
            {formatPrice(item.price)}
          </span>

          {/* Rounded-full gray quantity stepper */}
          <div className="flex items-center justify-between gap-3 rounded-full bg-[#F0EEED] px-3.5 py-1.5 sm:px-4 sm:py-2 select-none">
            <button
              type="button"
              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
              disabled={item.quantity <= 1}
              aria-label={`Decrease quantity of ${item.name}`}
              className="text-black hover:opacity-75 disabled:opacity-30 active:scale-90 transition-transform p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-full"
            >
              <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
            </button>

            <span className="text-xs sm:text-sm font-semibold text-black tabular-nums min-w-[18px] text-center">
              {item.quantity}
            </span>

            <button
              type="button"
              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
              aria-label={`Increase quantity of ${item.name}`}
              className="text-black hover:opacity-75 disabled:opacity-30 active:scale-90 transition-transform p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-full"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
