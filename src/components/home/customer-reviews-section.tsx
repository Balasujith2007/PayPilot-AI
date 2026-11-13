"use client"

import React, { useState } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Reveal } from "@/components/home/reveal"
import { sampleTestimonials } from "@/data/home-sample-testimonials"
import { cn } from "@/lib/utils"

export function CustomerReviewsSection() {
  const [direction, setDirection] = useState<"normal" | "reverse">("normal")
  const [isPaused, setIsPaused] = useState(false)

  // 4 sets ensure an exact -50% translateX loop alignment with zero glitch/jump
  const marqueeItems = [
    ...sampleTestimonials,
    ...sampleTestimonials,
    ...sampleTestimonials,
    ...sampleTestimonials,
  ]

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 overflow-hidden select-none">
      <Reveal>
        {/* Header: Title on left, Direction Controls on right */}
        <div className="flex items-center justify-between gap-4 mb-8 sm:mb-10">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-black dark:text-white">
            OUR HAPPY CUSTOMERS
          </h2>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setDirection("reverse")
                setIsPaused(false)
              }}
              aria-label="Scroll reviews backward"
              title="Scroll backward"
              className={cn(
                "inline-flex size-10 sm:size-11 items-center justify-center rounded-full border border-black/10 dark:border-white/10 text-black dark:text-white transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white cursor-pointer",
                direction === "reverse"
                  ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
                  : "bg-white dark:bg-black hover:bg-black/5 dark:hover:bg-white/10"
              )}
            >
              <ArrowLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDirection("normal")
                setIsPaused(false)
              }}
              aria-label="Scroll reviews forward"
              title="Scroll forward"
              className={cn(
                "inline-flex size-10 sm:size-11 items-center justify-center rounded-full border border-black/10 dark:border-white/10 text-black dark:text-white transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white cursor-pointer",
                direction === "normal"
                  ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
                  : "bg-white dark:bg-black hover:bg-black/5 dark:hover:bg-white/10"
              )}
            >
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>

        {/* Carousel Container with soft edge fades */}
        <div className="relative overflow-hidden group">
          {/* Left soft edge fade */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-16 lg:w-28 bg-gradient-to-r from-background via-background/80 to-transparent z-10"
          />

          {/* Right soft edge fade */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-16 lg:w-28 bg-gradient-to-l from-background via-background/80 to-transparent z-10"
          />

          {/* Continuous Automatic Marquee Track (pauses on hover over cards) */}
          <div className="flex overflow-hidden py-2 motion-reduce:justify-center motion-reduce:flex-wrap">
            <div
              className="flex shrink-0 gap-5 sm:gap-6 animate-marquee-slow group-hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:animate-none"
              style={{
                animationDirection: direction,
                animationPlayState: isPaused ? "paused" : undefined,
              }}
            >
              {marqueeItems.map((item, index) => (
                <article
                  key={`${item.id}-${index}`}
                  data-testimonial-card
                  tabIndex={0}
                  className="w-[300px] sm:w-[360px] lg:w-[400px] shrink-0 rounded-[20px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#121212] p-6 sm:p-8 flex flex-col justify-start transition-transform duration-300 hover:-translate-y-1 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
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
        </div>
      </Reveal>
    </section>
  )
}
