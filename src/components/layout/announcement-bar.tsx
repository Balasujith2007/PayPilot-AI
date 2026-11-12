"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { X } from "lucide-react"

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setMounted(true)
      const stored = sessionStorage.getItem("announcement-dismissed")
      if (stored === "true") {
        setDismissed(true)
      }
    })
    return () => window.cancelAnimationFrame(id)
  }, [])

  function handleDismiss() {
    setIsClosing(true)
    setTimeout(() => {
      setDismissed(true)
      sessionStorage.setItem("announcement-dismissed", "true")
    }, 300)
  }

  if (!mounted || dismissed) return null

  return (
    <aside
      aria-label="Announcement"
      className={`relative w-full overflow-hidden bg-black text-white transition-all duration-300 ease-out motion-reduce:transition-none ${
        isClosing ? "max-h-0 opacity-0 py-0" : "max-h-14 opacity-100 py-2.5"
      }`}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-center px-8 text-center text-xs font-normal sm:text-sm">
        <p className="flex items-center gap-1.5">
          <span>Free delivery on orders over ₹999.</span>{" "}
          <Link
            href="/shop"
            className="font-medium underline underline-offset-4 hover:text-white/80 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-sm"
          >
            Shop now
          </Link>
        </p>

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Dismiss announcement"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  )
}
