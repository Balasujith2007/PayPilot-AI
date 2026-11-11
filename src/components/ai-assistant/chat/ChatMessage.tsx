"use client"

import React, { memo } from "react"
import { useTranslations } from "next-intl"
import { Sparkles, AlertCircle } from "lucide-react"
import { RecommendationList } from "@/components/ai-assistant/chat/RecommendationList"
import type { ChatMessage as ChatMessageType } from "@/types/ai-assistant"

export interface ChatMessageProps {
  message: ChatMessageType
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
            className={`relative px-4 py-3 text-sm sm:text-base leading-relaxed break-words whitespace-pre-wrap shadow-2xs ${
              isUser
                ? "bg-black text-white rounded-[20px] rounded-br-[4px] self-end"
                : "max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] bg-[#F0EEED] text-black rounded-[20px] rounded-bl-[4px] self-start"
            }`}
          >
            {message.content}
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

          {/* Inline Error Notice */}
          {isError && (
            <div
              role="alert"
              className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600 font-medium px-1"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{t("errorMessage")}</span>
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
