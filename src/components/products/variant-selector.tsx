"use client"

import React from "react"
import { Check } from "lucide-react"
import type { ProductVariant } from "@/types"
import { cn } from "@/lib/utils"

interface VariantSelectorProps {
  variants: ProductVariant[]
  selectedVariantId: string
  onSelect: (variantId: string) => void
}

const COLOR_HEX_MAP: Record<string, string> = {
  black: "#111111",
  white: "#FFFFFF",
  "space gray": "#4A4D52",
  "space-gray": "#4A4D52",
  silver: "#E5E7EB",
  navy: "#1E293B",
  blue: "#2563EB",
  red: "#DC2626",
  olive: "#4D533C",
  green: "#15803D",
  brown: "#78350F",
  walnut: "#5C4033",
  midnight: "#0F172A",
  natural: "#D4C5B9",
  charcoal: "#374151",
  slate: "#64748B",
  tan: "#D2B48C",
  khaki: "#C3B091",
  cream: "#FDFBF7",
  beige: "#F5F5DC",
  gray: "#6B7280",
  grey: "#6B7280",
  gold: "#D4AF37",
  yellow: "#FBBF24",
  orange: "#F97316",
}

function isLightColor(colorName: string): boolean {
  const c = colorName.toLowerCase().trim()
  return (
    c === "white" ||
    c === "silver" ||
    c === "cream" ||
    c === "beige" ||
    c === "natural" ||
    c === "yellow"
  )
}

export function VariantSelector({
  variants,
  selectedVariantId,
  onSelect,
}: VariantSelectorProps) {
  // If product has 1 or fewer variants, do not render
  if (!variants || variants.length <= 1) return null

  // Group options by option name (e.g., "Color", "Size")
  const optionGroups = new Map<string, string[]>()
  for (const variant of variants) {
    for (const option of variant.options) {
      if (!optionGroups.has(option.name)) {
        optionGroups.set(option.name, [])
      }
      const list = optionGroups.get(option.name)!
      if (!list.includes(option.value)) {
        list.push(option.value)
      }
    }
  }

  if (optionGroups.size === 0) return null

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0]

  return (
    <div className="space-y-5">
      {Array.from(optionGroups.entries()).map(([optionName, values]) => {
        const isColorGroup = optionName.toLowerCase() === "color"
        const isSizeGroup = optionName.toLowerCase() === "size"

        // Display heading matches SHOP.CO reference
        const groupTitle = isColorGroup
          ? "Select Colors"
          : isSizeGroup
            ? "Choose Size"
            : `Select ${optionName}`

        return (
          <div key={optionName}>
            <span className="block text-xs sm:text-sm font-normal text-black/60 mb-3">
              {groupTitle}
            </span>

            {isColorGroup ? (
              /* Color Swatches: circular swatches with checkmark and bounce */
              <div className="flex flex-wrap items-center gap-3">
                {values.map((colorValue) => {
                  const matchingVariant = variants.find((v) =>
                    v.options.some(
                      (o) => o.name === optionName && o.value === colorValue
                    )
                  )
                  const isSelected = selectedVariant?.options.some(
                    (o) => o.name === optionName && o.value === colorValue
                  )
                  const hex =
                    COLOR_HEX_MAP[colorValue.toLowerCase().trim()] ?? "#4A4D52"
                  const light = isLightColor(colorValue)

                  return (
                    <button
                      key={colorValue}
                      type="button"
                      onClick={() => matchingVariant && onSelect(matchingVariant.id)}
                      aria-label={`Color ${colorValue}`}
                      aria-pressed={isSelected}
                      style={{ backgroundColor: hex }}
                      className={cn(
                        "relative h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-black/10 transition-transform active:scale-90 hover:scale-105 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
                        isSelected && "ring-2 ring-black ring-offset-2 shadow-xs"
                      )}
                    >
                      {isSelected && (
                        <Check
                          className={cn(
                            "h-4 w-4 stroke-[2.5] transition-transform animate-scale-in",
                            light ? "text-black" : "text-white"
                          )}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              /* Size & other options: pill chips (selected = black pill) */
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {values.map((value) => {
                  const matchingVariant = variants.find((v) =>
                    v.options.some(
                      (o) => o.name === optionName && o.value === value
                    )
                  )
                  const isSelected = selectedVariant?.options.some(
                    (o) => o.name === optionName && o.value === value
                  )
                  const isAvailable =
                    matchingVariant &&
                    (matchingVariant.inventory.quantity > 0 ||
                      matchingVariant.inventory.allowBackorder)

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => matchingVariant && onSelect(matchingVariant.id)}
                      disabled={!isAvailable}
                      aria-label={`${optionName}: ${value}`}
                      aria-pressed={isSelected}
                      className={cn(
                        "rounded-full px-5 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-medium transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
                        isSelected
                          ? "bg-black text-white shadow-xs"
                          : "bg-[#F0EEED] text-black/60 hover:text-black hover:bg-[#EAE8E7]",
                        !isAvailable && "opacity-40 cursor-not-allowed line-through"
                      )}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
