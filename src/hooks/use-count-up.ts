"use client"

import { useEffect, useRef, useState } from "react"

export interface UseCountUpOptions {
  /** Target final number to count up to */
  end: number
  /** Starting number, defaults to 0 */
  start?: number
  /** Duration in milliseconds, defaults to 1200ms (~1.2s) */
  duration?: number
  /** Number of decimal places, defaults to 0 */
  decimals?: number
  /** Explicit trigger: if provided, counting starts when true; if omitted, triggers via IntersectionObserver on ref */
  isVisible?: boolean
}

// Cubic easeOut: fast start, smooth settle
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function useCountUp(options: UseCountUpOptions | number) {
  const opts: UseCountUpOptions =
    typeof options === "number" ? { end: options } : options

  const {
    end,
    start = 0,
    duration = 1200,
    decimals = 0,
    isVisible: explicitVisible,
  } = opts

  const ref = useRef<HTMLElement | null>(null)
  const [inView, setInView] = useState(false)
  const [value, setValue] = useState(start)

  // IntersectionObserver to auto-detect visibility when ref is attached
  useEffect(() => {
    if (explicitVisible !== undefined) return

    const el = ref.current
    if (!el) return

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const id = window.requestAnimationFrame(() => setInView(true))
      return () => window.cancelAnimationFrame(id)
    }

    if (typeof IntersectionObserver === "undefined") {
      const id = window.requestAnimationFrame(() => setInView(true))
      return () => window.cancelAnimationFrame(id)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [explicitVisible])

  const shouldStart = explicitVisible !== undefined ? explicitVisible : inView

  useEffect(() => {
    if (!shouldStart) return

    // If user prefers reduced motion, jump directly to final value
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const id = window.requestAnimationFrame(() => setValue(end))
      return () => window.cancelAnimationFrame(id)
    }

    let startTime: number | null = null
    let frameId: number

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeOutCubic(progress)
      const current = start + (end - start) * easedProgress

      const factor = Math.pow(10, decimals)
      setValue(Math.round(current * factor) / factor)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step)
      } else {
        setValue(end)
      }
    }

    frameId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(frameId)
  }, [shouldStart, start, end, duration, decimals])

  const formattedValue = value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return {
    value,
    formattedValue,
    ref,
  }
}
