import Link from "next/link"
import { cn } from "@/lib/utils"
import type { PaginationMeta } from "@/types"
import { ArrowLeft, ArrowRight } from "lucide-react"

interface PaginationProps {
  pagination: PaginationMeta
  basePath: string
  searchParams?: Record<string, string>
  className?: string
}

export function Pagination({
  pagination,
  basePath,
  searchParams = {},
  className,
}: PaginationProps) {
  const { page, totalPages, hasNext, hasPrev } = pagination

  if (totalPages <= 1) return null

  function buildHref(pageNum: number) {
    const params = new URLSearchParams(searchParams)
    params.set("page", String(pageNum))
    return `${basePath}?${params.toString()}`
  }

  // Generate page numbers with ellipsis (e.g. 1, 2, 3, ..., 8, 9, 10)
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
      return pages
    }

    pages.push(1)

    if (page > 3) {
      pages.push("ellipsis")
    }

    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (page < totalPages - 2) {
      pages.push("ellipsis")
    }

    pages.push(totalPages)
    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <nav
      className={cn(
        "flex w-full items-center justify-between border-t border-black/10 pt-6 mt-8 sm:mt-12",
        className
      )}
      aria-label="Pagination"
    >
      {/* Previous Button */}
      {hasPrev ? (
        <Link
          href={buildHref(page - 1)}
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-black transition-colors hover:bg-black/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          aria-label="Previous page"
        >
          <ArrowLeft className="size-4" />
          <span>Previous</span>
        </Link>
      ) : (
        <span
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-black/40 pointer-events-none"
          aria-disabled="true"
        >
          <ArrowLeft className="size-4" />
          <span>Previous</span>
        </span>
      )}

      {/* Numbered Page Buttons with active gray square */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {pageNumbers.map((p, idx) => {
          if (p === "ellipsis") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="flex size-9 sm:size-10 items-center justify-center text-xs sm:text-sm text-black/40"
              >
                &hellip;
              </span>
            )
          }

          const isActive = p === page

          return (
            <Link
              key={p}
              href={buildHref(p)}
              className={cn(
                "flex size-9 sm:size-10 items-center justify-center rounded-lg text-xs sm:text-sm font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black",
                isActive
                  ? "bg-black/5 text-black font-bold"
                  : "text-black/60 hover:text-black hover:bg-black/5"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {p}
            </Link>
          )
        })}
      </div>

      {/* Next Button */}
      {hasNext ? (
        <Link
          href={buildHref(page + 1)}
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-black transition-colors hover:bg-black/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          aria-label="Next page"
        >
          <span>Next</span>
          <ArrowRight className="size-4" />
        </Link>
      ) : (
        <span
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-black/40 pointer-events-none"
          aria-disabled="true"
        >
          <span>Next</span>
          <ArrowRight className="size-4" />
        </span>
      )}
    </nav>
  )
}
