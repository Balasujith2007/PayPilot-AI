"use client"

import React from "react"
import { useTranslations } from "next-intl"

export interface SuggestedPromptsProps {
  onPromptSelect?: (text: string) => void
}

const PROMPT_KEYS = [
  "laptop",
  "phones",
  "gifts",
  "earbuds",
  "compare",
  "accessories",
] as const

export function SuggestedPrompts({
  onPromptSelect = () => {},
}: SuggestedPromptsProps) {
  const t = useTranslations("assistant")

  return (
    <div
      role="region"
      aria-label={t("suggestedPromptsAria")}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
        {PROMPT_KEYS.map((key, index) => {
          const promptText = t(`prompts.${key}`)
          const staggerDelay = `${(index + 1) * 60}ms`

          return (
            <button
              key={key}
              type="button"
              onClick={() => onPromptSelect(promptText)}
              style={{ animationDelay: staggerDelay }}
              className="group inline-flex items-center rounded-full bg-[#F0EEED] px-4 py-2 text-xs sm:text-sm font-medium text-black transition-all duration-200 hover:-translate-y-0.5 hover:bg-black/10 hover:shadow-xs active:scale-[0.98] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 motion-reduce:animate-none animate-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1 text-center"
              aria-label={promptText}
            >
              <span>{promptText}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

