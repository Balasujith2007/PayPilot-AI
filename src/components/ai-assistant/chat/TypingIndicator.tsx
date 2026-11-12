"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { Sparkles, Package } from "lucide-react"

export function TypingIndicator() {
  const t = useTranslations("assistant")

  return (
    <div
      role="status"
      aria-label={t("assistantTyping")}
      className="flex w-full flex-col items-start animate-fade-up motion-reduce:animate-none"
    >
      <div className="flex w-full max-w-full sm:max-w-[95%] lg:max-w-full gap-2.5">
        {/* Assistant Avatar */}
        <div
          className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-black text-white shadow-xs mt-1"
          aria-hidden="true"
        >
          <Sparkles className="h-4 w-4 animate-sparkle-spin motion-reduce:animate-none" />
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          {/* Typing Bubble with 3 Softly Pulsing Dots */}
          <div className="inline-flex items-center gap-1.5 px-4 py-3 rounded-[20px] rounded-bl-[4px] bg-[#F0EEED] text-black shadow-2xs self-start">
            <span
              className="h-2 w-2 rounded-full bg-black/50 animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]"
              aria-hidden="true"
            />
            <span
              className="h-2 w-2 rounded-full bg-black/50 animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]"
              aria-hidden="true"
            />
            <span
              className="h-2 w-2 rounded-full bg-black/50 animate-bounce motion-reduce:animate-none"
              aria-hidden="true"
            />
            <span className="sr-only">{t("assistantTyping")}</span>
          </div>

          {/* Skeleton Recommendation Cards (Exact same aspect ratio & layout as RecommendationCard) */}
          <div className="mt-4 w-full max-w-full" aria-hidden="true">
            <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-2 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0 scrollbar-none">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-[230px] sm:w-auto shrink-0 sm:shrink snap-start rounded-[20px] bg-white border border-black/10 p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    {/* Square Image Tile Skeleton */}
                    <div className="relative aspect-square w-full rounded-[16px] bg-[#F0EEED] overflow-hidden flex items-center justify-center animate-pulse motion-reduce:animate-none">
                      <Package className="h-8 w-8 text-black/15" />
                    </div>

                    {/* Metadata Skeletons */}
                    <div className="mt-3 space-y-2">
                      <div className="h-3.5 w-3/4 rounded-full bg-[#F0EEED] animate-pulse motion-reduce:animate-none" />
                      <div className="h-3 w-1/3 rounded-full bg-[#F0EEED]/70 animate-pulse motion-reduce:animate-none" />
                      <div className="h-4 w-1/2 rounded-full bg-[#F0EEED] animate-pulse motion-reduce:animate-none pt-1" />
                    </div>

                    {/* Reason line skeleton */}
                    <div className="mt-2.5 h-2.5 w-5/6 rounded-full bg-[#F0EEED]/60 animate-pulse motion-reduce:animate-none" />
                  </div>

                  {/* Button Skeleton */}
                  <div className="mt-3 pt-2 border-t border-black/5">
                    <div className="h-10 w-full rounded-full bg-[#F0EEED] animate-pulse motion-reduce:animate-none" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

