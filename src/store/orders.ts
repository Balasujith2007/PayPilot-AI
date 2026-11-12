"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Order } from "@/types"

interface OrdersState {
  orders: Order[]
  addOrder: (order: Order) => void
  getOrderById: (id: string) => Order | undefined
  getOrdersByEmail: (email: string) => Order[]
  getOrdersByUser: (userId?: string, email?: string) => Order[]
  updateOrderStatus: (id: string, status: Order["status"]) => void
  clearAllOrders?: () => void
}

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],

      addOrder: (order) => {
        set((state) => {
          const current = Array.isArray(state.orders) ? state.orders : []
          const filtered = current.filter((o) => o.id !== order.id)
          return {
            orders: [order, ...filtered],
          }
        })
      },

      getOrderById: (id) => get().orders.find((o) => o.id === id),

      getOrdersByEmail: (email) => {
        const cleanEmail = email.trim().toLowerCase()
        return get().orders.filter(
          (o) => o.customerEmail?.trim().toLowerCase() === cleanEmail
        )
      },

      getOrdersByUser: (userId, email) => {
        const cleanEmail = email?.trim().toLowerCase()
        return get().orders.filter((o) => {
          if (userId && o.userId && o.userId === userId) return true
          if (cleanEmail && o.customerEmail?.trim().toLowerCase() === cleanEmail)
            return true
          return false
        })
      },

      updateOrderStatus: (id, status) => {
        set((state) => ({
          orders: (state.orders || []).map((o) =>
            o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o
          ),
        }))
      },

      clearAllOrders: () => set({ orders: [] }),
    }),
    { name: "orders-storage" }
  )
)
