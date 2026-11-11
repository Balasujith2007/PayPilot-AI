"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { Sparkles } from "lucide-react"

export function AssistantHeader() {
  const t = useTranslations("assistant")

  return (
    <header className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3.5 border-b border-black/10 bg-white shrink-0">
      {/* Brand info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div
          className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-xs"
          aria-hidden="true"
        >
          <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-sparkle-spin motion-reduce:animate-none" />
        </div>
        <div className="min-w-0 truncate">
          <p className="font-bold text-xs sm:text-base text-black tracking-tight leading-tight truncate">
            {t("headerTitle")}
          </p>
          <p className="text-[10px] sm:text-xs text-black/60 leading-tight truncate">
            {t("headerSubtitle")}
          </p>
        </div>
      </div>

      {/* Action pills (disabled in shell) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="rounded-full border border-black/15 bg-white px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-medium text-black/40 cursor-not-allowed opacity-70 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          aria-label={t("clearConversation")}
        >
          {t("clearConversation")}
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="rounded-full border border-black/15 bg-white px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-medium text-black/40 cursor-not-allowed opacity-70 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          aria-label={t("compare")}
        >
          {t("compare")}
        </button>
      </div>
    </header>
  )
}

