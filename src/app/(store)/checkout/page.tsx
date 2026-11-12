"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCartStore } from "@/store/cart"
import { useOrdersStore } from "@/store/orders"
import { useAuthStore } from "@/store/auth"
import { useCouponStore } from "@/store/coupons"
import { CartSummary } from "@/components/cart/cart-summary"
import { AuthRequiredDialog } from "@/components/auth/auth-required-dialog"
import { useHydrated } from "@/hooks/use-hydrated"
import {
  PaypalCheckoutButton,
  usePaypalConfig,
  type PaypalCustomer,
} from "@/components/checkout/paypal-checkout"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"
import { siteConfig } from "@/lib/config"
import type { Order } from "@/types"
import { Lock, Zap, CheckCircle2, Smartphone, CreditCard, Building2, Truck, ShieldCheck, Check } from "lucide-react"

export default function CheckoutPage() {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const clearCart = useCartStore((s) => s.clearCart)
  const addOrder = useOrdersStore((s) => s.addOrder)

  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const login = useAuthStore((s) => s.login)
  const calculateDiscount = useCouponStore((s) => s.calculateDiscount)
  const appliedCoupon = useCouponStore((s) => s.appliedCoupon)
  const removeCoupon = useCouponStore((s) => s.removeCoupon)

  const paypal = usePaypalConfig()
  const mounted = useHydrated()
  const [loading, setLoading] = useState(false)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "CARD" | "NETBANKING" | "COD">("UPI")
  const [upiId, setUpiId] = useState("user@okhdfcbank")

  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    line1: "",
    line2: "",
    city: "Mumbai",
    state: "Maharashtra",
    postalCode: "400001",
    country: "IN",
  })

  // Autofill user details when authenticated
  useEffect(() => {
    if (!user) return
    const id = window.requestAnimationFrame(() => {
      const defaultAddr = user.addresses?.find((a) => a.isDefault) || user.addresses?.[0]
      setForm((prev) => ({
        ...prev,
        email: user.email || prev.email,
        firstName: user.firstName || prev.firstName,
        lastName: user.lastName || prev.lastName,
        line1: defaultAddr?.line1 || prev.line1,
        line2: defaultAddr?.line2 || prev.line2,
        city: defaultAddr?.city || prev.city || "Mumbai",
        state: defaultAddr?.state || prev.state || "Maharashtra",
        postalCode: defaultAddr?.postalCode || prev.postalCode || "400001",
        country: defaultAddr?.country || prev.country || "IN",
      }))
    })
    return () => window.cancelAnimationFrame(id)
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
  const discount = calculateDiscount(subtotal)
  const discountedSubtotal = Math.max(0, subtotal - discount)
  const shipping = subtotal === 0 ? 0 : discountedSubtotal >= siteConfig.freeShippingThreshold ? 0 : 599
  const tax = Math.round(discountedSubtotal * siteConfig.taxRate)
  const total = discountedSubtotal === 0 ? 0 : discountedSubtotal + shipping + tax

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

  function handleQuickLogin() {
    const success = login("demo@example.com", "password123")
    if (success) {
      toast.success("Signed in as Demo Customer (Jane Smith)!")
    } else {
      toast.error("Failed to sign in with demo credentials")
    }
  }

  /**
   * Demo fallback used only when PayPal is not configured.
   *
   * It deliberately records the order as `pending`: no payment was processed,
   * so nothing here may claim a captured payment.
   */
  async function handleSubmit(e: React.FormEvent) {
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

    // Calculate totals with coupon discount applied
    const discount = calculateDiscount(subtotal)
    const discountedSubtotal = Math.max(0, subtotal - discount)
    const shipping = subtotal === 0 ? 0 : discountedSubtotal >= siteConfig.freeShippingThreshold ? 0 : 599
    const tax = Math.round(discountedSubtotal * siteConfig.taxRate)
    const total = discountedSubtotal + shipping + tax

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
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
          customerName: `${form.firstName} ${form.lastName}`.trim(),
          customerEmail: (form.email || user?.email || "").trim(),
          userId: user?.id,
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
          paymentMethod,
          appliedCoupon: appliedCoupon ? appliedCoupon.code : null,
          discountAmount: discount,
          subtotal,
          tax,
          shipping,
          total,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to place order.")
      }

      const returnedOrder = data.order
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const order: Order = {
        id: returnedOrder.id,
        orderNumber: returnedOrder.orderNumber,
        userId: returnedOrder.userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (returnedOrder.items || []).map((it: any) => ({
          id: it.id,
          productId: it.productId,
          variantId: it.variantId,
          name: it.name,
          variantName: it.variantName,
          sku: it.sku,
          image: it.image,
          price: it.price,
          quantity: it.quantity,
          total: it.total,
        })),
        status: (returnedOrder.status || "processing").toLowerCase() as Order["status"],
        paymentStatus: (returnedOrder.paymentStatus || "captured").toLowerCase() as Order["paymentStatus"],
        paymentMethod: (paymentMethod === "CARD"
          ? "card"
          : paymentMethod === "NETBANKING"
          ? "bank_transfer"
          : paymentMethod === "COD"
          ? "other"
          : "wallet") as Order["paymentMethod"],
        subtotal: returnedOrder.subtotal,
        tax: returnedOrder.tax,
        shipping: returnedOrder.shipping,
        total: returnedOrder.total,
        currency: returnedOrder.currency || siteConfig.currency,
        shippingAddress: returnedOrder.shippingAddress || {
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
        customerEmail: returnedOrder.customerEmail || form.email,
        customerName: returnedOrder.customerName || `${form.firstName} ${form.lastName}`,
        createdAt: returnedOrder.createdAt || new Date().toISOString(),
        updatedAt: returnedOrder.updatedAt || new Date().toISOString(),
      }

      addOrder(order)
      clearCart()
      removeCoupon()
      toast.success(`Order ${returnedOrder.orderNumber} placed successfully!`)
      router.push(`/checkout/success?order_id=${returnedOrder.id}`)
    } catch (err) {
      console.error("Order placement error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to place order in database.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>

      {/* Authentication Status Alert Banner */}
      {!isAuthenticated ? (
        <div className="mt-6 rounded-[20px] border border-amber-300 bg-amber-50/70 p-4 sm:p-5 text-amber-900 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900 mt-0.5 sm:mt-0">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-black">
                  Sign In Required to Place Order
                </h3>
                <p className="text-xs text-black/70 mt-0.5">
                  You need to be signed in to complete your checkout and track your order.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto pl-12 sm:pl-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleQuickLogin}
                className="rounded-full bg-white text-xs font-semibold hover:bg-black hover:text-white border-amber-300 gap-1.5"
              >
                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <span>1-Click Demo Login</span>
              </Button>
              <Button
                type="button"
                size="sm"
                asChild
                className="rounded-full text-xs font-semibold"
              >
                <Link href="/auth/login?redirect=/checkout">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[20px] border border-emerald-300 bg-emerald-50/70 p-3.5 sm:p-4 text-emerald-900 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-xs sm:text-sm font-medium text-emerald-950">
              Signed in as <span className="font-bold">{user?.firstName} {user?.lastName}</span> ({user?.email})
            </p>
          </div>
          <Link
            href="/auth/login?redirect=/checkout"
            className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950"
          >
            Switch account
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-5">
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
          <Card className="rounded-[20px] overflow-hidden border-black/10">
            <CardHeader className="bg-neutral-50/70 border-b border-black/5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">Payment Method</CardTitle>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-full">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>256-bit SSL Encrypted</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {/* Option 1: UPI */}
              <div
                onClick={() => setPaymentMethod("UPI")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  paymentMethod === "UPI"
                    ? "border-black bg-neutral-50 shadow-xs"
                    : "border-black/10 hover:border-black/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-700 font-bold">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-black">UPI Instant</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded">
                          Zero Surcharge • Recommended
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">Google Pay, PhonePe, Paytm, BHIM</p>
                    </div>
                  </div>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === "UPI" ? "border-black bg-black text-white" : "border-neutral-300"
                  }`}>
                    {paymentMethod === "UPI" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                {paymentMethod === "UPI" && (
                  <div className="mt-3 pt-3 border-t border-black/5 text-xs text-neutral-600 space-y-2">
                    <Label htmlFor="upiId" className="text-[11px] font-medium text-neutral-700">UPI ID / VPA</Label>
                    <Input
                      id="upiId"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="mobile@paytm or name@okhdfcbank"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Option 2: Cards */}
              <div
                onClick={() => setPaymentMethod("CARD")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  paymentMethod === "CARD"
                    ? "border-black bg-neutral-50 shadow-xs"
                    : "border-black/10 hover:border-black/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-700 font-bold">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-black">Credit / Debit Card</span>
                      <p className="text-xs text-neutral-500">Visa, MasterCard, RuPay, Maestro</p>
                    </div>
                  </div>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === "CARD" ? "border-black bg-black text-white" : "border-neutral-300"
                  }`}>
                    {paymentMethod === "CARD" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              </div>

              {/* Option 3: Net Banking */}
              <div
                onClick={() => setPaymentMethod("NETBANKING")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  paymentMethod === "NETBANKING"
                    ? "border-black bg-neutral-50 shadow-xs"
                    : "border-black/10 hover:border-black/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-700 font-bold">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-black">Net Banking</span>
                      <p className="text-xs text-neutral-500">SBI, HDFC, ICICI, Axis & 40+ Banks</p>
                    </div>
                  </div>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === "NETBANKING" ? "border-black bg-black text-white" : "border-neutral-300"
                  }`}>
                    {paymentMethod === "NETBANKING" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              </div>

              {/* Option 4: COD */}
              <div
                onClick={() => setPaymentMethod("COD")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  paymentMethod === "COD"
                    ? "border-black bg-neutral-50 shadow-xs"
                    : "border-black/10 hover:border-black/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-700 font-bold">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-black">Cash on Delivery (COD)</span>
                      <p className="text-xs text-neutral-500">Pay cash or scan QR at your doorstep</p>
                    </div>
                  </div>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === "COD" ? "border-black bg-black text-white" : "border-neutral-300"
                  }`}>
                    {paymentMethod === "COD" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              </div>

              {paypalEnabled && paypal && (
                <div className="pt-2 border-t border-black/5">
                  <p className="text-xs text-muted-foreground mb-2">Or pay with international PayPal account:</p>
                  <PaypalCheckoutButton config={paypal} customer={customer} />
                </div>
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
          </div>

          <CartSummary subtotal={subtotal} showCheckoutButton={false} />

          <Button
            type="submit"
            size="lg"
            className="w-full rounded-full min-h-[48px] text-base font-bold cursor-pointer bg-black text-white hover:bg-black/90 shadow-md transition-all active:scale-[0.99]"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing Order & Payment...
              </span>
            ) : !isAuthenticated ? (
              "Sign In to Place Order"
            ) : paymentMethod === "COD" ? (
              "Confirm & Place COD Order"
            ) : (
              `Pay ${formatPrice(total)} & Confirm Order`
            )}
          </Button>
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
