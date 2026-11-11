"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Sparkles } from "lucide-react"
import { useCountUp } from "@/hooks/use-count-up"

/* ============================================================================
   HERO COPY CONFIGURATION — Edit all copy and links here
   ============================================================================ */
export const HERO_CONFIG = {
  headline: {
    line1: "FIND PRODUCTS",
    line2: "THAT MATCH",
    line3: "YOUR NEEDS",
  },
  description:
    "Browse through our curated collection of verified products, guided by PayPilot AI to help you find exactly what fits your style, budget, and lifestyle.",
  primaryCta: {
    text: "Shop Now",
    href: "/shop",
  },
  secondaryCta: {
    text: "Ask AI",
    href: "/ai-assistant",
  },
  statsLabels: {
    products: "Quality Products",
    brands: "Verified Brands",
    categories: "Categories",
  },
  image: {
    src: "/images/home/hero-shopper.png",
    alt: "PayPilot AI curated lifestyle products",
  },
}

/* ── 4-point sparkle shape (SHOP.CO aesthetic) ─────────────────────────── */
function SparkleStar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M50 0 C50 27.614 72.386 50 100 50 C72.386 50 50 72.386 50 100 C50 72.386 27.614 50 0 50 C27.614 50 50 27.614 50 0 Z" />
    </svg>
  )
}

/* ── Single Stat Item with useCountUp ──────────────────────────────────── */
function StatItem({
  value,
  label,
  suffix = "+",
}: {
  value: number
  label: string
  suffix?: string
}) {
  const { value: count, ref } = useCountUp({
    end: value,
    duration: 1200,
  })

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="flex flex-col text-left"
    >
      <div className="font-display text-2xl sm:text-3xl lg:text-4xl font-black text-black tracking-tight leading-none">
        {count}
        {suffix}
      </div>
      <p className="mt-1 text-xs sm:text-sm text-black/70 font-normal whitespace-nowrap">
        {label}
      </p>
    </div>
  )
}

/* ── Neutral Placeholder (rendered if hero.png is missing) ─────────────── */
function NeutralHeroPlaceholder() {
  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-sm sm:max-w-md h-[340px] sm:h-[440px] lg:h-[520px] mb-4 lg:mb-8 rounded-3xl border border-black/10 bg-white/50 p-8 text-center backdrop-blur-sm shadow-xs">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-white shadow-md">
        <Sparkles className="h-8 w-8 animate-sparkle-pulse motion-reduce:animate-none" />
      </div>
      <p className="mt-5 font-display text-2xl font-black uppercase tracking-tight text-black">
        {HERO_CONFIG.headline.line1}
      </p>
      <p className="mt-2 text-xs sm:text-sm text-black/60 max-w-xs">
        {HERO_CONFIG.description}
      </p>
      <div className="mt-6 flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black/80 shadow-xs border border-black/5">
        <span className="h-2 w-2 rounded-full bg-[#01AB31]" />
        <span>Curated Catalog Ready</span>
      </div>
    </div>
  )
}

export interface HeroSectionProps {
  stats?: {
    products: number
    brands: number
    categories: number
  }
}

export function HeroSection({
  stats = { products: 14, brands: 11, categories: 13 },
}: HeroSectionProps) {
  const [imageError, setImageError] = useState(false)

  return (
    <section className="w-full bg-[#F0EEED] overflow-hidden">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center lg:items-end">
          {/* LEFT COLUMN: Headline, Description, CTAs, Catalog Stats */}
          <div className="lg:col-span-7 pt-10 sm:pt-14 lg:pt-20 pb-8 sm:pb-12 lg:pb-24 flex flex-col justify-center">
            {/* H1 in 3 lines, font-display, uppercase, ~64px desktop / 36px mobile */}
            <h1 className="font-display text-[36px] sm:text-[48px] lg:text-[64px] font-black uppercase tracking-tight leading-[1.0] lg:leading-[0.96] text-black">
              <span className="block animate-fade-up [animation-delay:0.04s]">
                {HERO_CONFIG.headline.line1}
              </span>
              <span className="block animate-fade-up [animation-delay:0.12s]">
                {HERO_CONFIG.headline.line2}
              </span>
              <span className="block animate-fade-up [animation-delay:0.20s]">
                {HERO_CONFIG.headline.line3}
              </span>
            </h1>

            {/* Muted paragraph */}
            <p className="animate-fade-up [animation-delay:0.28s] mt-5 sm:mt-6 max-w-lg text-sm sm:text-base text-black/70 leading-relaxed">
              {HERO_CONFIG.description}
            </p>

            {/* CTAs */}
            <div className="animate-fade-up [animation-delay:0.36s] mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href={HERO_CONFIG.primaryCta.href}
                className="group inline-flex items-center justify-center gap-3 rounded-full bg-black px-9 py-3.5 sm:py-4 text-sm sm:text-base font-medium text-white shadow-sm hover:bg-black/85 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                <span>{HERO_CONFIG.primaryCta.text}</span>
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-200 group-hover:translate-x-1.5 motion-reduce:group-hover:translate-x-0" />
              </Link>

              <Link
                href={HERO_CONFIG.secondaryCta.href}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-semibold text-black hover:text-black/70 transition-colors underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-sm"
              >
                <Sparkles className="h-4 w-4" />
                <span>{HERO_CONFIG.secondaryCta.text} &rarr;</span>
              </Link>
            </div>

            {/* Stats Row computed server-side from catalog */}
            <div className="animate-fade-up [animation-delay:0.44s] mt-10 sm:mt-12 pt-8 border-t border-black/10">
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-6 sm:gap-8 lg:gap-12">
                <StatItem
                  value={stats.products}
                  label={HERO_CONFIG.statsLabels.products}
                />
                <div
                  className="hidden sm:block h-12 w-[1px] bg-black/10 shrink-0"
                  aria-hidden="true"
                />
                <StatItem
                  value={stats.brands}
                  label={HERO_CONFIG.statsLabels.brands}
                />
                <div
                  className="hidden sm:block h-12 w-[1px] bg-black/10 shrink-0"
                  aria-hidden="true"
                />
                <div className="col-span-2 sm:col-span-1">
                  <StatItem
                    value={stats.categories}
                    label={HERO_CONFIG.statsLabels.categories}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Hero image with bottom alignment + 2 sparkle shapes */}
          <div className="lg:col-span-5 relative w-full h-[420px] sm:h-[520px] lg:h-full lg:min-h-[620px] flex items-end justify-center lg:justify-end self-end overflow-hidden">
            {/* Sparkle 1: Top-Right (slow rotate) */}
            <SparkleStar className="absolute top-8 right-4 sm:top-10 sm:right-8 lg:top-12 lg:right-8 z-20 w-14 h-14 sm:w-18 sm:h-18 lg:w-22 lg:h-22 text-black animate-sparkle-spin motion-reduce:animate-none pointer-events-none" />

            {/* Sparkle 2: Mid-Left (pulse) */}
            <SparkleStar className="absolute top-[45%] -translate-y-1/2 left-1 sm:left-3 lg:-left-2 z-20 w-9 h-9 sm:w-11 sm:h-11 lg:w-13 lg:h-13 text-black animate-sparkle-pulse motion-reduce:animate-none pointer-events-none" />

            {/* Hero image with bottom alignment, priority, and fallback */}
            <div className="relative w-full h-full min-h-[420px] sm:min-h-[520px] lg:min-h-[620px] flex items-end justify-center lg:justify-end animate-fade-in [animation-delay:0.2s]">
              {!imageError ? (
                <Image
                  src={HERO_CONFIG.image.src}
                  alt={HERO_CONFIG.image.alt}
                  fill
                  priority
                  unoptimized
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-contain object-bottom select-none"
                  onError={() => setImageError(true)}
                />
              ) : (
                <NeutralHeroPlaceholder />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
