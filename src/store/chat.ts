"use client"

import { create } from "zustand"
import type { ChatMessage } from "@/types/ai-assistant"

export interface ChatState {
  messages: ChatMessage[]
  conversationId: string | null
  status: "idle" | "loading" | "error"
  lastRequest: string | null

  // Comparison State (Session only, max 3)
  compareIds: string[]
  compareOpen: boolean

  // Chat Actions
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  setStatus: (status: "idle" | "loading" | "error") => void
  setConversationId: (id: string | null) => void
  setLastRequest: (text: string | null) => void
  clearConversation: () => void

  // Comparison Actions
  toggleCompare: (productId: string) => boolean
  removeCompareId: (productId: string) => void
  clearCompare: () => void
  setCompareOpen: (open: boolean) => void
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  conversationId: null,
  status: "idle",
  lastRequest: null,

  compareIds: [],
  compareOpen: false,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  setStatus: (status) => set({ status }),

  setConversationId: (conversationId) => set({ conversationId }),

  setLastRequest: (lastRequest) => set({ lastRequest }),

  clearConversation: () =>
    set({
      messages: [],
      conversationId: null,
      status: "idle",
      lastRequest: null,
      compareIds: [],
      compareOpen: false,
    }),

  toggleCompare: (productId) => {
    let success = false
    set((state) => {
      if (state.compareIds.includes(productId)) {
        success = true
        return {
          compareIds: state.compareIds.filter((id) => id !== productId),
        }
      }
      if (state.compareIds.length >= 3) {
        success = false
        return state
      }
      success = true
      return {
        compareIds: [...state.compareIds, productId],
      }
    })
    return success
  },

  removeCompareId: (productId) =>
    set((state) => ({
      compareIds: state.compareIds.filter((id) => id !== productId),
    })),

  clearCompare: () =>
    set({
      compareIds: [],
      compareOpen: false,
    }),

  setCompareOpen: (compareOpen) => set({ compareOpen }),
}))
