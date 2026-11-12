"use client"

import React from "react"
import { Reveal } from "@/components/home/reveal"
import { NewsletterForm } from "@/components/layout/newsletter-form"

export function NewsletterSection() {
  return (
    <Reveal>
      <div className="rounded-[20px] bg-black px-6 py-9 sm:px-12 sm:py-10 lg:px-16 lg:py-11 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Heading in .font-display */}
          <div className="lg:col-span-7">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[40px] font-black uppercase tracking-tight leading-[1.08] text-white">
              STAY UP TO DATE ABOUT OUR LATEST OFFERS
            </h2>
          </div>

          {/* Right Column: Newsletter form */}
          <div className="lg:col-span-5 w-full max-w-md lg:max-w-none mx-auto">
            <NewsletterForm />
          </div>
        </div>
      </div>
    </Reveal>
  )
}
