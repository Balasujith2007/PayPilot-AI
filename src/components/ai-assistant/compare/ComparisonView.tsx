"use client"

import React, { useMemo, useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Sparkles, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { ComparisonTable } from "@/components/ai-assistant/compare/ComparisonTable"
import { useChatStore } from "@/store/chat"
import { useCatalog } from "@/components/ai-assistant/CatalogProvider"
import type { CatalogProduct } from "@/types/ai-assistant"

export function ComparisonView() {
  const t = useTranslations("assistant")
  const compareOpen = useChatStore((s) => s.compareOpen)
  const setCompareOpen = useChatStore((s) => s.setCompareOpen)
  const compareIds = useChatStore((s) => s.compareIds)
  const messages = useChatStore((s) => s.messages)

  const { getById } = useCatalog()

  // Track window width to render Dialog (desktop >= 1024px) or Sheet (mobile/tablet < 1024px)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const checkWidth = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    checkWidth()
    window.addEventListener("resize", checkWidth, { passive: true })
    return () => window.removeEventListener("resize", checkWidth)
  }, [])

  // Resolve compared products
  const comparedProducts = useMemo(() => {
    return compareIds
      .map((id) => getById(id))
      .filter((p): p is CatalogProduct => Boolean(p))
  }, [compareIds, getById])

  // Extract reasons from recommendation history if available
  const reasonsMap = useMemo(() => {
    const reasons: Record<string, string> = {}
    messages.forEach((msg) => {
      msg.products?.forEach((rec) => {
        if (rec.reason && !reasons[rec.productId]) {
          reasons[rec.productId] = rec.reason
        }
      })
    })
    return reasons
  }, [messages])

  if (comparedProducts.length === 0) return null

  // Desktop View: Modal Dialog (lg+)
  if (isDesktop) {
    return (
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-4xl p-6 rounded-[24px] bg-white border border-black/10 shadow-2xl max-h-[90dvh] flex flex-col">
          <DialogHeader className="border-b border-black/10 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-black" aria-hidden="true" />
              <DialogTitle className="font-display text-xl sm:text-2xl font-black uppercase tracking-tight text-black">
                {t("comparisonTitle")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs sm:text-sm text-black/60 mt-1">
              {t("comparisonDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            <ComparisonTable products={comparedProducts} reasons={reasonsMap} />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Mobile / Tablet View: Full-height Sheet (< 1024px)
  return (
    <Sheet open={compareOpen} onOpenChange={setCompareOpen}>
      <SheetContent
        side="bottom"
        className="h-[92dvh] max-h-[92dvh] rounded-t-[24px] p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white border-t border-black/10 flex flex-col"
      >
        <SheetHeader className="border-b border-black/10 pb-3 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-black" aria-hidden="true" />
              <SheetTitle className="font-display text-lg font-black uppercase tracking-tight text-black">
                {t("comparisonTitle")}
              </SheetTitle>
            </div>
            <button
              type="button"
              onClick={() => setCompareOpen(false)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-[#F0EEED] text-black/70 hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer"
              aria-label={t("close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <SheetDescription className="text-xs text-black/60 mt-0.5">
            {t("comparisonDescription")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-3">
          <ComparisonTable products={comparedProducts} reasons={reasonsMap} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

