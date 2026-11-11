"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Sparkles, ArrowDown } from "lucide-react"
import { useShoppingAssistant } from "@/hooks/useShoppingAssistant"
import { ChatMessage } from "@/components/ai-assistant/chat/ChatMessage"
import { ChatInput } from "@/components/ai-assistant/chat/ChatInput"
import { SuggestedPrompts } from "@/components/ai-assistant/SuggestedPrompts"

export function ChatInterface() {
  const t = useTranslations("assistant")
  const { messages, status, sendMessage, clearConversation } =
    useShoppingAssistant()

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

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length === 0) return

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
  }, [messages])

  const hasMessages = messages.length > 0
  const isLoading = status === "loading"

  return (
    <section
      role="region"
      aria-label={t("chatRegionAria")}
      className="flex flex-col justify-between w-full h-[clamp(580px,calc(100dvh-13rem),800px)] rounded-[20px] border border-black/10 bg-white shadow-xs overflow-hidden"
    >
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-black/10 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-xs"
            aria-hidden="true"
          >
            <Sparkles className="h-4 w-4 animate-sparkle-spin motion-reduce:animate-none" />
          </div>
          <div>
            <p className="font-bold text-sm sm:text-base text-black tracking-tight leading-tight">
              {t("headerTitle")}
            </p>
            <p className="text-xs text-black/60 leading-tight">
              {t("headerSubtitle")}
            </p>
          </div>
        </div>

        {/* Action pills: Clear enabled only when messages exist; Compare disabled until Phase 3 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasMessages}
            onClick={clearConversation}
            aria-disabled={!hasMessages}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black ${
              hasMessages
                ? "border-black/20 text-black hover:bg-[#F0EEED] cursor-pointer"
                : "border-black/15 text-black/40 cursor-not-allowed opacity-60"
            }`}
            aria-label={t("clearConversation")}
          >
            {t("clearConversation")}
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="rounded-full border border-black/15 bg-white px-3.5 py-1.5 text-xs font-medium text-black/40 cursor-not-allowed opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            aria-label={t("compare")}
          >
            {t("compare")}
          </button>
        </div>
      </header>

      {/* Main Area: Welcome State or Message List */}
      <div className="relative flex-1 overflow-hidden flex flex-col min-h-0">
        {!hasMessages ? (
          /* Welcome State */
          <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 sm:py-10 flex flex-col items-center justify-center text-center">
            <div className="relative mb-5 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full bg-black/10 blur-xl animate-sparkle-pulse motion-reduce:animate-none"
                aria-hidden="true"
              />
              <div
                className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-black text-white shadow-[0_4px_20px_rgba(0,0,0,0.18)]"
                aria-hidden="true"
              >
                <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 animate-sparkle-pulse motion-reduce:animate-none" />
              </div>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight text-black max-w-xl leading-[1.08]">
              {t("welcomeHeading")}
            </h1>

            <p className="mt-3 text-xs sm:text-sm text-black/60 max-w-md leading-relaxed">
              {t("welcomeDescription")}
            </p>

            <div className="mt-6 sm:mt-8 w-full">
              <SuggestedPrompts onPromptSelect={sendMessage} />
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
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6"
          >
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        )}

        {/* "New message ↓" Scroll Pill */}
        {showScrollBottomPill && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 animate-fade-in">
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="flex items-center gap-1.5 rounded-full bg-black text-white px-3.5 py-1.5 text-xs font-medium shadow-md hover:bg-black/85 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              aria-label="Scroll to newest message"
            >
              <span>{t("newMessage")}</span>
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </section>
  )
}
