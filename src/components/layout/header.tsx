"use client"

import Link from "next/link"
import {
  Search,
  ShoppingBag,
  User,
  Menu,
  Heart,
  LogOut,
  ChevronDown,
  Sparkles,
  Shield,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SearchModal } from "@/components/search/search-modal"
import { cn } from "@/lib/utils"
import { mobileMenuSections } from "@/lib/navigation"
import { useTranslations } from "next-intl"
import { useState, useEffect, useRef } from "react"
import type { Category } from "@/types"
import { useCartStore } from "@/store/cart"
import { useAuthStore } from "@/store/auth"
import { useRouter } from "next/navigation"

interface HeaderProps {
  /** All categories from the repository layer */
  categories?: Category[]
}

export function Header({ categories = [] }: HeaderProps) {
  const allCategories = categories
  const topCategories = allCategories.filter((c) => !c.parentId)

  const t = useTranslations("nav")
  const tCommon = useTranslations("common")
  const router = useRouter()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)

  const openCart = useCartStore((s) => s.openCart)
  const getItemCount = useCartStore((s) => s.getItemCount)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const itemCount = mounted ? getItemCount() : 0

  // Badge scale animation when item count changes
  const [badgeScale, setBadgeScale] = useState(false)
  const prevCountRef = useRef(itemCount)

  useEffect(() => {
    if (prevCountRef.current !== itemCount) {
      prevCountRef.current = itemCount
      const startId = window.requestAnimationFrame(() => setBadgeScale(true))
      const timer = setTimeout(() => setBadgeScale(false), 300)
      return () => {
        window.cancelAnimationFrame(startId)
        clearTimeout(timer)
      }
    }
  }, [itemCount])

  // Scroll listener for header shadow
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8)
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Cmd+K / Ctrl+K keyboard shortcut to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full bg-white transition-shadow duration-200",
          scrolled
            ? "shadow-[0_4px_16px_rgba(0,0,0,0.06)] border-b border-black/5"
            : "border-b border-black/10"
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-3 sm:px-6 lg:px-8 gap-2 sm:gap-4">
          {/* Mobile hamburger menu */}
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-black hover:bg-[#F0EEED] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                aria-label={t("openMenu")}
                aria-expanded={mobileMenuOpen}
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent
                side="left"
                className="!w-full !gap-0 sm:!w-80"
                showCloseButton={false}
              >
                <div className="shrink-0 px-6 pt-5 pb-2">
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm font-medium text-muted-foreground hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-sm"
                  >
                    &larr; {tCommon("close")}
                  </button>
                </div>

                <nav className="flex flex-1 flex-col overflow-y-auto px-6 pb-8">
                  {mobileMenuSections.map((section, sectionIdx) => (
                    <div key={section.label}>
                      {sectionIdx > 0 && <div className="my-4 border-t" />}
                      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {section.label}
                      </p>
                      <div className="ml-3">
                        {section.items.map((item) => {
                          const slug = item.href.replace("/", "")
                          const parentCat = allCategories.find(
                            (c) => c.slug === slug
                          )
                          const subcats = parentCat
                            ? allCategories.filter(
                                (c) => c.parentId === parentCat.id
                              )
                            : []
                          const hasSubcats = subcats.length > 0
                          const isExpanded = expandedCategory === item.name

                          return (
                            <div key={item.name}>
                              <div className="flex items-center">
                                <Link
                                  href={item.href}
                                  className="flex-1 py-2.5 text-sm font-medium text-black transition-colors hover:text-black/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black rounded-sm"
                                  onClick={() => setMobileMenuOpen(false)}
                                >
                                  {item.name}
                                </Link>
                                {hasSubcats && (
                                  <button
                                    onClick={() =>
                                      setExpandedCategory(
                                        isExpanded ? null : item.name
                                      )
                                    }
                                    className="p-2 text-muted-foreground hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black rounded-sm"
                                    aria-label={`${
                                      isExpanded ? "Collapse" : "Expand"
                                    } ${item.name}`}
                                    aria-expanded={isExpanded}
                                  >
                                    <ChevronDown
                                      className={cn(
                                        "h-4 w-4 transition-transform",
                                        isExpanded && "rotate-180"
                                      )}
                                    />
                                  </button>
                                )}
                              </div>
                              {hasSubcats && isExpanded && (
                                <div className="mb-2 ml-4 flex flex-col border-l pl-4">
                                  {subcats.map((sub) => (
                                    <Link
                                      key={sub.id}
                                      href={`/${sub.slug}`}
                                      className="py-2 text-sm text-muted-foreground transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black rounded-sm"
                                      onClick={() => setMobileMenuOpen(false)}
                                    >
                                      {sub.name}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Logo (Mobile) */}
            <Link
              href="/"
              className="font-display text-xl sm:text-2xl font-black tracking-tight text-black shrink-0 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-sm"
            >
              PAYPILOT AI
            </Link>
          </div>

          {/* Logo (Desktop) */}
          <Link
            href="/"
            className="hidden lg:inline-block font-display text-2xl font-black tracking-tight text-black shrink-0 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-sm mr-4"
          >
            PAYPILOT AI
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex lg:items-center lg:gap-6 shrink-0">
            {/* Shop dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="group inline-flex items-center gap-1 py-1 text-sm font-medium text-black/80 hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-sm">
                <span>Shop</span>
                <ChevronDown className="h-4 w-4 text-black/60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56 p-2 rounded-2xl border border-black/10 bg-white shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150 motion-reduce:animate-none"
              >
                <DropdownMenuItem
                  onClick={() => router.push("/shop")}
                  className="font-semibold text-black hover:bg-[#F0EEED] rounded-xl px-3 py-2 cursor-pointer transition-colors"
                >
                  All Products
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-black/5" />
                {topCategories.map((cat) => (
                  <DropdownMenuItem
                    key={cat.id}
                    onClick={() => router.push(`/${cat.slug}`)}
                    className="text-sm text-black/80 hover:text-black hover:bg-[#F0EEED] rounded-xl px-3 py-2 cursor-pointer transition-colors"
                  >
                    {cat.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* On Sale */}
            <Link
              href="/shop?sale=true"
              className="relative py-1 text-sm font-medium text-black/80 hover:text-black transition-colors after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-black after:transition-all after:duration-200 hover:after:w-full motion-reduce:after:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-sm"
            >
              On Sale
            </Link>

            {/* New Arrivals */}
            <Link
              href="/shop?sort=newest"
              className="relative py-1 text-sm font-medium text-black/80 hover:text-black transition-colors after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-black after:transition-all after:duration-200 hover:after:w-full motion-reduce:after:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-sm"
            >
              New Arrivals
            </Link>

            {/* Brands */}
            <Link
              href="/brands"
              className="relative py-1 text-sm font-medium text-black/80 hover:text-black transition-colors after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-black after:transition-all after:duration-200 hover:after:w-full motion-reduce:after:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-sm"
            >
              Brands
            </Link>
          </nav>

          {/* Desktop Search Bar (wide rounded-full #F0EEED) */}
          <div className="hidden md:flex flex-1 max-w-xl mx-2 lg:mx-6">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center gap-3 rounded-full bg-[#F0EEED] px-4 py-2.5 text-sm text-black/50 hover:text-black/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              aria-label="Search for products"
            >
              <Search className="h-4 w-4 text-black/40 shrink-0" />
              <span className="truncate text-left text-black/60">
                Search for products...
              </span>
              <kbd className="hidden lg:inline-flex ml-auto text-[10px] font-semibold tracking-wider text-black/40 bg-white/70 px-2 py-0.5 rounded-full border border-black/5">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right-side Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F0EEED] text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              aria-label={t("searchProducts")}
            >
              <Search className="h-5 w-5" />
            </button>

            {/* "Ask AI" black pill link (visible on desktop & mobile) */}
            <Link
              href="/ai-assistant"
              className="inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 sm:px-3.5 sm:py-1.5 text-xs font-bold text-white shadow-sm hover:bg-black/85 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 shrink-0"
              aria-label="Ask AI Assistant"
            >
              <Sparkles className="h-3.5 w-3.5 text-white" />
              <span>Ask AI</span>
            </Link>

            {/* Wishlist */}
            <Link
              href="/wishlist"
              className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F0EEED] text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              aria-label={t("wishlist")}
            >
              <Heart className="h-5 w-5" />
            </Link>

            {/* Cart with scaling badge */}
            <button
              type="button"
              onClick={openCart}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F0EEED] text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              aria-label={t("openCart")}
            >
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && (
                <span
                  className={cn(
                    "absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white transition-transform duration-200 motion-reduce:transition-none",
                    badgeScale && "scale-125"
                  )}
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label={`${itemCount} items in cart`}
                >
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </button>

            {/* Account Menu */}
            {mounted && isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F0EEED] text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                  aria-label={t("accountMenu")}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                    {user?.firstName?.[0] ?? "U"}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-2xl border border-black/10 bg-white p-2 shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150 motion-reduce:animate-none"
                >
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold text-black">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-black/60 truncate">
                      {user?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator className="my-1 bg-black/5" />
                  {user?.role === "admin" && (
                    <>
                      <DropdownMenuItem
                        onClick={() => router.push("/admin")}
                        className="cursor-pointer rounded-xl px-3 py-2 bg-black text-white hover:bg-black/90 font-medium flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5" />
                          <span>Admin Portal</span>
                        </span>
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">
                          ADMIN
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 bg-black/5" />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={() => router.push("/account")}
                    className="cursor-pointer rounded-xl px-3 py-2 hover:bg-[#F0EEED] font-medium"
                  >
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/account/orders")}
                    className="cursor-pointer rounded-xl px-3 py-2 hover:bg-[#F0EEED]"
                  >
                    Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/account/settings")}
                    className="cursor-pointer rounded-xl px-3 py-2 hover:bg-[#F0EEED]"
                  >
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 bg-black/5" />
                  <DropdownMenuItem
                    onClick={() => {
                      logout()
                      router.push("/")
                    }}
                    className="cursor-pointer rounded-xl px-3 py-2 text-[#FF3333] hover:bg-[#FFEBEB]"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {tCommon("signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F0EEED] text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                aria-label={tCommon("signIn")}
              >
                <User className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
