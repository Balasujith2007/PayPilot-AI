"use client"

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition,
} from "react"
import { useTranslations } from "next-intl"
import { ArrowUp } from "lucide-react"

export interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

const MAX_CHARS = 1000
const WARN_CHARS = 800

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const t = useTranslations("assistant")
  const [text, setText] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [, startTransition] = useTransition()
  const prevDisabledRef = useRef(disabled)

  // Auto-grow textarea height up to ~5 lines
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    const maxHeight = 100 // max lines before scrolling
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [])

  // Refocus after assistant finishes replying (disabled goes from true to false)
  useEffect(() => {
    if (prevDisabledRef.current && !disabled) {
      textareaRef.current?.focus()
    }
    prevDisabledRef.current = disabled
  }, [disabled])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    if (val.length <= MAX_CHARS) {
      setText(val)
      adjustHeight()
    }
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    startTransition(() => {
      setText("")
    })
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ignore during IME composition (for non-Latin keyboards)
    if (e.nativeEvent.isComposing) return

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isNearLimit = text.length >= WARN_CHARS
  const canSend = text.trim().length > 0 && !disabled

  return (
    <div className="relative w-full p-2 sm:p-3.5 border-t border-black/10 bg-white shrink-0">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="relative flex flex-col items-center w-full"
      >
        <div className="relative flex w-full items-end rounded-[24px] sm:rounded-[28px] bg-[#F0EEED] p-1 sm:p-1.5 border border-transparent focus-within:border-black/20 focus-within:bg-white focus-within:shadow-xs transition-all duration-200">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            disabled={disabled}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={t("inputPlaceholder")}
            aria-label={t("inputAriaLabel")}
            maxLength={MAX_CHARS}
            className="flex-1 min-h-[36px] max-h-[100px] resize-none bg-transparent px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm text-black placeholder:text-black/40 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
          />

          {/* Character counter (appears near limit) */}
          {isNearLimit && (
            <span
              className={`text-[10px] sm:text-[11px] font-medium pb-2 pr-2 select-none ${
                text.length >= MAX_CHARS ? "text-red-500 font-bold" : "text-black/50"
              }`}
              aria-live="polite"
            >
              {text.length}/{MAX_CHARS}
            </span>
          )}

          {/* Send Button */}
          <button
            type="submit"
            disabled={!canSend}
            aria-disabled={!canSend}
            aria-label={t("sendAriaLabel")}
            className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-xs transition-all duration-150 ${
              canSend
                ? "hover:bg-black/85 active:scale-95 cursor-pointer"
                : "opacity-40 cursor-not-allowed"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2`}
          >
            <ArrowUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
