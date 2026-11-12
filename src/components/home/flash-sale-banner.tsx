"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Flame, Clock, ArrowRight, Sparkles } from "lucide-react"

interface FlashSaleProps {
  flashSale: {
    id: string
    title: string
    description: string | null
    discountValue: number
    appliesTo: string
    targetCategorySlug: string | null
    bannerBadge: string | null
    bannerHeadline: string | null
    accentColor: string
    endsAt: string | Date
  } | null
}

export function FlashSaleBanner({ flashSale }: FlashSaleProps) {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number }>({
    d: 0,
    h: 0,
    m: 0,
    s: 0,
  })

  useEffect(() => {
    if (!flashSale) return
    const ends = new Date(flashSale.endsAt).getTime()

    const calculate = () => {
      const diff = ends - Date.now()
      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 })
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24))
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
        const m = Math.floor((diff / 1000 / 60) % 60)
        const s = Math.floor((diff / 1000) % 60)
        setTimeLeft({ d, h, m, s })
      }
    }

    calculate()
    const timer = setInterval(calculate, 1000)
    return () => clearInterval(timer)
  }, [flashSale])

  if (!flashSale) return null

  const targetLink =
    flashSale.appliesTo === "CATEGORY" && flashSale.targetCategorySlug
      ? `/shop?category=${flashSale.targetCategorySlug}`
      : "/shop"

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 my-6">
      <div
        className="relative overflow-hidden rounded-[24px] p-6 sm:p-8 text-white shadow-xl transition-all"
        style={{
          background: `linear-gradient(135deg, ${flashSale.accentColor || "#E11D48"} 0%, #1e1b4b 60%, #000000 100%)`,
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-xs font-black uppercase tracking-wider text-white">
              <Flame className="size-3.5 text-amber-300 animate-pulse" />
              <span>{flashSale.bannerBadge || "FLASH SALE"}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              {flashSale.bannerHeadline || `${flashSale.title}: ${flashSale.discountValue}% OFF`}
            </h2>

            <p className="text-xs sm:text-sm text-white/80 max-w-xl">
              {flashSale.description ||
                "Special festive rush! Limited inventory available at discounted prices."}
            </p>

            <div className="flex items-center gap-3 pt-1">
              <Link
                href={targetLink}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs sm:text-sm font-black text-black hover:bg-white/90 active:scale-95 transition-all shadow-md"
              >
                <span>Shop Flash Sale</span>
                <ArrowRight className="size-4" />
              </Link>
              <span className="text-xs font-bold text-white/70">
                {flashSale.appliesTo === "STOREWIDE"
                  ? "Applied storewide automatically"
                  : `Exclusive on ${flashSale.targetCategorySlug}`}
              </span>
            </div>
          </div>

          {/* Countdown Clock */}
          <div className="rounded-2xl bg-black/40 backdrop-blur-md p-4 sm:p-5 border border-white/10 text-center shrink-0">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-white/70 mb-2 uppercase tracking-widest">
              <Clock className="size-3.5" />
              <span>Ends In</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white/10 rounded-xl p-2 sm:p-2.5 min-w-[50px] sm:min-w-[60px]">
                <div className="text-lg sm:text-2xl font-black tabular-nums">{timeLeft.d}</div>
                <div className="text-[9px] text-white/60 uppercase">Days</div>
              </div>
              <div className="bg-white/10 rounded-xl p-2 sm:p-2.5 min-w-[50px] sm:min-w-[60px]">
                <div className="text-lg sm:text-2xl font-black tabular-nums">{timeLeft.h}</div>
                <div className="text-[9px] text-white/60 uppercase">Hours</div>
              </div>
              <div className="bg-white/10 rounded-xl p-2 sm:p-2.5 min-w-[50px] sm:min-w-[60px]">
                <div className="text-lg sm:text-2xl font-black tabular-nums">{timeLeft.m}</div>
                <div className="text-[9px] text-white/60 uppercase">Mins</div>
              </div>
              <div className="bg-white/10 rounded-xl p-2 sm:p-2.5 min-w-[50px] sm:min-w-[60px]">
                <div className="text-lg sm:text-2xl font-black tabular-nums text-amber-300">
                  {timeLeft.s}
                </div>
                <div className="text-[9px] text-amber-300 uppercase">Secs</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

