"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { LogIn, UserPlus, Zap, Lock } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useAuthStore } from "@/store/auth"
import { toast } from "sonner"

export interface AuthRequiredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  redirectUrl?: string
  title?: string
  description?: string
  onSuccess?: () => void
}

export function AuthRequiredDialog({
  open,
  onOpenChange,
  redirectUrl = "/checkout",
  title = "Sign In Required",
  description = "Please sign in to your account or create one before checking out and placing your order.",
  onSuccess,
}: AuthRequiredDialogProps) {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)

  const handleQuickDemoLogin = () => {
    const success = login("demo@example.com", "password123")
    if (success) {
      toast.success("Logged in as Demo Customer (Jane Smith)!")
      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(redirectUrl)
      }
    } else {
      toast.error("Failed to login with demo credentials")
    }
  }

  const handleSignIn = () => {
    onOpenChange(false)
    router.push(`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`)
  }

  const handleSignUp = () => {
    onOpenChange(false)
    router.push(`/auth/register?redirect=${encodeURIComponent(redirectUrl)}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[24px] p-6 bg-white border border-black/10 shadow-2xl">
        <DialogHeader className="text-left space-y-2 pb-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F0EEED] text-black">
            <Lock className="h-5 w-5" />
          </div>
          <DialogTitle className="font-display text-xl sm:text-2xl font-black uppercase tracking-tight text-black pt-1">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-black/60 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* 1-Click Quick Demo Login */}
          <button
            type="button"
            onClick={handleQuickDemoLogin}
            className="w-full flex items-center justify-between rounded-full bg-black text-white px-5 py-3 text-xs sm:text-sm font-semibold hover:bg-black/85 active:scale-95 transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />
              <span>1-Click Demo Login (Instant)</span>
            </div>
            <span className="text-[11px] text-white/70">Jane Smith &rarr;</span>
          </button>

          {/* Standard Sign In & Sign Up Options */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleSignIn}
              className="flex items-center justify-center gap-1.5 rounded-full border border-black/20 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-black hover:bg-[#F0EEED] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={handleSignUp}
              className="flex items-center justify-center gap-1.5 rounded-full border border-black/20 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-black hover:bg-[#F0EEED] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              <UserPlus className="h-4 w-4" />
              <span>Sign Up</span>
            </button>
          </div>
        </div>

        <div className="mt-2 text-center">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-xs text-black/50 hover:text-black transition-colors underline underline-offset-2"
          >
            Continue browsing
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
