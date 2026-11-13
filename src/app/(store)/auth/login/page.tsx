"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthCardLayout } from "@/components/auth/auth-card-layout"
import { useAuthStore } from "@/store/auth"
import { toast } from "sonner"
import { loginSchema } from "@/lib/validators"
import { Zap, ArrowRight, UserCheck, ShieldCheck } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get("redirect") || "/account"

  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  // If already logged in as admin, redirect directly to Image 1 (/admin)
  useEffect(() => {
    const currentUser = useAuthStore.getState().user
    const isAuthed = useAuthStore.getState().isAuthenticated
    if (isAuthed && currentUser?.role === "admin") {
      router.replace("/admin")
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      toast.error(result.error.issues[0].message)
      return
    }
    setLoading(true)
    const success = login(email, password)
    if (success) {
      toast.success("Welcome back!")
      const currentUser = useAuthStore.getState().user
      // When logging in as admin, redirect to Image 1 (/admin) only
      if (currentUser?.role === "admin" || email.trim().toLowerCase() === "admin@example.com") {
        router.push("/admin")
      } else {
        router.push(redirectUrl === "/admin" ? "/account" : redirectUrl)
      }
    } else {
      toast.error("Invalid email or password")
    }
    setLoading(false)
  }

  function handleQuickLogin(role: "customer" | "admin") {
    setLoading(true)
    const creds =
      role === "admin"
        ? { email: "admin@example.com", pass: "password123", label: "Admin User" }
        : { email: "demo@example.com", pass: "password123", label: "Demo Customer (Jane Smith)" }

    const success = login(creds.email, creds.pass)
    if (success) {
      toast.success(`Welcome back, ${creds.label}!`)
      const currentUser = useAuthStore.getState().user
      // When logging in as admin, redirect to Image 1 (/admin) only
      if (currentUser?.role === "admin" || role === "admin" || creds.email === "admin@example.com") {
        router.push("/admin")
      } else {
        router.push(redirectUrl === "/admin" ? "/account" : redirectUrl)
      }
    } else {
      toast.error("Failed to login with demo credentials")
    }
    setLoading(false)
  }

  const registerHref =
    redirectUrl && redirectUrl !== "/account"
      ? `/auth/register?redirect=${encodeURIComponent(redirectUrl)}`
      : "/auth/register"

  return (
    <AuthCardLayout
      title="Welcome back"
      subtitle={
        redirectUrl.includes("checkout")
          ? "Sign in to complete your checkout and place your order"
          : "Sign in to your account to continue"
      }
      footerText="Don't have an account?"
      footerLinkText="Sign up"
      footerLinkHref={registerHref}
    >
      {/* 1-Click Demo Login Bar */}
      <div className="mb-6 rounded-2xl bg-[#F0EEED] p-3.5 border border-black/5">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-black">
            Quick Demo 1-Click Login
          </span>
        </div>
        <p className="text-[11px] text-black/60 mb-2.5">
          Select an account below to log in instantly without typing:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => handleQuickLogin("customer")}
            className="w-full text-xs font-semibold rounded-full bg-white hover:bg-black hover:text-white transition-all border-black/15 min-h-[40px] flex items-center justify-between px-3 cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <UserCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Customer (Jane)</span>
            </div>
            <ArrowRight className="h-3 w-3 shrink-0" />
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => handleQuickLogin("admin")}
            className="w-full text-xs font-semibold rounded-full bg-white hover:bg-black hover:text-white transition-all border-black/15 min-h-[40px] flex items-center justify-between px-3 cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Admin User</span>
            </div>
            <ArrowRight className="h-3 w-3 shrink-0" />
          </Button>
        </div>
      </div>

      <div className="relative my-4 text-center">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-black/10" />
        </div>
        <span className="relative bg-white px-2 text-[11px] font-medium uppercase tracking-wider text-black/40">
          Or sign in with email
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full rounded-full min-h-[44px]" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </AuthCardLayout>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md p-8 text-center text-sm text-black/60">
          Loading login form...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
