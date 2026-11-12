"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Check,
  CircleAlert,
  Clock,
  Loader2,
  Lock,
  ShoppingBag,
  ShieldCheck,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ProductImage } from "@/components/ui/product-image"
import { cn } from "@/lib/utils"
import type { CartProposal } from "@/types"

/**
 * Terminal states the card can settle into.
 *
 * Everything except `pending` is final, so the buttons disappear and the
 * shopper asks the assistant for a new proposal instead.
 */
export type CartProposalState =
  | "pending"
  | "applied"
  | "cancelled"
  | "expired"
  | "invalid"
  | "processed"

interface CartProposalCardProps {
  proposal: CartProposal
  state: CartProposalState
  /** True while the server decides the proposal. */
  busy: boolean
  error?: string | null
  onApprove: () => void
  onCancel: () => void
}

function isPast(expiresAt?: string): boolean {
  if (!expiresAt) return false
  const at = Date.parse(expiresAt)
  return Number.isFinite(at) && Date.now() >= at
}

function formatExpiry(expiresAt: string): string {
  const at = new Date(expiresAt)
  if (Number.isNaN(at.getTime())) return ""
  return at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

/**
 * Age the proposal out on screen. Slow tick: expiry is enforced by the server
 * regardless, this only keeps the card honest if it is left open.
 */
function useProposalExpired(expiresAt?: string): boolean {
  const [, setTick] = useState(0)

  // The interval only forces a re-render; expiry is recomputed from the
  // current clock on every render, so there is no state to keep in sync.
  useEffect(() => {
    if (!expiresAt) return

    const timer = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(timer)
  }, [expiresAt])

  return isPast(expiresAt)
}

/**
 * The only place a proposal can turn into a cart change.
 *
 * Nothing here runs on render: the Zustand cart is touched exclusively by the
 * assistant's Add to Cart handler, after the server has decided the proposal.
 */
export function CartProposalCard({
  proposal,
  state,
  busy,
  error,
  onApprove,
  onCancel,
}: CartProposalCardProps) {
  const { summary, items, rejected, expiresAt } = proposal
  const expired = useProposalExpired(expiresAt)

  // A proposal that runs out of time while it is on screen becomes expired,
  // and can no longer be confirmed from here.
  const effectiveState: CartProposalState = state === "pending" && expired ? "expired" : state
  const decided = effectiveState !== "pending"

  return (
    <section
      data-testid="cart-proposal-card"
      data-proposal-state={effectiveState}
      aria-label="Proposed cart changes"
      className="mt-3 overflow-hidden rounded-lg border bg-white"
    >
      <header className="flex items-start gap-2 border-b bg-neutral-50 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
        <div>
          <p className="text-sm font-medium">Cart proposal — needs your approval</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nothing has been added. Review the items and confirm.
          </p>
          {expiresAt && (
            <p
              data-testid="proposal-expiry"
              className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"
            >
              <Clock className="h-3 w-3" />
              {expired ? "Expired at" : "Confirm before"} {formatExpiry(expiresAt)}
            </p>
          )}
        </div>
      </header>

      <ul className="divide-y">
        {items.map((line) => (
          <li key={`${line.variantId}-${line.quantity}`} className="flex gap-3 px-4 py-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-100">
              <ProductImage src={line.image ?? undefined} alt={line.name} sizes="64px" />
            </div>
            <div className="min-w-0 flex-1">
              <Link href={line.url} className="text-sm font-medium hover:underline">
                {line.name}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {line.variantName} · Qty {line.quantity}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {line.unitPriceFormatted} each · {line.availableQuantity} available
              </p>
            </div>
            <div className="shrink-0 text-right text-sm font-medium">{line.lineTotalFormatted}</div>
          </li>
        ))}
      </ul>

      {rejected.length > 0 && (
        <div className="border-t bg-destructive/5 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <CircleAlert className="h-4 w-4" />
            {rejected.length === 1 ? "1 item was not added" : `${rejected.length} items were not added`}
          </p>
          <ul className="mt-2 space-y-1.5">
            {rejected.map((line, index) => (
              <li
                key={`${line.productId}-${line.variantId ?? "none"}-${index}`}
                className="text-xs text-muted-foreground"
              >
                <span className="font-mono">{line.productId}</span> — {line.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2 border-t px-4 py-3">
        <Row label="Subtotal" value={summary.subtotalFormatted} />
        <Row label="Shipping" value={summary.shippingFormatted} />
        <Row label="Estimated tax" value={summary.taxFormatted} />
        <Separator />
        <div className="flex justify-between text-sm font-medium">
          <span>Landed cost</span>
          <span data-testid="proposal-total">{summary.totalFormatted}</span>
        </div>
        {!summary.qualifiesForFreeShipping && (
          <p className="text-xs text-muted-foreground">
            This proposal does not qualify for free shipping.
          </p>
        )}
      </div>

      <div className="border-t px-4 py-3">
        {decided ? (
          <DecisionNotice state={effectiveState} />
        ) : (
          <>
            {error && (
              <p role="alert" data-testid="proposal-error" className="mb-3 text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                onClick={onApprove}
                disabled={busy}
                aria-busy={busy}
                data-testid="proposal-add-to-cart"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    Add to Cart
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onCancel}
                disabled={busy}
                data-testid="proposal-cancel"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" />
              Prices and availability are checked on the server before adding. Payment is never
              started from this chat.
            </p>
          </>
        )}
      </div>
    </section>
  )
}

function DecisionNotice({ state }: { state: Exclude<CartProposalState, "pending"> }) {
  const base = "flex items-center gap-2 rounded-md px-3 py-2 text-sm"

  switch (state) {
    case "applied":
      return (
        <div className="space-y-2">
          <p
            data-testid="proposal-applied"
            className={cn(base, "bg-emerald-50 font-medium text-emerald-800")}
          >
            <Check className="h-4 w-4 shrink-0" />
            Added to your cart.
          </p>
          {/* Hand-off to the store's own checkout. This card can only put items
              in the cart — the order and the payment happen there. */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="sm" className="flex-1">
              <Link href="/checkout" data-testid="proposal-checkout">
                Proceed to checkout
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href="/cart">View cart</Link>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Checkout opens in the store: you review the total and pay there.
          </p>
        </div>
      )
    case "expired":
      return (
        <p data-testid="proposal-expired" className={cn(base, "bg-amber-50 text-amber-900")}>
          <Clock className="h-4 w-4 shrink-0" />
          This proposal expired. Ask the assistant to prepare a new one.
        </p>
      )
    case "invalid":
      return (
        <p data-testid="proposal-invalid" className={cn(base, "bg-amber-50 text-amber-900")}>
          <CircleAlert className="h-4 w-4 shrink-0" />
          This proposal can no longer be confirmed. Ask the assistant for a new one.
        </p>
      )
    case "processed":
      return (
        <p
          data-testid="proposal-processed"
          className={cn(base, "bg-neutral-100 text-muted-foreground")}
        >
          <Check className="h-4 w-4 shrink-0" />
          This proposal has already been handled.
        </p>
      )
    default:
      return (
        <p
          data-testid="proposal-cancelled"
          className={cn(base, "bg-neutral-100 text-muted-foreground")}
        >
          <X className="h-4 w-4 shrink-0" />
          Proposal declined. Your cart was not changed.
        </p>
      )
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}
