import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { redirects as redirectRules } from "./src/lib/redirects";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
    ],
  },

  // Allow PayPal iframes in the application
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.paypal.com https://www.sandbox.paypal.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: https://images.unsplash.com https://plus.unsplash.com; frame-src 'self' https://www.paypal.com https://www.sandbox.paypal.com; connect-src 'self' https://api-m.sandbox.paypal.com https://api-m.paypal.com;"
          },
        ],
      },
    ];
  },

  // Redirects are defined in src/lib/redirects.ts — edit there.
  async redirects() {
    return redirectRules;
  },
};

export default withNextIntl(nextConfig);
