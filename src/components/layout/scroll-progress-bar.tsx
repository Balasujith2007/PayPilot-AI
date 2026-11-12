"use client"

import { useEffect, useState } from "react"

export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight
      if (docHeight > 0) {
        const scrolled = (scrollTop / docHeight) * 100
        setProgress(Math.min(100, Math.max(0, scrolled)))
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div
      className="fixed top-16 left-0 right-0 z-40 h-[3px] w-full pointer-events-none bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-brand-gradient transition-[width] duration-75 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

