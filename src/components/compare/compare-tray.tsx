"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Scale, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MAX_COMPARE_PRODUCTS, MIN_COMPARE_PRODUCTS } from "@/lib/comparison/compare-products"
import { compareHref, useCompareStore } from "@/store/compare"
import { useHydrated } from "@/hooks/use-hydrated"

/** Floating bar listing the products selected for comparison. */
export function CompareTray() {
  const hydrated = useHydrated()
  const pathname = usePathname()
  const items = useCompareStore((s) => s.items)
  const removeItem = useCompareStore((s) => s.removeItem)
  const clearAll = useCompareStore((s) => s.clearAll)

  const hiddenOn = ["/compare", "/checkout", "/cart"]
  if (!hydrated || items.length === 0 || hiddenOn.some((p) => pathname.startsWith(p))) {
    return null
  }

  const canCompare = items.length >= MIN_COMPARE_PRODUCTS

  return (
    <>
    {/* Spacer so the fixed tray never covers the end of the page */}
    <div aria-hidden className="h-28 sm:h-16" />
    <div
      role="region"
      aria-label="Product comparison"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 pr-16 sm:flex-row sm:items-center sm:px-6 sm:pr-20 lg:px-8 lg:pr-20">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Scale className="h-4 w-4" />
          Compare ({items.length}/{MAX_COMPARE_PRODUCTS})
        </div>
        <ul className="flex flex-1 flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex items-center gap-1 rounded-full border bg-neutral-50 py-1 pr-1 pl-3 text-xs"
            >
              <span className="max-w-[160px] truncate">{item.name}</span>
              <button
                type="button"
                onClick={() => removeItem(item.productId)}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-neutral-200"
                aria-label={`Remove ${item.name} from comparison`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear
          </Button>
          {canCompare ? (
            <Button size="sm" asChild>
              <Link href={compareHref(items.map((i) => i.productId))}>Compare now</Link>
            </Button>
          ) : (
            <Button size="sm" disabled>
              Add {MIN_COMPARE_PRODUCTS - items.length} more to compare
            </Button>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
