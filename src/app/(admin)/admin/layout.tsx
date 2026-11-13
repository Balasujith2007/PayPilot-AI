"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Package,
  Boxes,
  Truck,
  FileText,
  Layers,
  Sparkles,
  Shield,
  ArrowLeft,
  Store,
  Tag,
  FolderTree,
  Users,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useAuthStore } from "@/store/auth"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface AdminNavItem {
  name: string
  href: string
  icon: LucideIcon
  description: string
  badge?: string
}

const adminNav: AdminNavItem[] = [
  {
    name: "Analytics & BI",
    href: "/admin",
    icon: BarChart3,
    description: "Revenue, trends & funnels",
  },
  {
    name: "Product Management",
    href: "/admin/products",
    icon: Layers,
    description: "CRUD, pricing, stock & images",
  },
  {
    name: "Categories & Brands",
    href: "/admin/categories",
    icon: FolderTree,
    description: "Structure & brand directory",
  },
  {
    name: "Orders & Fulfillment",
    href: "/admin/orders",
    icon: Package,
    description: "Order stages, AWB & dispatch",
  },
  {
    name: "User Management",
    href: "/admin/users",
    icon: Users,
    description: "Customers, roles & spend",
  },
  {
    name: "Promotions & Pricing",
    href: "/admin/coupons",
    icon: Tag,
    description: "Campaigns, flash sales & banners",
  },
  {
    name: "Billing & Invoicing",
    href: "/admin/billing",
    icon: FileText,
    description: "Tax invoices, GST & settlements",
  },
  {
    name: "Shipping & Logistics",
    href: "/admin/logistics",
    icon: Truck,
    description: "Radar, couriers & pincodes",
  },
  {
    name: "Inventory & Stock",
    href: "/admin/inventory",
    icon: Boxes,
    description: "Safety stock, audit & restock",
  },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isReady } = useAuthGuard()
  const pathname = usePathname()
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Auto-close mobile drawer when switching route
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setMobileMenuOpen(false)
  }

  const handleSignOut = () => {
    logout()
    toast.success("Signed out successfully")
    router.push("/auth/login")
  }

  if (!isReady) return null

  if (user?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0EEED]/40 p-4">
        <div className="w-full max-w-md rounded-[20px] border border-black/10 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Shield className="size-6" />
          </div>
          <h1 className="text-2xl font-black text-black">Access Denied</h1>
          <p className="mt-2 text-sm text-black/60">
            You need administrator privileges to access the PayPilot AI business cockpit.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/auth/login?redirect=/admin"
              className="inline-flex w-full items-center justify-center rounded-full bg-black py-2.5 text-sm font-semibold text-white hover:bg-black/85 transition-colors"
            >
              Sign In as Admin
            </Link>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-full border border-black/10 py-2.5 text-sm font-medium text-black hover:bg-black/5 transition-colors"
            >
              Return to Store
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#F0EEED]/30 text-black">
      {/* Desktop Sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-black/10 bg-white lg:flex lg:flex-col shadow-xs">
        {/* Brand header */}
        <div className="flex h-18 items-center justify-between border-b border-black/5 px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-black text-white shadow-xs">
              <Shield className="size-5" />
            </div>
            <div>
              <p className="font-display text-base font-black tracking-tight text-black">
                PAYPILOT AI
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-black/50">
                Business Cockpit
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            ADMIN
          </span>
        </div>

        {/* User Card */}
        <div className="border-b border-black/5 p-4 mx-3 my-2 rounded-2xl bg-[#F0EEED]/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
              {user.firstName?.[0] ?? "A"}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-black truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[11px] text-black/60 truncate">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign Out of Admin"
            className="p-1.5 rounded-lg text-black/40 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="size-4" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto">
          {adminNav.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all",
                  isActive
                    ? "bg-black text-white shadow-xs"
                    : "text-black/70 hover:bg-[#F0EEED] hover:text-black"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      "size-4 shrink-0 transition-transform group-hover:scale-110",
                      isActive ? "text-white" : "text-black/60"
                    )}
                  />
                  <div>
                    <p className="text-xs font-bold leading-tight">{item.name}</p>
                    <p
                      className={cn(
                        "text-[10px] font-normal leading-tight",
                        isActive ? "text-white/70" : "text-black/45"
                      )}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>

                {item.badge && !isActive && (
                  <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] font-medium text-black/50">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer with Sign Out */}
        <div className="border-t border-black/10 p-3 bg-white space-y-2 mt-auto">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 py-2.5 px-4 text-xs font-bold text-red-700 transition-all cursor-pointer shadow-2xs group"
          >
            <LogOut className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
            <span>Sign Out</span>
          </button>

          <Link
            href="/"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white py-2 px-3 text-[11px] font-semibold text-black/70 transition-all hover:bg-black/5 hover:text-black"
          >
            <Store className="size-3.5" />
            <span>Switch to Customer Store</span>
          </Link>
        </div>
      </aside>

      {/* Mobile Drawer (Slide-over) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-4/5 max-w-xs bg-white text-black h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b border-black/10 px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-xl bg-black text-white shadow-xs">
                  <Shield className="size-4" />
                </div>
                <div>
                  <p className="font-display text-sm font-black tracking-tight text-black">PAYPILOT AI</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-black/50">Admin Menu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-black/60 hover:text-black hover:bg-black/5 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* User Info */}
            <div className="p-3 mx-3 my-2 rounded-xl bg-[#F0EEED]/60 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                  {user.firstName?.[0] ?? "A"}
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-black truncate">{user.firstName} {user.lastName}</p>
                  <p className="text-[10px] text-black/60 truncate">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Nav Links */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {adminNav.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all",
                      isActive
                        ? "bg-black text-white shadow-xs"
                        : "text-black/75 hover:bg-[#F0EEED] hover:text-black"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon className={cn("size-4 shrink-0", isActive ? "text-white" : "text-black/60")} />
                      <div>
                        <p className="text-xs font-bold">{item.name}</p>
                        <p className={cn("text-[10px]", isActive ? "text-white/70" : "text-black/45")}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </nav>

            {/* Bottom Actions */}
            <div className="border-t border-black/10 p-3 bg-white space-y-2 mt-auto">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 py-2.5 px-4 text-xs font-bold text-red-700 transition-all cursor-pointer shadow-2xs"
              >
                <LogOut className="size-4 shrink-0" />
                <span>Sign Out of Admin</span>
              </button>

              <Link
                href="/"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white py-2 px-3 text-[11px] font-semibold text-black/70 transition-all hover:bg-black/5 hover:text-black"
              >
                <Store className="size-3.5" />
                <span>Switch to Customer Store</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black/10 bg-white/90 px-3 sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Hamburger Drawer Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Admin Menu"
              className="lg:hidden p-2 rounded-xl text-black hover:bg-black/5 active:scale-95 transition-all cursor-pointer"
            >
              <Menu className="size-5" />
            </button>

            <Link
              href="/"
              className="lg:hidden flex items-center gap-1 text-xs font-bold text-black/70 hover:text-black"
            >
              <ArrowLeft className="size-3.5" />
              <span>Store</span>
            </Link>

            <div className="hidden sm:block">
              <h2 className="text-sm font-bold text-black">Executive Command Center</h2>
              <p className="text-[11px] text-black/50">
                Real-time commerce telemetry, operational analytics & performance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 sm:px-3 py-1 text-xs text-emerald-800">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-[10px] sm:text-[11px]">Live (₹)</span>
            </div>

            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#F0EEED] px-3.5 py-1.5 text-xs font-medium text-black hover:bg-black hover:text-white transition-colors"
            >
              <Store className="size-3.5" />
              <span>Storefront</span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold text-red-700 hover:bg-red-600 hover:text-white transition-all cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Page children */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-20 lg:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Quick Navigation Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-black/10 px-1 py-1.5 flex items-center justify-around shadow-lg">
          {[
            { name: "Analytics", href: "/admin", icon: BarChart3 },
            { name: "Orders", href: "/admin/orders", icon: Package },
            { name: "Products", href: "/admin/products", icon: Layers },
            { name: "Billing", href: "/admin/billing", icon: FileText },
          ].map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all",
                  isActive ? "text-black font-black" : "text-black/50 hover:text-black"
                )}
              >
                <item.icon className={cn("size-4 mb-0.5", isActive ? "stroke-[2.5]" : "")} />
                <span>{item.name}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-bold text-black/50 hover:text-black cursor-pointer"
          >
            <Menu className="size-4 mb-0.5" />
            <span>More</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
