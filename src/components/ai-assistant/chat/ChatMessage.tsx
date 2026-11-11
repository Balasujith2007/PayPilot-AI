"use client"

import React, { memo } from "react"
import { useTranslations } from "next-intl"
import { Sparkles, AlertCircle, RotateCw } from "lucide-react"
import { RecommendationList } from "@/components/ai-assistant/chat/RecommendationList"
import { formatAssistantMessage } from "@/lib/ai-assistant/format-message"
import type { ChatMessage as ChatMessageType } from "@/types/ai-assistant"

export interface ChatMessageProps {
  message: ChatMessageType
  onRetry?: () => void
}

function formatTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(new Date(timestamp))
  } catch {
    return ""
  }
}

export const ChatMessage = memo(function ChatMessage({
  message,
  onRetry,
}: ChatMessageProps) {
  const t = useTranslations("assistant")
  const isUser = message.role === "user"
  const isError = isUser && message.status === "error"

  return (
    <div
      className={`flex w-full flex-col ${
        isUser ? "items-end" : "items-start"
      } animate-fade-up motion-reduce:animate-none`}
    >
      <div
        className={`flex w-full gap-2.5 ${
          isUser
            ? "max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] flex-row-reverse"
            : "max-w-full sm:max-w-[95%] lg:max-w-full flex-row"
        }`}
      >
        {/* Assistant Avatar */}
        {!isUser && (
          <div
            className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-black text-white shadow-xs mt-1"
            aria-hidden="true"
          >
            <Sparkles className="h-4 w-4" />
          </div>
        )}

        <div className="flex flex-col flex-1 min-w-0">
          {/* Message Bubble */}
          <div
            className={`relative px-4 py-3 text-sm sm:text-base leading-relaxed break-words shadow-2xs ${
              isUser
                ? "bg-black text-white rounded-[20px] rounded-br-[4px] self-end whitespace-pre-wrap"
                : "max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] bg-[#F0EEED] text-black rounded-[20px] rounded-bl-[4px] self-start"
            }`}
          >
            {isUser ? message.content : formatAssistantMessage(message.content)}
          </div>

          {/* Metadata Row: Timestamp + Demo Response Badge */}
          <div
            className={`mt-1 flex items-center gap-2 px-1 text-[11px] text-black/50 ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            {message.isMock && (
              <span className="inline-flex items-center rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-black/70 select-none">
                {t("demoResponse")}
              </span>
            )}
            <span>{formatTime(message.timestamp)}</span>
          </div>

          {/* Inline Error Notice with Retry Button */}
          {isError && (
            <div
              role="alert"
              className="mt-2 flex flex-wrap items-center gap-2 text-xs text-red-600 font-medium px-1"
            >
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{t("errorMessage")}</span>
              </div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-full border border-red-300 bg-red-50/60 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100/80 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer"
                  aria-label={t("tryAgain")}
                >
                  <RotateCw className="h-3 w-3 shrink-0" />
                  <span>{t("tryAgain")}</span>
                </button>
              )}
            </div>
          )}

          {/* Recommendations List (under the assistant message bubble) */}
          {!isUser && message.products && message.products.length > 0 && (
            <RecommendationList
              products={message.products}
              isMock={message.isMock}
            />
          )}
        </div>
      </div>
    </div>
  )
})
