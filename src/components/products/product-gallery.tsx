"use client"

import { useState } from "react"
import Image from "next/image"
import { Package } from "lucide-react"
import type { ProductImage } from "@/types"
import { cn } from "@/lib/utils"

interface ProductGalleryProps {
  images: ProductImage[]
  productName?: string
}

export function ProductGallery({
  images = [],
  productName = "Product",
}: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isFading, setIsFading] = useState(false)
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({})

  // Up to 3 thumbnails for the thumbnail column
  const thumbnails = images.slice(0, 3)
  const currentImage = images[selectedIndex]
  const isMainImageMissing =
    !currentImage || !currentImage.url || failedImages[selectedIndex]

  function handleSelect(index: number) {
    if (index === selectedIndex) return
    setIsFading(true)
    setTimeout(() => {
      setSelectedIndex(index)
      setIsFading(false)
    }, 150)
  }

  function handleImageError(index: number) {
    setFailedImages((prev) => ({ ...prev, [index]: true }))
  }

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-3.5 sm:gap-4 w-full">
      {/* Thumbnails (vertical column on desktop, horizontal row on mobile) — hidden if only 1 image */}
      {images.length > 1 && (
        <div className="flex lg:flex-col gap-3 sm:gap-3.5 overflow-x-auto lg:overflow-visible shrink-0 justify-start sm:justify-center lg:justify-start py-1 lg:py-0">
          {thumbnails.map((image, index) => {
            const isSelected = selectedIndex === index
            const isMissing = !image.url || failedImages[index]

            return (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(index)}
                aria-label={`View image ${index + 1} of ${productName}`}
                aria-pressed={isSelected}
                className={cn(
                  "relative aspect-square w-20 sm:w-24 lg:w-[120px] xl:w-[140px] shrink-0 overflow-hidden rounded-[20px] bg-[#F0EEED] p-1.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black",
                  isSelected
                    ? "border-2 border-black ring-1 ring-black"
                    : "border-2 border-transparent hover:border-black/20 hover:scale-[1.02]"
                )}
              >
                {!isMissing ? (
                  <div className="relative w-full h-full rounded-[14px] overflow-hidden">
                    <Image
                      src={image.url}
                      alt={image.alt || `${productName} thumbnail ${index + 1}`}
                      fill
                      unoptimized
                      sizes="140px"
                      className="object-cover object-center select-none"
                      onError={() => handleImageError(index)}
                    />
                  </div>
                ) : (
                  <div className="flex w-full h-full items-center justify-center text-black/30">
                    <Package className="h-6 w-6 stroke-[1.5]" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Main Image Tile */}
      <div className="relative flex-1 aspect-square sm:aspect-[4/5] lg:aspect-square w-full overflow-hidden rounded-[20px] bg-[#F0EEED] group flex items-center justify-center">
        {!isMainImageMissing ? (
          <div
            className={cn(
              "relative w-full h-full transition-opacity duration-200",
              isFading ? "opacity-0" : "opacity-100"
            )}
          >
            <Image
              src={currentImage.url}
              alt={currentImage.alt || productName}
              fill
              priority
              unoptimized
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center group-hover:scale-105 transition-transform duration-500 motion-reduce:group-hover:scale-100 select-none"
              onError={() => handleImageError(selectedIndex)}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-black/30 select-none">
            <Package className="h-20 w-20 sm:h-24 sm:w-24 stroke-[1.25] mb-2" />
            <span className="text-xs sm:text-sm font-medium text-black/40">
              No preview available
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
