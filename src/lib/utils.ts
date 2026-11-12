import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { siteConfig } from "@/lib/config"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(
  priceInCents: number,
  currency?: string
): string {
  // Always enforce Indian Rupee (INR) and prevent USD/dollars
  const curr = currency && currency !== "USD" ? currency : siteConfig.currency
  const amount = priceInCents / 100
  return new Intl.NumberFormat(siteConfig.locale, {
    style: "currency",
    currency: curr,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date))
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + "..."
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}
