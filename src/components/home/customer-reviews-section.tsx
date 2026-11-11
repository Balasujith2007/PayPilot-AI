"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Reveal } from "@/components/home/reveal"
import { sampleTestimonials } from "@/data/home-sample-testimonials"
import { cn } from "@/lib/utils"

export function CustomerReviewsSection() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const updateScrollState = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 4)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Avoid synchronous setState in effect for React 19 ESLint rule
    const rafId = window.requestAnimationFrame(updateScrollState)

    el.addEventListener("scroll", updateScrollState, { passive: true })
    window.addEventListener("resize", updateScrollState)

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(updateScrollState)
    })
    resizeObserver.observe(el)

    return () => {
      window.cancelAnimationFrame(rafId)
      el.removeEventListener("scroll", updateScrollState)
      window.removeEventListener("resize", updateScrollState)
      resizeObserver.disconnect()
    }
  }, [updateScrollState])

  const scroll = (direction: "left" | "right") => {
    const el = containerRef.current
    if (!el) return

    const firstCard = el.querySelector<HTMLElement>("[data-testimonial-card]")
    // Scroll by width of one card plus gap
    const cardWidth = firstCard ? firstCard.offsetWidth + 20 : 380

    el.scrollBy({
      left: direction === "left" ? -cardWidth : cardWidth,
      behavior: "smooth",
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      scroll("left")
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      scroll("right")
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 overflow-hidden">
      <Reveal>
        {/* Header: Title on left, Arrows on right */}
        <div className="flex items-center justify-between gap-4 mb-8 sm:mb-10">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-black dark:text-white">
            OUR HAPPY CUSTOMERS
          </h2>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              aria-label="Previous testimonials"
              className="inline-flex size-10 sm:size-11 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-black text-black dark:text-white transition-all hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 disabled:pointer-events-none disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:ring-offset-2"
            >
              <ArrowLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              aria-label="Next testimonials"
              className="inline-flex size-10 sm:size-11 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-black text-black dark:text-white transition-all hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 disabled:pointer-events-none disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:ring-offset-2"
            >
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>

        {/* Carousel Container with softly faded edges */}
        <div className="relative">
          {/* Left soft edge fade */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-16 lg:w-24 bg-gradient-to-r from-background via-background/80 to-transparent z-10 transition-opacity duration-300",
              canScrollLeft ? "opacity-100" : "opacity-0"
            )}
          />

          {/* Right soft edge fade */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-16 lg:w-24 bg-gradient-to-l from-background via-background/80 to-transparent z-10 transition-opacity duration-300",
              canScrollRight ? "opacity-100" : "opacity-0"
            )}
          />

          {/* Horizontal scroll track */}
          <div
            ref={containerRef}
            tabIndex={0}
            role="region"
            aria-label="Customer testimonials"
            onKeyDown={handleKeyDown}
            className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:ring-offset-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {sampleTestimonials.map((item) => (
              <article
                key={item.id}
                data-testimonial-card
                className="w-[300px] sm:w-[360px] lg:w-[400px] shrink-0 snap-start rounded-[20px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#121212] p-6 sm:p-8 flex flex-col justify-start transition-transform duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                {/* 5 Yellow Stars */}
                <div
                  className="flex items-center gap-1.5 text-[#FFC633]"
                  role="img"
                  aria-label={`${item.rating} out of 5 stars`}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className="size-5 sm:size-5.5 fill-current"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>

                {/* Name & Verified Badge */}
                <div className="mt-3.5 sm:mt-4 flex items-center gap-2">
                  <span className="font-bold text-base sm:text-lg text-black dark:text-white">
                    {item.name}
                  </span>
                  {item.verified && (
                    <span
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#01AB31] text-white"
                      title="Verified Buyer"
                    >
                      <svg
                        className="size-3 stroke-current stroke-[3] fill-none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="sr-only">Verified Buyer</span>
                    </span>
                  )}
                </div>

                {/* Quote */}
                <blockquote className="mt-2.5 sm:mt-3 text-sm sm:text-base text-black/75 dark:text-white/75 leading-relaxed font-normal">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
              </article>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

