"use client"

import React, { useEffect } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { X, ArrowRight, Package } from "lucide-react"
import { useChatStore } from "@/store/chat"
import { useCatalog } from "@/components/ai-assistant/CatalogProvider"

export function CompareTray() {
  const t = useTranslations("assistant")
  const compareIds = useChatStore((s) => s.compareIds)
  const removeCompareId = useChatStore((s) => s.removeCompareId)
  const clearCompare = useChatStore((s) => s.clearCompare)
  const setCompareOpen = useChatStore((s) => s.setCompareOpen)

  const { getById } = useCatalog()

  // Clean up any unresolvable IDs silently
  useEffect(() => {
    compareIds.forEach((id) => {
      if (!getById(id)) {
        removeCompareId(id)
      }
    })
  }, [compareIds, getById, removeCompareId])

  if (compareIds.length === 0) return null

  const canCompare = compareIds.length >= 2

  return (
    <aside
      role="region"
      aria-label={t("compareTrayAria")}
      className="w-full border-t border-black/10 bg-[#F0EEED] px-3 py-2 sm:px-4 sm:py-2.5 shrink-0 animate-fade-in"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Thumbnails + Counter */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {compareIds.map((id) => {
              const product = getById(id)
              if (!product) return null
              const image = product.image

              return (
                <div
                  key={id}
                  className="relative group h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white border border-black/10 overflow-hidden shrink-0 shadow-2xs"
                >
                  {image?.url ? (
                    <Image
                      src={image.url}
                      alt={image.alt || product.name}
                      fill
                      unoptimized={Boolean(image.url?.startsWith("data:") || image.url?.startsWith("http"))}
                      sizes="44px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white text-black/60">
                      <Package className="h-4 w-4" />
                    </div>
                  )}

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeCompareId(id)}
                    className="absolute inset-0 min-h-[44px] min-w-[44px] flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer"
                    aria-label={`Remove ${product.name} from comparison`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          <span className="text-xs font-semibold text-black tracking-tight whitespace-nowrap">
            {t("selectedCount", { count: compareIds.length, total: 3 })}
          </span>
        </div>

        {/* Action Controls: Compare now + Clear */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={clearCompare}
            className="inline-flex min-h-[44px] items-center text-xs font-semibold text-black/60 hover:text-black transition-colors px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-full cursor-pointer"
          >
            {t("clearCompare")}
          </button>

          <button
            type="button"
            disabled={!canCompare}
            onClick={() => setCompareOpen(true)}
            aria-disabled={!canCompare}
            title={!canCompare ? t("selectAtLeastTwo") : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all min-h-[44px] ${
              canCompare
                ? "bg-black text-white hover:bg-black/85 active:scale-95 motion-reduce:active:scale-100 shadow-xs cursor-pointer"
                : "bg-black/10 text-black/40 cursor-not-allowed"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1`}
          >
            <span>{t("compareNow")}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}

