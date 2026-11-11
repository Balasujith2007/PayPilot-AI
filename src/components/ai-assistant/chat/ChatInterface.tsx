"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Sparkles, ArrowDown } from "lucide-react"
import { useShoppingAssistant } from "@/hooks/useShoppingAssistant"
import { useChatStore } from "@/store/chat"
import { ChatMessage } from "@/components/ai-assistant/chat/ChatMessage"
import { ChatInput } from "@/components/ai-assistant/chat/ChatInput"
import { SuggestedPrompts } from "@/components/ai-assistant/SuggestedPrompts"
import { TypingIndicator } from "@/components/ai-assistant/chat/TypingIndicator"
import { CompareTray } from "@/components/ai-assistant/compare/CompareTray"
import { ComparisonView } from "@/components/ai-assistant/compare/ComparisonView"

export function ChatInterface() {
  const t = useTranslations("assistant")
  const { messages, status, sendMessage, clearConversation, retryLastMessage } =
    useShoppingAssistant()

  const compareIds = useChatStore((s) => s.compareIds)
  const setCompareOpen = useChatStore((s) => s.setCompareOpen)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false)
  const isNearBottomRef = useRef(true)

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "end",
    })
    setShowScrollBottomPill(false)
  }, [])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isNearBottom = distanceFromBottom < 80
    isNearBottomRef.current = isNearBottom
    if (isNearBottom) {
      setShowScrollBottomPill(false)
    }
  }, [])

  const hasMessages = messages.length > 0
  const isLoading = status === "loading"
  const canCompare = compareIds.length >= 2

  // Auto-scroll when new messages arrive or loading state changes
  useEffect(() => {
    if (messages.length === 0 && !isLoading) return

    const frameId = window.requestAnimationFrame(() => {
      if (isNearBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        })
        setShowScrollBottomPill(false)
      } else {
        setShowScrollBottomPill(true)
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [messages, isLoading])

  return (
    <>
      <section
        role="region"
        aria-label={t("chatRegionAria")}
        className="flex flex-col w-full h-[calc(100dvh-10.5rem)] sm:h-[clamp(560px,calc(100dvh-12rem),800px)] rounded-[20px] border border-black/10 bg-white shadow-xs overflow-hidden"
      >
        {/* Top Bar (Single Sleek Row on Mobile & Desktop) */}
        <header className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3.5 border-b border-black/10 bg-white shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div
              className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-xs"
              aria-hidden="true"
            >
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-sparkle-spin motion-reduce:animate-none" />
            </div>
            <div className="min-w-0 truncate">
              <p className="font-bold text-xs sm:text-base text-black tracking-tight leading-tight truncate">
                {t("headerTitle")}
              </p>
              <p className="text-[10px] sm:text-xs text-black/60 leading-tight truncate">
                {t("headerSubtitle")}
              </p>
            </div>
          </div>

          {/* Action pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              disabled={!hasMessages || isLoading}
              onClick={clearConversation}
              aria-disabled={!hasMessages || isLoading}
              className={`rounded-full border px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black ${
                hasMessages && !isLoading
                  ? "border-black/20 text-black hover:bg-[#F0EEED] cursor-pointer"
                  : "border-black/15 text-black/40 cursor-not-allowed opacity-60"
              }`}
              aria-label={t("clearConversation")}
            >
              {t("clearConversation")}
            </button>
            <button
              type="button"
              disabled={!canCompare}
              onClick={() => setCompareOpen(true)}
              aria-disabled={!canCompare}
              className={`rounded-full border px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black ${
                canCompare
                  ? "border-black/20 text-black hover:bg-[#F0EEED] cursor-pointer"
                  : "border-black/15 text-black/40 cursor-not-allowed opacity-60"
              }`}
              aria-label={t("compare")}
            >
              {t("compare")}
            </button>
          </div>
        </header>

        {/* Main Area: Welcome State or Message List */}
        <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
          {!hasMessages ? (
            /* Welcome State */
            <div className="flex-1 overflow-y-auto px-3.5 py-3 sm:px-8 sm:py-8 flex flex-col text-center">
              <div className="my-auto flex flex-col items-center justify-center py-1 sm:py-2">
                <div className="relative mb-2.5 sm:mb-4 flex items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full bg-black/10 blur-xl animate-sparkle-pulse motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  <div
                    className="relative flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-black text-white shadow-[0_4px_16px_rgba(0,0,0,0.18)]"
                    aria-hidden="true"
                  >
                    <Sparkles className="h-5 w-5 sm:h-7 sm:w-7 animate-sparkle-pulse motion-reduce:animate-none" />
                  </div>
                </div>

                <h1 className="font-display text-base sm:text-2xl lg:text-3xl font-black uppercase tracking-tight text-black max-w-xl leading-[1.15]">
                  {t("welcomeHeading")}
                </h1>

                <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-black/60 max-w-md leading-relaxed px-2">
                  {t("welcomeDescription")}
                </p>

                <div className="mt-3.5 sm:mt-6 w-full">
                  <SuggestedPrompts
                    onPromptSelect={isLoading ? undefined : sendMessage}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Message List */
            <div
              ref={containerRef}
              onScroll={handleScroll}
              role="log"
              aria-live="polite"
              aria-label="Chat messages"
              className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-6"
            >
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onRetry={idx === messages.length - 1 ? retryLastMessage : undefined}
                />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>
          )}

          {/* "New message ↓" Scroll Pill */}
          {showScrollBottomPill && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 animate-fade-in">
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="flex items-center gap-1.5 rounded-full bg-black text-white px-3 py-1.5 text-xs font-medium shadow-md hover:bg-black/85 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                aria-label="Scroll to newest message"
              >
                <span>{t("newMessage")}</span>
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Compare Tray (Visible when 1 or more items selected) */}
        <CompareTray />

        {/* Input Bar (Pinned at bottom, shrink-0) */}
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </section>

      {/* Comparison Modal / Sheet */}
      <ComparisonView />
    </>
  )
}
