"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { Sparkles, Package } from "lucide-react"

export function RecommendationsPanelShell() {
  const t = useTranslations("assistant")

  return (
    <aside
      role="region"
      aria-label={t("recommendationsRegionAria")}
      className="w-full rounded-[20px] bg-[#F0EEED] p-5 sm:p-6 border border-black/5 lg:sticky lg:top-24 shadow-xs"
    >
      {/* Header */}
      <div className="border-b border-black/10 pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-black" aria-hidden="true" />
          <h2 className="font-display text-lg sm:text-xl font-black uppercase tracking-tight text-black">
            {t("recommendationsHeading")}
          </h2>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-black/60">
          {t("recommendationsSubtitle")}
        </p>
      </div>

      {/* Empty State */}
      <div className="py-6 sm:py-8 text-center flex flex-col items-center justify-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black/70 shadow-xs border border-black/5 mb-3"
          aria-hidden="true"
        >
          <Package className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-black">
          {t("noRecommendations")}
        </p>
        <p className="mt-1 max-w-xs text-xs text-black/60 leading-relaxed">
          {t("noRecommendationsDesc")}
        </p>
      </div>

      {/* 2 Neutral Skeleton Product Card Outlines (aria-hidden, placeholder only) */}
      <div
        className="space-y-3 pt-2"
        aria-hidden="true"
      >
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 rounded-2xl bg-white p-3 border border-black/5 shadow-2xs"
          >
            {/* Square placeholder tile */}
            <div className="h-16 w-16 shrink-0 rounded-xl bg-[#F0EEED] flex items-center justify-center text-black/20">
              <Package className="h-6 w-6" />
            </div>

            {/* Skeleton lines */}
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 rounded-full bg-[#F0EEED]" />
              <div className="h-2.5 w-1/2 rounded-full bg-[#F0EEED]/70" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

