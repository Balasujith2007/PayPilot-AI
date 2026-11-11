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
      className="flex flex-col justify-between w-full h-[calc(100dvh-10.5rem)] sm:h-[clamp(560px,calc(100dvh-12rem),800px)] rounded-[20px] border border-black/10 bg-white shadow-xs overflow-hidden"
    >
      {/* Top Bar */}
      <AssistantHeader />

      {/* Welcome State (Center) */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 sm:px-8 sm:py-8 flex flex-col text-center">
        <div className="my-auto flex flex-col items-center justify-center py-2">
          {/* Sparkle Icon with Soft Pulsing Glow */}
          <div className="relative mb-3 sm:mb-4 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full bg-black/10 blur-xl animate-sparkle-pulse motion-reduce:animate-none"
              aria-hidden="true"
            />
            <div
              className="relative flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-black text-white shadow-[0_4px_16px_rgba(0,0,0,0.18)]"
              aria-hidden="true"
            >
              <Sparkles className="h-5 w-5 sm:h-7 sm:w-7 animate-sparkle-pulse motion-reduce:animate-none" />
            </div>
          </div>

          {/* The ONLY H1 on the page */}
          <h1 className="font-display text-lg sm:text-2xl lg:text-3xl font-black uppercase tracking-tight text-black max-w-xl leading-[1.15]">
            {t("welcomeHeading")}
          </h1>

          {/* Short Muted Description */}
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-black/60 max-w-md leading-relaxed px-2">
            {t("welcomeDescription")}
          </p>

          {/* 6 Suggested Prompts Chips */}
          <div className="mt-4 sm:mt-6 w-full">
            <SuggestedPrompts onPromptSelect={onPromptSelect} />
          </div>
        </div>
      </div>

      {/* Visually Complete Input Bar (Disabled) */}
      <div className="p-2 sm:p-4 border-t border-black/10 bg-white">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="relative flex flex-col items-center"
        >
          <div className="relative flex w-full items-center rounded-full bg-[#F0EEED] p-1 sm:p-2 border border-transparent focus-within:border-black/20 transition-all">
            <input
              type="text"
              disabled
              aria-disabled="true"
              placeholder={t("inputPlaceholder")}
              aria-label={t("inputAriaLabel")}
              className="flex-1 bg-transparent px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-black/70 placeholder:text-black/40 focus:outline-none cursor-not-allowed select-none truncate"
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
              className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-xs opacity-50 cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              <ArrowUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>

          {/* Visible Note "Chat coming soon" */}
          <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 text-center">
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

