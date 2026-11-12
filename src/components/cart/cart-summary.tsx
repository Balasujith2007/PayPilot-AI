"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Tag, X, Sparkles, Check, MapPin, Truck, AlertCircle } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { siteConfig } from "@/lib/config"
import { useAuthStore } from "@/store/auth"
import { useCouponStore } from "@/store/coupons"
import { useOrdersStore } from "@/store/orders"
import { toast } from "sonner"

interface CartSummaryProps {
  subtotal: number
  showCheckoutButton?: boolean
}

export function CartSummary({
  subtotal,
  showCheckoutButton = true,
}: CartSummaryProps) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const getOrdersByEmail = useOrdersStore((s) => s.getOrdersByEmail)

  const appliedCoupon = useCouponStore((s) => s.appliedCoupon)
  const applyCoupon = useCouponStore((s) => s.applyCoupon)
  const removeCoupon = useCouponStore((s) => s.removeCoupon)
  const calculateDiscount = useCouponStore((s) => s.calculateDiscount)

  const [couponInput, setCouponInput] = useState("")
  const [pincodeInput, setPincodeInput] = useState("")
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [pincodeResult, setPincodeResult] = useState<{
    isServiceable: boolean
    city?: string
    state?: string
    areaName?: string
    standardDelivery?: { days: number; fee: number; isFree: boolean }
    codAvailable?: boolean
    preferredCourier?: string
    message?: string
  } | null>(null)

  // Determine if the user is eligible for the first-purchase ₹500 offer
  const userOrders = user ? getOrdersByEmail(user.email) : []
  const isFirstPurchase = !user || userOrders.length === 0

  const discount = calculateDiscount(subtotal)
  const discountedSubtotal = Math.max(0, subtotal - discount)
  const shipping =
    subtotal === 0
      ? 0
      : discountedSubtotal >= siteConfig.freeShippingThreshold
      ? 0
      : 599
  const tax = Math.round(discountedSubtotal * siteConfig.taxRate)
  const total = discountedSubtotal === 0 ? 0 : discountedSubtotal + shipping + tax

  const handleApplyCoupon = async (
    e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent
  ) => {
    if (e) e.preventDefault()
    const cleanCode = couponInput.trim().toUpperCase()
    if (!cleanCode) return

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode, subtotal, isFirstPurchase }),
      })
      const data = await res.json()
      if (data.success && data.coupon) {
        useCouponStore.getState().setAppliedCoupon(data.coupon)
        toast.success(data.message)
        setCouponInput("")
      } else {
        toast.error(data.message || "Invalid coupon code")
      }
    } catch {
      const result = applyCoupon(cleanCode, subtotal, isFirstPurchase)
      if (result.success) {
        toast.success(result.message)
        setCouponInput("")
      } else {
        toast.error(result.message)
      }
    }
  }

  const handleQuickApply = async (code: string) => {
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal, isFirstPurchase }),
      })
      const data = await res.json()
      if (data.success && data.coupon) {
        useCouponStore.getState().setAppliedCoupon(data.coupon)
        toast.success(data.message)
      } else {
        toast.error(data.message || "Invalid coupon code")
      }
    } catch {
      const result = applyCoupon(code, subtotal, isFirstPurchase)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    }
  }

  const handleCheckoutClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      toast.info("Please sign in or create an account to proceed to checkout.")
      router.push("/auth/login?redirect=/checkout")
    } else {
      router.push("/checkout")
    }
  }

  return (
    <div className="rounded-[20px] border border-black/10 bg-white p-5 sm:p-6 lg:p-7 w-full text-left shadow-xs">
      <h2 className="font-bold text-xl sm:text-2xl text-black mb-5 sm:mb-6">
        Order Summary
      </h2>

      <div className="space-y-3.5 text-sm sm:text-base">
        {/* Subtotal */}
        <div className="flex items-center justify-between">
          <span className="text-black/60">Subtotal</span>
          <span className="font-bold text-black tabular-nums">
            {formatPrice(subtotal)}
          </span>
        </div>

        {/* Discount Row */}
        {discount > 0 && appliedCoupon && (
          <div className="flex items-center justify-between text-[#047857]">
            <span className="font-medium flex items-center gap-1.5">
              <span>Discount ({appliedCoupon.code})</span>
            </span>
            <span className="font-bold tabular-nums">
              -{formatPrice(discount)}
            </span>
          </div>
        )}

        {/* Delivery Fee */}
        <div className="flex items-center justify-between">
          <span className="text-black/60">Delivery Fee</span>
          <span className="font-bold text-black tabular-nums">
            {shipping === 0 ? "Free" : formatPrice(shipping)}
          </span>
        </div>

        {/* Estimated Tax */}
        <div className="flex items-center justify-between">
          <span className="text-black/60">Estimated GST / Tax (8%)</span>
          <span className="font-bold text-black tabular-nums">
            {formatPrice(tax)}
          </span>
        </div>

        <hr className="border-t border-black/10 my-3" />

        {/* Total */}
        <div className="flex items-center justify-between">
          <span className="font-medium text-lg sm:text-xl text-black">Total</span>
          <span className="font-bold text-2xl sm:text-[28px] text-black tracking-tight tabular-nums">
            {formatPrice(total)}
          </span>
        </div>

        {/* Free shipping threshold indicator */}
        {discountedSubtotal > 0 && discountedSubtotal < siteConfig.freeShippingThreshold && (
          <p className="text-xs text-black/60 pt-1">
            Add {formatPrice(siteConfig.freeShippingThreshold - discountedSubtotal)} more for free delivery
          </p>
        )}
      </div>

      {/* Promo Code & Voucher Section */}
      <div className="mt-5 pt-4 border-t border-black/10 space-y-3">
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold uppercase tracking-wider">{appliedCoupon.code} Applied</p>
                <p className="text-[11px] text-emerald-700">{appliedCoupon.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={removeCoupon}
              className="p-1 rounded-full text-emerald-700 hover:bg-emerald-200/60 transition-colors"
              title="Remove coupon"
              aria-label="Remove coupon"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleApplyCoupon(e)
                  }
                }}
                placeholder="Add promo code"
                className="w-full rounded-full bg-[#F0EEED] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black uppercase font-medium"
              />
            </div>
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={!couponInput.trim()}
              className="rounded-full bg-black text-white px-5 py-2.5 text-xs sm:text-sm font-semibold hover:bg-black/85 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
            >
              Apply
            </button>
          </div>
        )}

        {/* First Purchase ₹500 Voucher Banner (shown if not yet applied and eligible) */}
        {!appliedCoupon && isFirstPurchase && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-3.5 text-left text-amber-950 shadow-2xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-600 fill-amber-500 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  First Purchase Offer: ₹500 OFF
                </span>
              </div>
              <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                VOUCHER
              </span>
            </div>
            <p className="text-[11px] text-amber-800/90 mt-1">
              Use code <strong className="font-bold text-amber-950">FIRST500</strong> for flat ₹500 off on orders over ₹999!
            </p>
            <button
              type="button"
              onClick={() => handleQuickApply("FIRST500")}
              className="mt-2.5 w-full inline-flex items-center justify-center gap-1 rounded-full bg-black text-white py-2 px-3 text-xs font-semibold hover:bg-black/85 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <span>Apply FIRST500 (Save ₹500)</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Pincode & Delivery Serviceability Radar */}
        <div className="pt-2 border-t border-black/10">
          <label className="text-xs font-bold text-black flex items-center gap-1.5 mb-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>Delivery Serviceability & Speed Check</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                maxLength={6}
                value={pincodeInput}
                onChange={(e) => setPincodeInput(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Enter 6-digit PIN (e.g. 560001)"
                className="w-full rounded-full bg-[#F0EEED] px-4 py-2 text-xs text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black font-mono font-medium"
              />
            </div>
            <button
              type="button"
              disabled={pincodeInput.length !== 6 || pincodeLoading}
              onClick={async () => {
                setPincodeLoading(true)
                try {
                  const res = await fetch(`/api/shipping/check-pincode?pincode=${pincodeInput}&cartTotal=${subtotal}`)
                  const data = await res.json()
                  setPincodeResult(data)
                } catch {
                  toast.error("Could not check PIN code serviceability")
                } finally {
                  setPincodeLoading(false)
                }
              }}
              className="rounded-full bg-zinc-900 text-white px-4 py-2 text-xs font-bold hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              {pincodeLoading ? "Checking..." : "Check"}
            </button>
          </div>

          {/* Serviceability Result Card */}
          {pincodeResult && (
            <div className={`mt-2.5 p-3 rounded-xl text-xs space-y-1 ${
              pincodeResult.isServiceable
                ? "bg-emerald-50 border border-emerald-200 text-emerald-950"
                : "bg-rose-50 border border-rose-200 text-rose-950"
            }`}>
              {pincodeResult.isServiceable ? (
                <>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span>Serviceable to {pincodeResult.city}, {pincodeResult.state}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Standard Delivery: <strong>{pincodeResult.standardDelivery?.days} Business Days</strong> ({pincodeResult.standardDelivery?.isFree ? "Free Delivery" : formatPrice(pincodeResult.standardDelivery?.fee || 9900)})
                  </p>
                  <p className="text-[10px] text-emerald-600 font-mono">
                    Partner: {pincodeResult.preferredCourier} &middot; COD: {pincodeResult.codAvailable ? "Available" : "Prepaid Only"}
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{pincodeResult.message || "This PIN code is currently unserviceable."}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Checkout Button */}
      {showCheckoutButton && (
        <button
          type="button"
          onClick={handleCheckoutClick}
          className="group w-full rounded-full bg-black py-3.5 sm:py-4 px-6 text-white font-medium hover:bg-black/85 flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 text-base mt-6 cursor-pointer"
        >
          <span>{isAuthenticated ? "Go to Checkout" : "Sign In to Checkout"}</span>
          <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1.5 motion-reduce:group-hover:translate-x-0" />
        </button>
      )}
    </div>
  )
}
