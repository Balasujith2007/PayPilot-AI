"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { Check, Plus } from "lucide-react"
import { useChatStore } from "@/store/chat"
import { toast } from "sonner"

export interface CompareToggleProps {
  productId: string
}

export function CompareToggle({ productId }: CompareToggleProps) {
  const t = useTranslations("assistant")
  const compareIds = useChatStore((s) => s.compareIds)
  const toggleCompare = useChatStore((s) => s.toggleCompare)

  const isSelected = compareIds.includes(productId)
  const isMaxReached = compareIds.length >= 3 && !isSelected

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isMaxReached) {
      toast.warning(t("limitMessage"))
      return
    }

    const success = toggleCompare(productId)
    if (!success) {
      toast.warning(t("limitMessage"))
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isMaxReached}
      aria-pressed={isSelected}
      aria-disabled={isMaxReached}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black ${
        isSelected
          ? "bg-black text-white shadow-xs"
          : isMaxReached
          ? "border border-black/10 bg-black/5 text-black/30 cursor-not-allowed"
          : "border border-black/20 bg-white text-black hover:bg-[#F0EEED] active:scale-95 cursor-pointer"
      }`}
      aria-label={`${t("compare")} ${productId}`}
    >
      {isSelected ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>{t("compare")}</span>
    </button>
  )
}

