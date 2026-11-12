"use client"

import { useState } from "react"
import {
  Star,
  Check,
  MoreHorizontal,
  SlidersHorizontal,
  MessageSquare,
} from "lucide-react"
import { sampleReviews, type ProductReview } from "@/data/sample-reviews"
import { Reveal } from "@/components/home/reveal"
import { cn } from "@/lib/utils"

interface ProductReviewsProps {
  productRating: number
  reviewCount: number
}

export function ProductReviews({
  productRating,
  reviewCount,
}: ProductReviewsProps) {
  // Demo mode flag: load sample reviews ONLY when NEXT_PUBLIC_SHOW_SAMPLE_REVIEWS is "true"
  const showSampleReviews =
    process.env.NEXT_PUBLIC_SHOW_SAMPLE_REVIEWS === "true"

  const [sortOrder, setSortOrder] = useState<"latest" | "highest" | "lowest">(
    "latest"
  )
  const [visibleCount, setVisibleCount] = useState(6)

  // In production with real data, this would read from the product/repository review records.
  // When no real review data exists and demo flag is off, reviews list is empty.
  const allReviews: ProductReview[] = showSampleReviews ? sampleReviews : []

  // Sort reviews
  const sortedReviews = [...allReviews].sort((a, b) => {
    if (sortOrder === "highest") return b.rating - a.rating
    if (sortOrder === "lowest") return a.rating - b.rating
    return 0 // "latest" keeps source chronological order
  })

  const visibleReviews = sortedReviews.slice(0, visibleCount)
  const hasMore = visibleCount < sortedReviews.length

  const displayCount = showSampleReviews
    ? allReviews.length
    : reviewCount > 0
      ? reviewCount
      : 0

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-fade-in text-left">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Title & Count */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="font-bold text-xl sm:text-2xl text-black flex items-center gap-1.5">
            <span>All Reviews</span>
            <span className="text-black/60 font-normal">({displayCount})</span>
            {productRating > 0 && (
              <span className="text-xs sm:text-sm font-semibold text-black/70 flex items-center gap-1 ml-1.5">
                <Star className="h-3.5 w-3.5 fill-[#FFC633] text-[#FFC633]" />
                {productRating.toFixed(1)}/5
              </span>
            )}
          </h3>

          {showSampleReviews && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              Sample reviews
            </span>
          )}
        </div>

        {/* Right: Filter, Sort & Write a Review */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Filter Icon Button */}
          <button
            type="button"
            aria-label="Filter reviews"
            className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-[#F0EEED] text-black hover:bg-[#EAE8E7] transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) =>
                setSortOrder(e.target.value as "latest" | "highest" | "lowest")
              }
              aria-label="Sort reviews"
              className="h-10 sm:h-11 rounded-full bg-[#F0EEED] px-4 pr-8 text-xs sm:text-sm font-medium text-black hover:bg-[#EAE8E7] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black appearance-none"
            >
              <option value="latest">Latest</option>
              <option value="highest">Highest Rating</option>
              <option value="lowest">Lowest Rating</option>
            </select>
            <span
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-black/50 text-xs"
              aria-hidden="true"
            >
              ▾
            </span>
          </div>

          {/* Write a Review Button (disabled with tooltip when submission is not implemented) */}
          <button
            type="button"
            disabled
            title="Review submission coming soon"
            className="rounded-full bg-black text-white hover:bg-black/85 disabled:opacity-50 disabled:cursor-not-allowed px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          >
            Write a Review
          </button>
        </div>
      </div>

      {/* Reviews Content or Empty State */}
      {visibleReviews.length > 0 ? (
        <>
          {/* Two-Column Grid of Review Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {visibleReviews.map((review, index) => (
              <Reveal key={review.id} delay={index * 0.05}>
                <div className="rounded-[20px] border border-black/10 bg-white p-6 sm:p-7 relative transition-all duration-300 hover:-translate-y-1 hover:shadow-xs motion-reduce:hover:translate-y-0 flex flex-col justify-between h-full">
                  <div>
                    {/* Stars and More Menu */}
                    <div className="flex items-center justify-between mb-3.5">
                      <div
                        className="flex items-center gap-0.5"
                        aria-label={`Rating: ${review.rating} out of 5 stars`}
                      >
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "h-4 w-4 sm:h-5 sm:w-5",
                              i < Math.floor(review.rating)
                                ? "fill-[#FFC633] text-[#FFC633]"
                                : "fill-black/10 text-black/10"
                            )}
                            aria-hidden="true"
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        aria-label="Review options"
                        className="text-black/40 hover:text-black transition-colors p-1 -m-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-md"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Author Name + Verified Badge */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="font-bold text-base sm:text-lg text-black">
                        {review.author}
                      </span>
                      {review.verified && (
                        <span
                          className="flex h-4 w-4 sm:h-4.5 sm:w-4.5 items-center justify-center rounded-full bg-[#01AB31] text-white"
                          title="Verified Buyer"
                          aria-label="Verified Buyer"
                        >
                          <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    {/* Quote */}
                    <p className="text-black/60 text-sm sm:text-base leading-relaxed">
                      &ldquo;{review.quote}&rdquo;
                    </p>
                  </div>

                  {/* Date */}
                  <div className="mt-5 sm:mt-6 pt-2 border-t border-black/5">
                    <span className="text-xs sm:text-sm font-medium text-black/40">
                      Posted on {review.date}
                    </span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Centered outlined "Load More Reviews" pill */}
          {hasMore && (
            <div className="flex justify-center pt-4 sm:pt-6">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 4)}
                className="rounded-full border border-black/10 bg-white hover:bg-black/5 px-8 sm:px-10 py-3 text-xs sm:text-sm font-medium text-black transition-all active:scale-95 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              >
                Load More Reviews
              </button>
            </div>
          )}
        </>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center text-center py-12 sm:py-16 rounded-[20px] border border-black/10 bg-[#FAFAFA] p-8">
          <div className="h-16 w-16 rounded-full bg-[#F0EEED] flex items-center justify-center text-black/40 mb-4">
            <MessageSquare className="h-8 w-8 stroke-[1.5]" />
          </div>
          <h4 className="font-bold text-lg sm:text-xl text-black mb-1">
            No reviews yet
          </h4>
          <p className="text-black/60 text-sm max-w-sm mb-6">
            Be the first to review this product once review submissions are open.
          </p>
          <button
            type="button"
            disabled
            title="Review submission coming soon"
            className="rounded-full bg-black text-white px-6 py-2.5 text-xs sm:text-sm font-medium opacity-50 cursor-not-allowed"
          >
            Write a Review
          </button>
        </div>
      )}
    </div>
  )
}
