"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { MAX_COMPARE_PRODUCTS } from "@/lib/comparison/compare-products"

export interface CompareItem {
  productId: string
  name: string
  slug: string
}

export type AddCompareResult = "added" | "exists" | "full"

interface CompareState {
  items: CompareItem[]

  addItem: (item: CompareItem) => AddCompareResult
  removeItem: (productId: string) => void
  setItems: (items: CompareItem[]) => void
  clearAll: () => void
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const { items } = get()
        if (items.some((i) => i.productId === item.productId)) return "exists"
        if (items.length >= MAX_COMPARE_PRODUCTS) return "full"
        set({ items: [...items, item] })
        return "added"
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        }))
      },

      setItems: (items) => set({ items: items.slice(0, MAX_COMPARE_PRODUCTS) }),

      clearAll: () => set({ items: [] }),
    }),
    {
      name: "compare-storage",
      partialize: (state) => ({ items: state.items }),
    }
  )
)

/** Builds the shareable compare page URL for a list of product IDs. */
export function compareHref(productIds: string[]): string {
  return productIds.length > 0
    ? `/compare?ids=${productIds.map(encodeURIComponent).join(",")}`
    : "/compare"
}
