"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { X, Sparkles, Copy, Check } from "lucide-react"

interface PromoBannerData {
  id: string
  title: string
  message: string
  promoCode: string | null
  linkText: string | null
  linkUrl: string | null
  badgeText: string | null
  backgroundColor: string
  textColor: string
}

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [banner, setBanner] = useState<PromoBannerData | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setMounted(true)
      const stored = sessionStorage.getItem("announcement-dismissed")
      if (stored === "true") {
        setDismissed(true)
      }
    })

    // Fetch active announcement banner from database
    fetch("/api/promotions/active")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.banner) {
          setBanner(data.banner)
        }
      })
      .catch(() => {
        // Fallback gracefully
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

  function handleCopyCode(code: string, e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!mounted || dismissed) return null

  const bg = banner?.backgroundColor || "#000000"
  const text = banner?.textColor || "#FFFFFF"

  return (
    <aside
      aria-label="Announcement"
      style={{ backgroundColor: bg, color: text }}
      className={`relative w-full overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none border-b border-white/10 ${
        isClosing ? "max-h-0 opacity-0 py-0" : "max-h-14 opacity-100 py-2 sm:py-2.5"
      }`}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-center px-8 text-center text-xs font-normal sm:text-sm">
        {banner ? (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {banner.badgeText && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">
                <Sparkles className="size-2.5" />
                <span>{banner.badgeText}</span>
              </span>
            )}
            <span className="font-medium text-xs sm:text-sm">{banner.message}</span>
            {banner.promoCode && (
              <button
                type="button"
                onClick={(e) => handleCopyCode(banner.promoCode!, e)}
                title="Click to copy promo code"
                className="inline-flex items-center gap-1 rounded bg-white/20 hover:bg-white/30 px-2 py-0.5 text-[10px] sm:text-xs font-mono font-bold tracking-wider cursor-pointer transition-colors"
              >
                <span>{banner.promoCode}</span>
                {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
              </button>
            )}
            {banner.linkUrl && (
              <Link
                href={banner.linkUrl}
                className="font-bold underline underline-offset-4 hover:opacity-80 transition-opacity ml-1 text-xs"
              >
                {banner.linkText || "Shop now"}
              </Link>
            )}
          </div>
        ) : (
          <p className="flex items-center gap-1.5">
            <span>Free delivery on orders over ₹999.</span>{" "}
            <Link
              href="/shop"
              className="font-medium underline underline-offset-4 hover:text-white/80 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-sm"
            >
              Shop now
            </Link>
          </p>
        )}

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
