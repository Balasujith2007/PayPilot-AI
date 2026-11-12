"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthCardLayout } from "@/components/auth/auth-card-layout"
import { useAuthStore } from "@/store/auth"
import { toast } from "sonner"
import { registerSchema } from "@/lib/validators"

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get("redirect") || "/account"

  const register = useAuthStore((s) => s.register)
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = registerSchema.safeParse(form)
    if (!validation.success) {
      toast.error(validation.error.issues[0].message)
      return
    }
    setLoading(true)
    const success = register({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      password: form.password,
    })
    if (success) {
      toast.success("Account created successfully!")
      router.push(redirectUrl)
    } else {
      toast.error("An account with this email already exists")
    }
    setLoading(false)
  }

  const loginHref =
    redirectUrl && redirectUrl !== "/account"
      ? `/auth/login?redirect=${encodeURIComponent(redirectUrl)}`
      : "/auth/login"

  return (
    <AuthCardLayout
      title="Create an account"
      subtitle={
        redirectUrl.includes("checkout")
          ? "Create an account to complete your checkout and place your order"
          : "Join us to start shopping"
      }
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkHref={loginHref}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>
        <Button type="submit" className="w-full rounded-full min-h-[44px]" disabled={loading}>
          {loading ? "Creating..." : "Create Account"}
        </Button>
      </form>
    </AuthCardLayout>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md p-8 text-center text-sm text-black/60">
          Loading registration form...
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
