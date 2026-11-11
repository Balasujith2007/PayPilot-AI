"use client"

import React, { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  /** Delay in milliseconds or seconds (e.g. 200 or 0.2) */
  delay?: number
  /** Whether the reveal animation should only trigger once (default: true) */
  once?: boolean
  /** Threshold of element visibility before triggering (default: 0.1) */
  threshold?: number
}

export function Reveal({
  children,
  className,
  delay = 0,
  once = true,
  threshold = 0.1,
  style,
  ...props
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Immediately show for reduced motion preference
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const id = window.requestAnimationFrame(() => setIsVisible(true))
      return () => window.cancelAnimationFrame(id)
    }

    if (typeof IntersectionObserver === "undefined") {
      const id = window.requestAnimationFrame(() => setIsVisible(true))
      return () => window.cancelAnimationFrame(id)
    }

    // Safety fallback: reveal after 1.8s in case observer is blocked
    const fallbackTimer = setTimeout(() => {
      setIsVisible(true)
    }, 1800)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          clearTimeout(fallbackTimer)
          if (once) {
            observer.unobserve(el)
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold }
    )

    observer.observe(el)

    return () => {
      clearTimeout(fallbackTimer)
      observer.disconnect()
    }
  }, [once, threshold])

  const delayMs = delay > 0 ? (delay < 10 ? delay * 1000 : delay) : 0

  return (
    <div
      ref={ref}
      data-reveal=""
      style={{
        ...style,
        ...(delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : {}),
      }}
      className={cn(
        "transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:pointer-events-auto",
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-6 pointer-events-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
