"use client"

import React from "react"
import { Truck, RotateCcw, ShieldCheck, Sparkles } from "lucide-react"
import { ScrollReveal } from "@/components/ui/scroll-reveal"

const TRUST_BADGES = [
  {
    icon: Truck,
    title: "Free Fast Delivery",
    description: "Complimentary shipping on orders over ₹999 with tracked doorstep delivery.",
    iconColor: "text-brand-primary",
    iconBg: "bg-brand-primary/10",
  },
  {
    icon: RotateCcw,
    title: "30-Day Easy Returns",
    description: "Hassle-free return policy with quick doorstep pickups and instant refunds.",
    iconColor: "text-[#7C3AED]",
    iconBg: "bg-[#7C3AED]/10",
  },
  {
    icon: ShieldCheck,
    title: "100% Secure Payments",
    description: "End-to-end encrypted checkout supporting UPI, cards, and net banking.",
    iconColor: "text-[#10B981]",
    iconBg: "bg-[#10B981]/10",
  },
  {
    icon: Sparkles,
    title: "24/7 AI-Assisted Help",
    description: "Instant product answers and personalized support around the clock.",
    iconColor: "text-[#06B6D4]",
    iconBg: "bg-[#06B6D4]/10",
  },
]

export function WhyUsSection() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
      <ScrollReveal className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Why Shop With Us
        </h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Built for convenience, safety, and a smarter shopping experience.
        </p>
      </ScrollReveal>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST_BADGES.map((badge, idx) => {
          const Icon = badge.icon
          return (
            <ScrollReveal
              key={badge.title}
              delayMs={idx * 80}
              className="flex flex-col items-start rounded-2xl border border-border/70 bg-card p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-brand-primary/40 hover:shadow-md"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${badge.iconBg} ${badge.iconColor}`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-foreground">
                {badge.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {badge.description}
              </p>
            </ScrollReveal>
          )
        })}
      </div>
    </section>
  )
}

