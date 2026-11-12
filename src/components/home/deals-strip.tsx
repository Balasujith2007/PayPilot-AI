"use client"

import React from "react"
import Link from "next/link"
import { Flame, ArrowRight, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollReveal } from "@/components/ui/scroll-reveal"

export function DealsStrip() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 p-6 sm:p-8 lg:p-10 shadow-xs">
          {/* Decorative background circle */}
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/10 blur-2xl"
            aria-hidden="true"
          />

          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-start gap-4 sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                <Flame className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                    <Tag className="h-3 w-3" />
                    Limited Stock
                  </span>
                </div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Today&apos;s Deals
                </h2>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  Special marked-down prices on top-rated tech, lifestyle essentials, and apparel.
                </p>
              </div>
            </div>

            <Button
              size="lg"
              asChild
              className="shrink-0 bg-amber-500 text-neutral-950 font-bold hover:bg-amber-400 shadow-md shadow-amber-500/20 group focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <Link href="/shop?sale=true">
                Explore All Deals
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>
      </ScrollReveal>
    </section>
  )
}

