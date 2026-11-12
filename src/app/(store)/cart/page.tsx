"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, ShoppingBag } from "lucide-react"
import { useCartStore } from "@/store/cart"
import { CartItem } from "@/components/cart/cart-item"
import { CartSummary } from "@/components/cart/cart-summary"
import { Reveal } from "@/components/home/reveal"

export default function CartPage() {
  const items = useCartStore((s) => s.items)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  if (!mounted) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="h-4 w-28 bg-[#F0EEED] rounded animate-pulse mb-8" />
        <div className="h-10 w-48 bg-[#F0EEED] rounded animate-pulse mb-8" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 sm:mb-8">
          <ol className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-black/60">
            <li>
              <Link href="/" className="hover:text-black transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-black/30">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li className="font-medium text-black" aria-current="page">
              Cart
            </li>
          </ol>
        </nav>

        {/* Empty State */}
        <Reveal>
          <div className="flex flex-col items-center justify-center max-w-md mx-auto text-center py-12 sm:py-16">
            <div className="h-24 w-24 rounded-full bg-[#F0EEED] flex items-center justify-center mb-6 text-black/30">
              <ShoppingBag className="h-12 w-12 stroke-[1.5]" />
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight text-black mb-3">
              Your Cart is Empty
            </h1>

            <p className="text-black/60 text-sm sm:text-base leading-relaxed mb-8 max-w-sm">
              Looks like you haven&apos;t added anything to your cart yet. Explore our curated collections to find what fits your style.
            </p>

            <Link
              href="/shop"
              className="inline-flex items-center justify-center rounded-full bg-black px-9 py-3.5 sm:py-4 text-sm sm:text-base font-medium text-white hover:bg-black/85 transition-all duration-200 active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              Continue Shopping
            </Link>
          </div>
        </Reveal>
      </div>
    )
  }

  const subtotal = getSubtotal()

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 pb-16 sm:pb-24">
      {/* Breadcrumb: Home > Cart */}
      <nav aria-label="Breadcrumb" className="mb-6 sm:mb-8">
        <ol className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-black/60">
          <li>
            <Link href="/" className="hover:text-black transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="text-black/30">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li className="font-medium text-black" aria-current="page">
            Cart
          </li>
        </ol>
      </nav>

      {/* Heading: YOUR CART in .font-display */}
      <h1 className="font-display text-3xl sm:text-4xl lg:text-[40px] font-black uppercase tracking-tight text-black mb-6 sm:mb-8 text-left">
        YOUR CART
      </h1>

      {/* Two Column Layout (desktop), Single Column (mobile) */}
      <Reveal delay={0.04}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-10 items-start">
          {/* Left Column: Items List Card */}
          <div className="w-full lg:col-span-7 xl:col-span-7 rounded-[20px] border border-black/10 bg-white p-4 sm:p-6 divide-y divide-black/10 shadow-xs">
            {items.map((item) => (
              <CartItem key={item.variantId} item={item} />
            ))}
          </div>

          {/* Right Column: Order Summary Card */}
          <div className="w-full lg:col-span-5 xl:col-span-5 lg:sticky lg:top-24">
            <CartSummary subtotal={subtotal} />
          </div>
        </div>
      </Reveal>
    </div>
  )
}
