"use client"

import { create } from "zustand"
import type { ChatMessage } from "@/types/ai-assistant"

export interface ChatState {
  messages: ChatMessage[]
  conversationId: string | null
  status: "idle" | "loading" | "error"
  lastRequest: string | null

  // Actions
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  setStatus: (status: "idle" | "loading" | "error") => void
  setConversationId: (id: string | null) => void
  setLastRequest: (text: string | null) => void
  clearConversation: () => void
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  conversationId: null,
  status: "idle",
  lastRequest: null,

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
    }),
}))

