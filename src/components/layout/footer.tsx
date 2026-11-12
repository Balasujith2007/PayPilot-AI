import Link from "next/link"
import { siteConfig } from "@/lib/config"
import { NewsletterSection } from "@/components/home/newsletter-section"

/* ============================================================================
   PAYMENT BADGES CONFIGURATION
   ============================================================================ */
const SHOW_PAYMENT_BADGES = false
const PAYMENT_BADGES = ["UPI", "Visa", "Mastercard", "RuPay"]

/* ── Social Icons (Clean SVGs) ─────────────────────────────────────────── */
function IconTwitter({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function IconGitHub({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  )
}

/* ── 4 Link Columns using existing footer link groups and routes ───────── */
const footerLinkColumns = [
  {
    title: "COMPANY",
    links: [
      { name: "About", href: "/about" },
      { name: "Our Story", href: "/pages/our-story" },
      { name: "Sustainability", href: "/pages/sustainability" },
      { name: "Blog", href: "/blog" },
    ],
  },
  {
    title: "HELP",
    links: [
      { name: "Customer Support", href: "/contact" },
      { name: "Delivery Details", href: "/policies/shipping" },
      { name: "Terms & Conditions", href: "/policies/terms" },
      { name: "Privacy Policy", href: "/policies/privacy" },
    ],
  },
  {
    title: "FAQ",
    links: [
      { name: "Account", href: "/account" },
      { name: "Manage Deliveries", href: "/account/orders" },
      { name: "Orders", href: "/account/orders" },
      { name: "Returns & Refunds", href: "/policies/returns" },
    ],
  },
  {
    title: "RESOURCES",
    links: [
      { name: "All Products", href: "/shop" },
      { name: "All Brands", href: "/brands" },
      { name: "New Arrivals", href: "/shop?sort=newest" },
      { name: "Sale", href: "/shop?sale=true" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="relative mt-12 sm:mt-16">
      {/* Overlapping Newsletter Card: lower half sits on the footer's gray background */}
      <div className="relative">
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-[#F0EEED] dark:bg-[#0c0c0c]" />
        <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <NewsletterSection />
        </div>
      </div>

      {/* Main Footer Container with #F0EEED background */}
      <div className="bg-[#F0EEED] dark:bg-[#0c0c0c] pt-10 sm:pt-14 pb-8 sm:pb-12">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
            {/* Left Brand Block */}
            <div className="lg:col-span-4 flex flex-col">
              {/* Logo in .font-display */}
              <Link
                href="/"
                className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-black dark:text-white"
              >
                PAYPILOT AI
              </Link>

              {/* Short description */}
              <p className="mt-4 max-w-sm text-sm text-black/75 dark:text-white/75 leading-relaxed font-normal">
                We have products and clothing that suit your style and which you&apos;re proud to own. Guided by PayPilot AI for smarter shopping.
              </p>

              {/* 4 Circular Social Icons with hover lift */}
              <div className="mt-6 flex items-center gap-3">
                <a
                  href={siteConfig.social?.twitter || "https://twitter.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-10 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-black text-black dark:text-white shadow-2xs transition-all duration-200 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black hover:-translate-y-1 active:scale-95 motion-reduce:hover:translate-y-0 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
                  aria-label="Twitter"
                >
                  <IconTwitter className="h-4 w-4" />
                </a>

                <a
                  href={siteConfig.social?.facebook || "https://facebook.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-10 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-black text-black dark:text-white shadow-2xs transition-all duration-200 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black hover:-translate-y-1 active:scale-95 motion-reduce:hover:translate-y-0 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
                  aria-label="Facebook"
                >
                  <IconFacebook className="h-4 w-4" />
                </a>

                <a
                  href={siteConfig.social?.instagram || "https://instagram.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-10 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-black text-black dark:text-white shadow-2xs transition-all duration-200 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black hover:-translate-y-1 active:scale-95 motion-reduce:hover:translate-y-0 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
                  aria-label="Instagram"
                >
                  <IconInstagram className="h-4 w-4" />
                </a>

                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-10 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-black text-black dark:text-white shadow-2xs transition-all duration-200 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black hover:-translate-y-1 active:scale-95 motion-reduce:hover:translate-y-0 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
                  aria-label="GitHub"
                >
                  <IconGitHub className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Right: 4 Link Columns */}
            <div className="lg:col-span-8 grid grid-cols-2 gap-8 sm:grid-cols-4">
              {footerLinkColumns.map((col) => (
                <div key={col.title}>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-black dark:text-white">
                    {col.title}
                  </h3>
                  <ul className="mt-4 sm:mt-5 space-y-3">
                    {col.links.map((link) => (
                      <li key={link.name}>
                        <Link
                          href={link.href}
                          className="relative inline-block text-sm text-black/75 dark:text-white/75 hover:text-black dark:hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 hover:after:w-full after:bg-black dark:after:bg-white after:transition-all after:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white rounded-xs"
                        >
                          {link.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Thin divider */}
          <hr className="my-8 sm:my-10 border-t border-black/10 dark:border-white/10" />

          {/* Bottom Bar: Copyright on left, payment badges row on right (controlled by SHOW_PAYMENT_BADGES) */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs text-black/75 dark:text-white/75">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p>
                {siteConfig.name} &copy; {siteConfig.copyrightYear ?? "2000-2026"}. All Rights Reserved.
              </p>
              <span className="hidden sm:inline" aria-hidden="true">
                &bull;
              </span>
              <p>
                Built with Next.js &amp; Tailwind CSS. Open-source under MIT License.
              </p>
            </div>

            {/* Payment Badges (hidden by default via SHOW_PAYMENT_BADGES = false) */}
            {SHOW_PAYMENT_BADGES && (
              <div className="flex flex-wrap items-center gap-2" aria-label="Accepted payment methods">
                {PAYMENT_BADGES.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center justify-center rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-black px-2.5 py-1 text-[11px] font-semibold text-black dark:text-white shadow-2xs"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}
