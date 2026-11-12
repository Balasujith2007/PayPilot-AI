"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCartStore } from "@/store/cart"
import { useOrdersStore } from "@/store/orders"
import { useAuthStore } from "@/store/auth"
import { CartSummary } from "@/components/cart/cart-summary"
import {
  PaypalCheckoutButton,
  usePaypalConfig,
  type PaypalCustomer,
} from "@/components/checkout/paypal-checkout"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"
import { siteConfig } from "@/lib/config"
import type { Order } from "@/types"
import { AuthRequiredDialog } from "@/components/auth/auth-required-dialog"

export default function CheckoutPage() {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const clearCart = useCartStore((s) => s.clearCart)
  const addOrder = useOrdersStore((s) => s.addOrder)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const paypal = usePaypalConfig()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)

  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  })

  useEffect(() => {
    setMounted(true)
    if (user) {
      const defaultAddr = user.addresses?.find((a) => a.isDefault) ?? user.addresses?.[0]
      setForm((f) => ({
        ...f,
        email: f.email || user.email || "",
        firstName: f.firstName || user.firstName || defaultAddr?.firstName || "",
        lastName: f.lastName || user.lastName || defaultAddr?.lastName || "",
        line1: f.line1 || defaultAddr?.line1 || "",
        line2: f.line2 || defaultAddr?.line2 || "",
        city: f.city || defaultAddr?.city || "",
        state: f.state || defaultAddr?.state || "",
        postalCode: f.postalCode || defaultAddr?.postalCode || "",
        country: f.country || defaultAddr?.country || "US",
      }))
    }
  }, [user])

  if (!mounted) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            Your cart is empty. Add some products before checking out.
          </p>
          <Button className="mt-8" asChild>
            <Link href="/shop">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    )
  }

  const subtotal = getSubtotal()

  // PayPal is the only real payment path. `null` means the config request is
  // still in flight, so the demo fallback must wait rather than flash on screen.
  const paypalEnabled = paypal !== null && paypal.enabled && Boolean(paypal.clientId)

  const customer: PaypalCustomer = {
    customerEmail: form.email || user?.email || undefined,
    customerName:
      [form.firstName, form.lastName].filter(Boolean).join(" ") ||
      (user ? `${user.firstName} ${user.lastName}` : undefined),
    userId: user?.id,
    shippingAddress:
      form.firstName && form.line1 && form.city && form.state && form.postalCode
        ? {
            firstName: form.firstName,
            lastName: form.lastName,
            line1: form.line1,
            line2: form.line2 || undefined,
            city: form.city,
            state: form.state,
            postalCode: form.postalCode,
            country: form.country,
          }
        : undefined,
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  /**
   * Demo fallback used only when PayPal is not configured.
   *
   * It deliberately records the order as `pending`: no payment was processed,
   * so nothing here may claim a captured payment.
   */
  async function handleDemoSubmit(e: React.FormEvent) {
    e.preventDefault()

    // 🔒 Auth Gate: User MUST be signed in to place an order
    if (!isAuthenticated) {
      toast.error("Please sign in or create an account before placing your order.")
      setAuthDialogOpen(true)
      return
    }

    if (
      !form.email ||
      !form.firstName ||
      !form.lastName ||
      !form.line1 ||
      !form.city ||
      !form.state ||
      !form.postalCode
    ) {
      toast.error("Please fill in all required shipping & contact fields")
      return
    }

    setLoading(true)

    const shipping = subtotal >= siteConfig.freeShippingThreshold ? 0 : 599
    const tax = Math.round(subtotal * siteConfig.taxRate)
    const total = subtotal + shipping + tax
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`

    const order: Order = {
      id: orderId,
      orderNumber: orderId,
      userId: user?.id,
      items: items.map((item) => ({
        id: item.id || `item-${Math.random().toString(36).substring(2, 9)}`,
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        variantName: item.variantName,
        sku: "",
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        total: item.lineTotal,
      })),
      status: "processing",
      paymentStatus: "pending",
      paymentMethod: "other",
      subtotal,
      tax,
      shipping,
      total,
      currency: siteConfig.currency,
      shippingAddress: {
        id: `addr-${Date.now()}`,
        type: "shipping",
        firstName: form.firstName,
        lastName: form.lastName,
        line1: form.line1,
        line2: form.line2 || undefined,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        country: form.country,
        isDefault: true,
      },
      customerEmail: (form.email || user?.email || "").trim(),
      customerName:
        `${form.firstName} ${form.lastName}`.trim() ||
        user?.firstName ||
        "Customer",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    addOrder(order)
    clearCart()
    toast.message("Demo order created", {
      description: "No payment was processed — PayPal is not configured on this server.",
    })
    router.push(`/checkout/success?order_id=${orderId}`)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>

      <form onSubmit={handleDemoSubmit} className="mt-8 grid gap-8 lg:grid-cols-5">
        {/* Form */}
        <div className="space-y-8 lg:col-span-3">
          {/* Contact */}
          <Card className="rounded-[20px]">
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Shipping */}
          <Card className="rounded-[20px]">
            <CardHeader>
              <CardTitle className="text-lg">Shipping Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <Label htmlFor="line1">Address</Label>
                <Input
                  id="line1"
                  name="line1"
                  value={form.line1}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="line2">Apartment, suite, etc. (optional)</Label>
                <Input
                  id="line2"
                  name="line2"
                  value={form.line2}
                  onChange={handleChange}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">ZIP code</Label>
                  <Input
                    id="postalCode"
                    name="postalCode"
                    value={form.postalCode}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {paypal === null ? (
                <p data-testid="paypal-loading" className="text-sm text-muted-foreground">
                  Loading payment options…
                </p>
              ) : paypalEnabled && paypal ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Pay with PayPal. Your card details stay with PayPal and are never
                    shared with this store.
                  </p>
                  <PaypalCheckoutButton config={paypal} customer={customer} />
                </>
              ) : (
                <p data-testid="paypal-unavailable" className="text-sm text-muted-foreground">
                  {paypal.reason ??
                    "PayPal is not configured on this server. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to accept real payments."}{" "}
                  The button below records a demo order only — no payment is processed.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-24">
          <div className="rounded-[20px] border border-black/10 bg-white p-5 text-left shadow-xs">
            <h3 className="font-bold text-base text-black mb-3">Your Items ({items.length})</h3>
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 divide-y divide-black/5">
              {items.map((item) => (
                <div key={item.variantId} className="flex justify-between text-xs sm:text-sm pt-2 first:pt-0">
                  <span className="text-black/70 truncate max-w-[180px]">
                    {item.name} &times; {item.quantity}
                  </span>
                  <span className="font-semibold text-black tabular-nums">{formatPrice(item.lineTotal)}</span>
                </div>
              ))}
            </div>
            <Separator />
            <CartSummary subtotal={subtotal} />
            {paypalEnabled ? (
              <p className="text-sm text-muted-foreground">
                Complete your purchase with the PayPal button in the Payment
                section to the left.
              </p>
            ) : (
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Processing..." : "Place Demo Order"}
              </Button>
            )}
          </div>
        </div>
      </form>

      <AuthRequiredDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        redirectUrl="/checkout"
        title="Sign In to Place Order"
        description="Please sign in or create an account to finalize and place your order."
      />
    </div>
  )
}
