"use client"

import React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { ChevronRight } from "lucide-react"
import { ChatInterface } from "@/components/ai-assistant/chat/ChatInterface"
import { RecommendationsPanelShell } from "@/components/ai-assistant/RecommendationsPanelShell"
import { Reveal } from "@/components/ui/scroll-reveal"

export function ShoppingAssistant() {
  const t = useTranslations("assistant")

  return (
    <div className="w-full bg-white overflow-x-hidden min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto max-w-[1440px] px-2.5 py-2.5 sm:px-6 sm:py-6 lg:px-8">
        {/* Breadcrumb: Home > AI Assistant */}
        <Reveal>
          <nav aria-label="Breadcrumb" className="mb-2.5 sm:mb-6">
            <ol className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-black/60">
              <li>
                <Link
                  href="/"
                  className="hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-xs"
                >
                  {t("breadcrumbHome")}
                </Link>
              </li>
              <li aria-hidden="true" className="text-black/30">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li className="font-medium text-black" aria-current="page">
                {t("breadcrumbAssistant")}
              </li>
            </ol>
          </nav>
        </Reveal>

        {/* 2-Column Grid: Left Chat (~2/3), Right Recommendations (~1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-start">
          {/* Left Column: Chat Area */}
          <div className="w-full lg:col-span-8 animate-fade-up [animation-delay:0.05s] motion-reduce:animate-none">
            <ChatInterface />
          </div>

          {/* Right Column: Recommendations Panel */}
          <div className="w-full lg:col-span-4 animate-fade-up [animation-delay:0.15s] motion-reduce:animate-none">
            <RecommendationsPanelShell />
          </div>
        </div>
      </div>
    </div>
  )
}
