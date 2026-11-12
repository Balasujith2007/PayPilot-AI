"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { useHydrated } from "@/hooks/use-hydrated"

export function useAuthGuard() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const router = useRouter()
  const mounted = useHydrated()

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push("/auth/login")
    }
  }, [mounted, isAuthenticated, router])

  return {
    user,
    isAuthenticated,
    isLoading: !mounted,
    isReady: mounted && isAuthenticated,
  }
}
