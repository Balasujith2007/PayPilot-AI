"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { CartItem } from "./cart-item"
import { useCartStore } from "@/store/cart"
import { useAuthStore } from "@/store/auth"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"

export function CartDrawer() {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const isOpen = useCartStore((s) => s.isOpen)
  const closeCart = useCartStore((s) => s.closeCart)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const subtotal = getSubtotal()

  const handleCheckoutClick = () => {
    closeCart()
    if (!isAuthenticated) {
      toast.info("Please sign in or create an account to proceed to checkout.")
      router.push("/auth/login?redirect=/checkout")
    } else {
      router.push("/checkout")
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent
        side="right"
        className="flex !w-full flex-col !gap-0 sm:!w-3/4 sm:max-w-md"
        showCloseButton={false}
      >
        <SheetHeader>
          <div className="flex items-center justify-between">
            <button
              onClick={closeCart}
              className="text-sm text-muted-foreground hover:text-foreground sm:hidden"
            >
              &larr; Back
            </button>
            <button
              onClick={closeCart}
              className="hidden rounded-md p-1 text-muted-foreground hover:text-foreground sm:block sm:ml-auto"
              aria-label="Close cart"
            >
              &times;
            </button>
            <SheetTitle className="sr-only">Shopping Cart</SheetTitle>
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium">Your cart is empty</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add items to get started
            </p>
            <Button className="mt-6" onClick={closeCart} asChild>
              <Link href="/shop">Continue Shopping</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4">
              <div className="divide-y">
                {items.map((item) => (
                  <CartItem key={item.variantId} item={item} />
                ))}
              </div>
            </div>

            <SheetFooter className="!mt-0 shrink-0 border-t !px-4 !pt-4 !pb-8">
              <div className="w-full space-y-3">
                <div className="flex justify-between text-sm font-medium">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Shipping and taxes calculated at checkout.
                </p>
                <Button
                  className="w-full rounded-full cursor-pointer min-h-[46px]"
                  size="lg"
                  onClick={handleCheckoutClick}
                >
                  {isAuthenticated ? "Proceed to Checkout" : "Sign In to Checkout"}
                </Button>
                <button
                  className="mb-4 w-full py-2 text-center text-sm text-muted-foreground underline hover:text-foreground sm:mb-0 sm:hidden cursor-pointer"
                  onClick={closeCart}
                >
                  Continue Shopping
                </button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
