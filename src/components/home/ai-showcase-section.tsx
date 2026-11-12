"use client"

import React from "react"
import Link from "next/link"
import {
  MessageSquareCode,
  Scale,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react"
import { ScrollReveal } from "@/components/ui/scroll-reveal"
import { Button } from "@/components/ui/button"

export function AiShowcaseSection() {
  return (
    <section className="relative overflow-hidden bg-[#0B0B1A] py-20 text-white lg:py-24 border-t border-white/10">
      {/* Background radial gradient glow */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-[#4F46E5]/20 via-[#7C3AED]/20 to-[#06B6D4]/15 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#06B6D4]/30 bg-[#06B6D4]/10 px-3.5 py-1 text-xs font-semibold text-[#22D3EE]">
            <Sparkles className="h-3.5 w-3.5" />
            Meet PayPilot AI
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Smarter shopping in <span className="text-gradient">three steps</span>
          </h2>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            Say goodbye to endless comparison tabs. PayPilot AI decodes specs,
            answers product questions, and surfaces exactly what fits your budget.
          </p>
        </ScrollReveal>

        {/* 3 Feature Cards */}
        <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Card 1: Plain language */}
          <ScrollReveal
            delayMs={100}
            className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#818CF8]/50 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-[#4F46E5]/10"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#4F46E5]/20 text-[#818CF8]">
                <MessageSquareCode className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">
                Ask in plain language
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Describe what you need naturally without guessing technical keywords or digging through complex filters.
              </p>
            </div>

            {/* Illustrative visual only */}
            <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Example query (Illustration)
                </span>
              </div>
              <p className="mt-2 text-xs italic text-slate-200">
                &ldquo;Find me over-ear wireless headphones under ₹8,000 with deep bass and great battery life.&rdquo;
              </p>
            </div>
          </ScrollReveal>

          {/* Card 2: Compare side by side */}
          <ScrollReveal
            delayMs={180}
            className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#818CF8]/50 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-[#4F46E5]/10"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7C3AED]/20 text-[#A78BFA]">
                <Scale className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">
                Compare side by side
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Get clear, unbiased side-by-side trade-offs on battery, materials, warranty, and real-world performance.
              </p>
            </div>

            {/* Illustrative visual only */}
            <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#A78BFA]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Example comparison (Illustration)
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-md bg-white/5 p-2">
                  <p className="font-semibold text-white">Option A</p>
                  <p className="text-slate-400">30h Battery · ANC</p>
                </div>
                <div className="rounded-md bg-white/5 p-2 border border-[#818CF8]/30">
                  <p className="font-semibold text-[#818CF8]">Option B ★</p>
                  <p className="text-slate-300">40h Battery · Lighter</p>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Card 3: Know why it's recommended */}
          <ScrollReveal
            delayMs={260}
            className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#818CF8]/50 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-[#4F46E5]/10"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#06B6D4]/20 text-[#22D3EE]">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">
                Know why it&apos;s recommended
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Understand the reasoning behind every pick with transparent breakdown points so you always buy with confidence.
              </p>
            </div>

            {/* Illustrative visual only */}
            <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#06B6D4]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Example breakdown (Illustration)
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-200">
                <li className="flex items-center gap-1.5">
                  <span className="text-[#10B981]">✓</span> Within budget (₹7,999)
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-[#10B981]">✓</span> 4.8★ rated for comfort
                </li>
              </ul>
            </div>
          </ScrollReveal>
        </div>

        {/* CTA */}
        <ScrollReveal delayMs={320} className="mt-12 text-center">
          <Button size="lg" asChild className="shadow-lg shadow-[#4F46E5]/25">
            <Link href="/ai-assistant">
              Try PayPilot AI Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </ScrollReveal>
      </div>
    </section>
  )
}

