import { NextResponse } from "next/server"

import { clientSafePaypalConfig } from "@/lib/paypal"
import type { ApiResponse, PaypalClientConfig } from "@/types"

// Reads process.env at request time, so it must not be statically cached.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Client-safe PayPal settings.
 *
 * Returns the *client id* (public by design — it is embedded in the PayPal JS
 * SDK script tag) plus whether checkout is usable. The client secret is never
 * part of this payload and never passes through a NEXT_PUBLIC_ variable.
 */
export async function GET() {
  const response: ApiResponse<PaypalClientConfig> = { data: clientSafePaypalConfig() }
  return NextResponse.json(response)
}
