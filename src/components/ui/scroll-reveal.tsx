"use client"

import React from "react"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { cn } from "@/lib/utils"

interface ScrollRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  delayMs?: number
}

export function ScrollReveal({
  children,
  className,
  delayMs = 0,
  style,
  ...props
}: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>()

  return (
    <div
      ref={ref}
      style={{
        ...style,
        ...(delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : {}),
      }}
      className={cn(
        "scroll-reveal",
        isVisible && "scroll-reveal-visible",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

