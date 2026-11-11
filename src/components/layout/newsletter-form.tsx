"use client"

import React, { useState } from "react"
import { Mail, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function NewsletterForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setTimeout(() => {
      toast.success("Thanks for subscribing!")
      setEmail("")
      setLoading(false)
    }, 500)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 w-full">
      {/* Email input pill with mail icon */}
      <div className="relative flex items-center w-full">
        <Mail className="absolute left-4.5 size-5 text-black/40 pointer-events-none" />
        <input
          type="email"
          placeholder="Enter your email address"
          aria-label="Email address for newsletter"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full h-12 sm:h-13 rounded-full bg-white pl-12 pr-5 text-sm sm:text-base text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-white/60 transition-all"
        />
      </div>

      {/* White subscribe button pill */}
      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 sm:h-13 rounded-full bg-white text-black font-medium text-sm sm:text-base hover:bg-neutral-100 active:scale-[0.99] disabled:opacity-75 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin text-black" />
            <span>Subscribing...</span>
          </>
        ) : (
          <span>Subscribe to Newsletter</span>
        )}
      </button>
    </form>
  )
}
