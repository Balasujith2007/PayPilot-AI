"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { siteConfig } from "@/lib/config"

interface CartSummaryProps {
  subtotal: number
}

export function CartSummary({ subtotal }: CartSummaryProps) {
  const shipping = subtotal >= siteConfig.freeShippingThreshold ? 0 : 599
  const tax = Math.round(subtotal * siteConfig.taxRate)
  const total = subtotal + shipping + tax

  return (
    <div className="rounded-[20px] border border-black/10 bg-white p-5 sm:p-6 lg:p-7 w-full text-left">
      <h2 className="font-bold text-xl sm:text-2xl text-black mb-5 sm:mb-6">
        Order Summary
      </h2>

      <div className="space-y-4 text-base">
        {/* Subtotal */}
        <div className="flex items-center justify-between">
          <span className="text-black/60">Subtotal</span>
          <span className="font-bold text-black tabular-nums">
            {formatPrice(subtotal)}
          </span>
        </div>

        {/* Delivery Fee */}
        <div className="flex items-center justify-between">
          <span className="text-black/60">Delivery Fee</span>
          <span className="font-bold text-black tabular-nums">
            {shipping === 0 ? "Free" : formatPrice(shipping)}
          </span>
        </div>

        {/* Tax (existing calculation) */}
        {tax > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-black/60">Estimated Tax</span>
            <span className="font-medium text-black tabular-nums">
              {formatPrice(tax)}
            </span>
          </div>
        )}

        <hr className="border-t border-black/10 my-4" />

        {/* Total */}
        <div className="flex items-center justify-between">
          <span className="font-medium text-lg sm:text-xl text-black">Total</span>
          <span className="font-bold text-2xl sm:text-[28px] text-black tracking-tight tabular-nums">
            {formatPrice(total)}
          </span>
        </div>

        {/* Free shipping threshold indicator */}
        {subtotal > 0 && subtotal < siteConfig.freeShippingThreshold && (
          <p className="text-xs text-black/50 pt-1">
            Add {formatPrice(siteConfig.freeShippingThreshold - subtotal)} more for free delivery
          </p>
        )}
      </div>

      {/* Checkout Button */}
      <Link
        href="/checkout"
        className="group w-full rounded-full bg-black py-3.5 sm:py-4 px-6 text-white font-medium hover:bg-black/85 flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 text-base mt-6"
      >
        <span>Go to Checkout</span>
        <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1.5 motion-reduce:group-hover:translate-x-0" />
      </Link>
    </div>
  )
}
