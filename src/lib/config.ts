// ============================================================================
// Store Configuration — Single source of truth for all store-wide settings.
// Edit this file to customize the store name, contact info, social links, etc.
// ============================================================================

export const siteConfig = {
  // Branding
  name: "PayPilot AI",
  tagline: "A free, open-source Next.js ecommerce template.",
  description:
    "A free, production-ready ecommerce starter template built with Tailwind CSS and shadcn/ui. Responsive, accessible, SEO optimized, and ready to connect to any checkout system. Built by Epic Design Labs.",

  // Announcement bar (set to "" to hide)
  announcement: "Free delivery on all orders over ₹999 — Shop now!",

  // URLs
  url: process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",

  // Contact
  contact: {
    email: "support@epicdesignlabs.com",
    phone: "",
    address: {
      street: "",
      suite: "",
      city: "",
      state: "",
      zip: "",
    },
  },

  // Social links (set to "" to hide)
  social: {
    twitter: "https://x.com/",
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    youtube: "https: //youtube.com/",
    tiktok: "",
  },

  // Shipping
  freeShippingThreshold: 99900, // in cents (₹999.00)
  taxRate: 0.08, // 8%

  // Currency & locale
  currency: "INR",
  locale: "en-IN",

  // Legal
  copyrightYear: new Date().getFullYear(),
} as const

export type SiteConfig = typeof siteConfig
