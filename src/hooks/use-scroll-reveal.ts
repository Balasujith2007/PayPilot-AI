"use client"

import { useEffect, useRef, useState } from "react"

interface UseScrollRevealOptions {
  threshold?: number
  rootMargin?: string
  once?: boolean
}

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollRevealOptions = {}
) {
  const { threshold = 0.1, rootMargin = "0px 0px -40px 0px", once = true } = options
  const ref = useRef<T | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

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
            observer.unobserve(element)
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(element)

    return () => {
      clearTimeout(fallbackTimer)
      observer.disconnect()
    }
  }, [threshold, rootMargin, once])

  return { ref, isVisible }
}
