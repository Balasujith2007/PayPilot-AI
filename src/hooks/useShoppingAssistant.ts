"use client"

import { useCallback, useEffect, useRef } from "react"
import { useChatStore } from "@/store/chat"
import { sendMessage } from "@/lib/ai-assistant/client"
import { useCatalog } from "@/components/ai-assistant/CatalogProvider"
import type { ChatMessage } from "@/types/ai-assistant"

export function useShoppingAssistant() {
  const messages = useChatStore((s) => s.messages)
  const conversationId = useChatStore((s) => s.conversationId)
  const status = useChatStore((s) => s.status)
  const lastRequest = useChatStore((s) => s.lastRequest)

  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const setStatus = useChatStore((s) => s.setStatus)
  const setConversationId = useChatStore((s) => s.setConversationId)
  const setLastRequest = useChatStore((s) => s.setLastRequest)
  const storeClear = useChatStore((s) => s.clearConversation)

  const { products: catalogProducts } = useCatalog()

  const abortControllerRef = useRef<AbortController | null>(null)
  const activeReqIdRef = useRef<number>(0)

  // Abort on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const clearConversation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    activeReqIdRef.current += 1
    storeClear()
  }, [storeClear])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || status === "loading") return

      // Abort any previous pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller
      const currentReqId = ++activeReqIdRef.current

      // 1. Optimistic user message
      const userMsgId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const userMessage: ChatMessage = {
        id: userMsgId,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
        status: "sent",
      }

      addMessage(userMessage)
      setLastRequest(trimmed)
      setStatus("loading")

      try {
        const response = await sendMessage(
          {
            message: trimmed,
            conversationId: conversationId ?? undefined,
          },
          {
            signal: controller.signal,
            catalogProducts,
          }
        )

        // If conversation was cleared or a newer request started, ignore result
        if (currentReqId !== activeReqIdRef.current) return

        setConversationId(response.conversationId)

        const assistantMsgId = `asst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const assistantMessage: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: response.reply,
          timestamp: Date.now(),
          isMock: response.isMock,
          products: response.recommendedProducts,
          status: "sent",
        }

        addMessage(assistantMessage)
        setStatus("idle")
      } catch (err) {
        // If aborted, do not set error state
        if (err instanceof DOMException && err.name === "AbortError") {
          return
        }

        if (currentReqId !== activeReqIdRef.current) return

        // Mark user message as errored to display inline error under it
        updateMessage(userMsgId, { status: "error" })
        setStatus("error")
      } finally {
        if (currentReqId === activeReqIdRef.current) {
          abortControllerRef.current = null
        }
      }
    },
    [
      status,
      conversationId,
      catalogProducts,
      addMessage,
      updateMessage,
      setLastRequest,
      setStatus,
      setConversationId,
    ]
  )

  return {
    messages,
    conversationId,
    status,
    lastRequest,
    sendMessage: send,
    clearConversation,
  }
}
