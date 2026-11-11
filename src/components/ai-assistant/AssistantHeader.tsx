"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { Sparkles } from "lucide-react"

export function AssistantHeader() {
  const t = useTranslations("assistant")

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-black/10 bg-white">
      {/* Brand info */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-xs"
          aria-hidden="true"
        >
          <Sparkles className="h-4 w-4 animate-sparkle-spin motion-reduce:animate-none" />
        </div>
        <div>
          <p className="font-bold text-sm sm:text-base text-black tracking-tight leading-tight">
            {t("headerTitle")}
          </p>
          <p className="text-xs text-black/60 leading-tight">
            {t("headerSubtitle")}
          </p>
        </div>
      </div>

      {/* Action pills (disabled in shell) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="rounded-full border border-black/15 bg-white px-3.5 py-1.5 text-xs font-medium text-black/40 cursor-not-allowed opacity-70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          aria-label={t("clearConversation")}
        >
          {t("clearConversation")}
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="rounded-full border border-black/15 bg-white px-3.5 py-1.5 text-xs font-medium text-black/40 cursor-not-allowed opacity-70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          aria-label={t("compare")}
        >
          {t("compare")}
        </button>
      </div>
    </header>
  )
}

