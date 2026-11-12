"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface Coupon {
  code: string
  title: string
  description: string
  discountType: "fixed" | "percentage"
  discountValue: number // in cents/paise (50000 = ₹500) or percentage (10 = 10%)
  minOrderValue?: number // in cents/paise
  firstPurchaseOnly?: boolean
}

export const STORE_COUPONS: Coupon[] = [
  {
    code: "FIRST500",
    title: "First Purchase Voucher",
    description: "₹500 flat discount for first-time shoppers on orders over ₹999",
    discountType: "fixed",
    discountValue: 50000, // ₹500
    minOrderValue: 99900, // ₹999
    firstPurchaseOnly: true,
  },
  {
    code: "PAYPILOT10",
    title: "Special 10% Off",
    description: "Get 10% discount on your order",
    discountType: "percentage",
    discountValue: 10,
    minOrderValue: 49900, // ₹499
  },
  {
    code: "SAVE200",
    title: "₹200 Instant Saver",
    description: "₹200 discount on orders above ₹1,499",
    discountType: "fixed",
    discountValue: 20000, // ₹200
    minOrderValue: 149900, // ₹1,499
  },
]

interface CouponState {
  appliedCoupon: Coupon | null
  setAppliedCoupon: (coupon: Coupon | null) => void
  applyCoupon: (
    code: string,
    subtotal: number,
    isFirstPurchase?: boolean
  ) => { success: boolean; message: string; discount: number }
  removeCoupon: () => void
  calculateDiscount: (subtotal: number) => number
}

export const useCouponStore = create<CouponState>()(
  persist(
    (set, get) => ({
      appliedCoupon: null,
      setAppliedCoupon: (coupon) => set({ appliedCoupon: coupon }),

      applyCoupon: (code, subtotal, isFirstPurchase = true) => {
        const cleanCode = code.trim().toUpperCase()
        const found = STORE_COUPONS.find((c) => c.code === cleanCode)

        if (!found) {
          return {
            success: false,
            message: `Invalid coupon "${cleanCode}". Use FIRST500 or PAYPILOT10`,
            discount: 0,
          }
        }

        if (found.minOrderValue && subtotal < found.minOrderValue) {
          const minRupees = Math.round(found.minOrderValue / 100)
          return {
            success: false,
            message: `Minimum order of ₹${minRupees.toLocaleString("en-IN")} required for ${found.code}`,
            discount: 0,
          }
        }

        if (found.firstPurchaseOnly && !isFirstPurchase) {
          return {
            success: false,
            message: `${found.code} is only valid on your first purchase`,
            discount: 0,
          }
        }

        let discount = 0
        if (found.discountType === "fixed") {
          discount = Math.min(found.discountValue, subtotal)
        } else if (found.discountType === "percentage") {
          discount = Math.round((subtotal * found.discountValue) / 100)
        }

        set({ appliedCoupon: found })
        return {
          success: true,
          message: `Coupon ${found.code} applied! Saved ₹${(discount / 100).toLocaleString("en-IN")}`,
          discount,
        }
      },

      removeCoupon: () => set({ appliedCoupon: null }),

      calculateDiscount: (subtotal) => {
        const coupon = get().appliedCoupon
        if (!coupon || subtotal <= 0) return 0
        if (coupon.minOrderValue && subtotal < coupon.minOrderValue) return 0

        if (coupon.discountType === "fixed") {
          return Math.min(coupon.discountValue, subtotal)
        } else {
          return Math.round((subtotal * coupon.discountValue) / 100)
        }
      },
    }),
    {
      name: "coupon-storage",
      partialize: (state) => ({ appliedCoupon: state.appliedCoupon }),
    }
  )
)

