import { siteConfig } from "@/lib/config"
import type { PaypalClientConfig, PaypalMode } from "@/types"

/**
 * PayPal API hosts.
 *
 * `PAYPAL_API_BASE_URL` is validated against this allow-list, so a mistyped or
 * hostile value can never redirect the OAuth call (which carries the client
 * secret) to an attacker-controlled server.
 */
export const PAYPAL_SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com"
export const PAYPAL_LIVE_BASE_URL = "https://api-m.paypal.com"

/** Hosts, not URLs — `URL.host` is what gets compared below. */
const PAYPAL_LIVE_HOST = "api-m.paypal.com"
const ALLOWED_HOSTS = new Set(["api-m.sandbox.paypal.com", PAYPAL_LIVE_HOST])

/** Resolved, server-side-only PayPal settings. Never sent to the browser. */
export interface PaypalConfig {
  clientId: string
  clientSecret: string
  baseUrl: string
  mode: PaypalMode
  currency: string
}

export type PaypalConfigErrorCode =
  | "MISSING_CLIENT_ID"
  | "MISSING_CLIENT_SECRET"
  | "INVALID_BASE_URL"

export type PaypalConfigResult =
  | { ok: true; config: PaypalConfig }
  | { ok: false; code: PaypalConfigErrorCode; message: string }

/** Everything except the credentials, resolved from `PAYPAL_API_BASE_URL`. */
type PaypalEndpoint = Omit<PaypalConfig, "clientId" | "clientSecret">

type PaypalEndpointResult =
  | { ok: true; endpoint: PaypalEndpoint }
  | { ok: false; code: PaypalConfigErrorCode; message: string }

/** Empty strings are treated as "not configured" (see src/lib/env.ts). */
function readValue(raw: string | undefined): string | undefined {
  const value = raw?.trim()
  return value ? value : undefined
}

/**
 * Resolve the API base URL.
 *
 * Defaults to Sandbox. The app only leaves Sandbox when the Live host is set
 * *explicitly* — there is no NODE_ENV-based or automatic escalation.
 */
export function resolvePaypalEndpoint(raw?: string): PaypalEndpointResult {
  const value = readValue(raw) ?? PAYPAL_SANDBOX_BASE_URL

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return {
      ok: false,
      code: "INVALID_BASE_URL",
      message: `PAYPAL_API_BASE_URL is not a valid URL (expected ${PAYPAL_SANDBOX_BASE_URL}).`,
    }
  }

  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.host)) {
    return {
      ok: false,
      code: "INVALID_BASE_URL",
      message:
        "PAYPAL_API_BASE_URL must be an https URL on api-m.sandbox.paypal.com (Sandbox) or api-m.paypal.com (Live).",
    }
  }

  return {
    ok: true,
    endpoint: {
      baseUrl: `${url.protocol}//${url.host}`,
      mode: url.host === PAYPAL_LIVE_HOST ? "live" : "sandbox",
      currency: siteConfig.currency,
    },
  }
}

/**
 * Read and validate the server-side PayPal configuration.
 *
 * Credentials are read from the environment on every call rather than cached
 * at module load, so the route handlers always see the current configuration
 * (and tests can vary it).
 */
export function readPaypalConfig(): PaypalConfigResult {
  const endpoint = resolvePaypalEndpoint(process.env.PAYPAL_API_BASE_URL)
  if (!endpoint.ok) return endpoint

  const clientId = readValue(process.env.PAYPAL_CLIENT_ID)
  const clientSecret = readValue(process.env.PAYPAL_CLIENT_SECRET)

  if (!clientId) {
    return {
      ok: false,
      code: "MISSING_CLIENT_ID",
      message: "PAYPAL_CLIENT_ID is not set. PayPal checkout is disabled.",
    }
  }

  if (!clientSecret) {
    return {
      ok: false,
      code: "MISSING_CLIENT_SECRET",
      message: "PAYPAL_CLIENT_SECRET is not set. PayPal checkout is disabled.",
    }
  }

  return {
    ok: true,
    config: { ...endpoint.endpoint, clientId, clientSecret },
  }
}

/** True when PayPal checkout can be offered to the shopper. */
export function isPaypalConfigured(): boolean {
  return readPaypalConfig().ok
}

/**
 * The subset of the configuration the browser is allowed to see.
 *
 * Only the client id is included: it is public by design (the PayPal JS SDK
 * script tag carries it). The client secret is never part of this payload.
 */
export function clientSafePaypalConfig(): PaypalClientConfig {
  const result = readPaypalConfig()

  if (!result.ok) {
    return {
      enabled: false,
      clientId: null,
      currency: siteConfig.currency,
      mode: "sandbox",
      reason: result.message,
    }
  }

  return {
    enabled: true,
    clientId: result.config.clientId,
    currency: result.config.currency,
    mode: result.config.mode,
  }
}
