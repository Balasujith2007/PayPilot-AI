"use client"

import { useRouter } from "next/navigation"
import { Scale } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MAX_COMPARE_PRODUCTS } from "@/lib/comparison/compare-products"
import { compareHref, useCompareStore } from "@/store/compare"
import { useHydrated } from "@/hooks/use-hydrated"

interface CompareToggleButtonProps {
  product: { id: string; name: string; slug: string }
  /** "icon" for product cards, "button" for the product detail page */
  variant?: "icon" | "button"
  className?: string
}

export function CompareToggleButton({
  product,
  variant = "icon",
  className,
}: CompareToggleButtonProps) {
  const router = useRouter()
  const hydrated = useHydrated()
  const items = useCompareStore((s) => s.items)
  const addItem = useCompareStore((s) => s.addItem)
  const removeItem = useCompareStore((s) => s.removeItem)
  const isSelected = hydrated && items.some((i) => i.productId === product.id)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (isSelected) {
      removeItem(product.id)
      toast("Removed from comparison")
      return
    }
    const result = addItem({ productId: product.id, name: product.name, slug: product.slug })
    if (result === "full") {
      toast.error(`You can compare up to ${MAX_COMPARE_PRODUCTS} products`, {
        description: "Remove a product from the comparison first.",
      })
      return
    }
    const ids = useCompareStore.getState().items.map((i) => i.productId)
    toast.success("Added to comparison", {
      action:
        ids.length >= 2
          ? { label: "Compare", onClick: () => router.push(compareHref(ids)) }
          : undefined,
    })
  }

  const label = isSelected ? "Remove from comparison" : "Add to comparison"

  if (variant === "button") {
    return (
      <Button
        variant="outline"
        size="icon"
        aria-label={label}
        aria-pressed={isSelected}
        title={label}
        onClick={handleClick}
        className={cn(isSelected && "border-foreground bg-accent", className)}
      >
        <Scale className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      aria-pressed={isSelected}
      title={label}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm transition-opacity hover:bg-neutral-50",
        isSelected
          ? "text-foreground ring-2 ring-foreground"
          : "text-neutral-600 sm:opacity-0 sm:group-hover:opacity-100",
        className
      )}
    >
      <Scale className="h-4 w-4" />
    </button>
  )
}
