"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { Sparkles, ArrowUp } from "lucide-react"
import { AssistantHeader } from "@/components/ai-assistant/AssistantHeader"
import { SuggestedPrompts } from "@/components/ai-assistant/SuggestedPrompts"

export interface ChatPanelShellProps {
  onPromptSelect?: (text: string) => void
}

export function ChatPanelShell({ onPromptSelect }: ChatPanelShellProps) {
  const t = useTranslations("assistant")

  return (
    <section
      role="region"
      aria-label={t("chatRegionAria")}
      className="flex flex-col justify-between w-full h-[clamp(580px,calc(100dvh-13rem),800px)] rounded-[20px] border border-black/10 bg-white shadow-xs overflow-hidden"
    >
      {/* Top Bar */}
      <AssistantHeader />

      {/* Welcome State (Center) */}
      <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 sm:py-10 flex flex-col items-center justify-center text-center">
        {/* Large Sparkle Icon with Soft Pulsing Glow */}
        <div className="relative mb-5 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full bg-black/10 blur-xl animate-sparkle-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
          <div
            className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-black text-white shadow-[0_4px_20px_rgba(0,0,0,0.18)]"
            aria-hidden="true"
          >
            <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 animate-sparkle-pulse motion-reduce:animate-none" />
          </div>
        </div>

        {/* The ONLY H1 on the page */}
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight text-black max-w-xl leading-[1.08]">
          {t("welcomeHeading")}
        </h1>

        {/* Short Muted Description */}
        <p className="mt-3 text-xs sm:text-sm text-black/60 max-w-md leading-relaxed">
          {t("welcomeDescription")}
        </p>

        {/* 6 Suggested Prompts Chips */}
        <div className="mt-6 sm:mt-8 w-full">
          <SuggestedPrompts onPromptSelect={onPromptSelect} />
        </div>
      </div>

      {/* Visually Complete Input Bar (Disabled) */}
      <div className="p-3 sm:p-5 border-t border-black/10 bg-white">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="relative flex flex-col items-center"
        >
          <div className="relative flex w-full items-center rounded-full bg-[#F0EEED] p-1.5 sm:p-2 border border-transparent focus-within:border-black/20 transition-all">
            <input
              type="text"
              disabled
              aria-disabled="true"
              placeholder={t("inputPlaceholder")}
              aria-label={t("inputAriaLabel")}
              className="flex-1 bg-transparent px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-black/70 placeholder:text-black/40 focus:outline-none cursor-not-allowed select-none"
            />

            {/* Character count / hint */}
            <span
              className="hidden sm:inline-block pr-3 text-[11px] font-medium text-black/40 select-none"
              aria-hidden="true"
            >
              {t("characterCount")}
            </span>

            {/* Black Circular Send Button (Disabled) */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-label={t("sendAriaLabel")}
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-xs opacity-50 cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>

          {/* Visible Note "Chat coming soon" */}
          <div className="mt-2 flex items-center gap-1.5 text-center">
            <span
              className="h-1.5 w-1.5 rounded-full bg-amber-500"
              aria-hidden="true"
            />
            <p className="text-[11px] sm:text-xs font-medium text-black/50">
              {t("chatComingSoon")}
            </p>
          </div>
        </form>
      </div>
    </section>
  )
}

