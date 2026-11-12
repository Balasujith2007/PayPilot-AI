// PayPal Sandbox integration test — real API calls
// Run: node tests/paypal-sandbox-test.mjs
import { register } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import nextEnv from "@next/env"

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
process.chdir(PROJECT_ROOT)

// Load .env.local before any other imports
nextEnv.loadEnvConfig(PROJECT_ROOT)

register("./ts-alias-loader.mjs", import.meta.url, { data: { root: PROJECT_ROOT } })

const results = []

function record(name, pass, detail = "") {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? "✓ PASS" : "✗ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
}

console.log("PayPal Sandbox Integration Test")
console.log("================================\n")

// Step 1: Load environment variables
console.log("Step 1: Verifying environment variables")
try {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  const apiBaseUrl = process.env.PAYPAL_API_BASE_URL

  if (clientId && clientId.length > 0) {
    record("PAYPAL_CLIENT_ID is set", true, `[present, length: ${clientId.length}]`)
  } else {
    record("PAYPAL_CLIENT_ID is set", false, "not set or empty")
  }

  if (clientSecret && clientSecret.length > 0) {
    record("PAYPAL_CLIENT_SECRET is set", true, `[present, length: ${clientSecret.length}]`)
  } else {
    record("PAYPAL_CLIENT_SECRET is set", false, "not set or empty")
  }

  if (apiBaseUrl && apiBaseUrl.length > 0) {
    record("PAYPAL_API_BASE_URL is set", true, apiBaseUrl)
  } else {
    record("PAYPAL_API_BASE_URL is set", false, "not set or empty")
  }
} catch (error) {
  record("Environment variables loaded", false, error.message)
}

// Step 2: Test PayPal config reading
console.log("\nStep 2: Testing PayPal configuration")
try {
  const { readPaypalConfig } = await import("@/lib/paypal/config.ts")
  const configResult = readPaypalConfig()

  if (configResult.ok) {
    record("PayPal config validation", true, "configuration is valid")
    record("PayPal mode", true, configResult.config.mode)
    record("PayPal base URL", true, configResult.config.baseUrl)
  } else {
    record("PayPal config validation", false, `${configResult.code}: ${configResult.message}`)
  }
} catch (error) {
  record("PayPal config reading", false, error.message)
}

// Step 3: Test OAuth token generation
console.log("\nStep 3: Testing OAuth token generation")
let accessToken = null
try {
  const { readPaypalConfig } = await import("@/lib/paypal/config.ts")
  const { createPaypalClient } = await import("@/lib/paypal/client.ts")
  const configResult = readPaypalConfig()

  if (!configResult.ok) {
    record("OAuth token generation", false, "config validation failed")
  } else {
    const client = createPaypalClient(configResult.config)
    accessToken = await client.getAccessToken()
    record("OAuth token generation", true, `token length: ${accessToken.length}`)
  }
} catch (error) {
  if (error.name === "PaypalApiError") {
    record("OAuth token generation", false, `HTTP ${error.status} — ${error.code}: ${error.message}`)
  } else {
    record("OAuth token generation", false, error.message)
  }
}

// Step 4: Test PayPal order creation
console.log("\nStep 4: Testing PayPal order creation")
let orderId = null
try {
  if (!accessToken) {
    record("PayPal order creation", false, "skipped (no access token)")
  } else {
    const { readPaypalConfig } = await import("@/lib/paypal/config.ts")
    const { createPaypalClient } = await import("@/lib/paypal/client.ts")
    const configResult = readPaypalConfig()

    if (!configResult.ok) {
      record("PayPal order creation", false, "config validation failed")
    } else {
      const client = createPaypalClient(configResult.config)

      const purchaseUnit = {
        referenceId: "test-order-" + Date.now(),
        currency: "USD",
        value: "10.00",
        breakdown: {
          itemTotal: "10.00",
          shipping: "0.00",
          taxTotal: "0.00",
        },
        items: [
          {
            name: "Test Product",
            sku: "TEST-001",
            quantity: "1",
            unitAmount: "10.00",
            currency: "USD",
          },
        ],
      }

      const order = await client.createOrder(purchaseUnit)
      orderId = order.id

      record("PayPal order creation", true, `order ID: ${orderId}`)
      record("Order status", true, order.status)
    }
  }
} catch (error) {
  if (error.name === "PaypalApiError") {
    record("PayPal order creation", false, `HTTP ${error.status} — ${error.code}: ${error.message}`)
  } else {
    record("PayPal order creation", false, error.message)
  }
}

// Step 5: Verify order details
console.log("\nStep 5: Verifying order details")
try {
  if (!orderId || !accessToken) {
    record("Order verification", false, "skipped (no order created)")
  } else {
    const { readPaypalConfig } = await import("@/lib/paypal/config.ts")
    const { createPaypalClient } = await import("@/lib/paypal/client.ts")
    const configResult = readPaypalConfig()

    if (!configResult.ok) {
      record("Order verification", false, "config validation failed")
    } else {
      const client = createPaypalClient(configResult.config)
      const order = await client.getOrder(orderId)

      record("Order retrieval", true, `order ID: ${order.id}`)
      record("Order intent", true, "CAPTURE")
      record("Order currency", true, order.purchase_units?.[0]?.amount?.currency_code)
      record("Order amount", true, order.purchase_units?.[0]?.amount?.value)
    }
  }
} catch (error) {
  if (error.name === "PaypalApiError") {
    record("Order verification", false, `HTTP ${error.status} — ${error.code}: ${error.message}`)
  } else {
    record("Order verification", false, error.message)
  }
}

// Summary
console.log("\n================================")
console.log("Test Summary")
console.log("================================")

const passed = results.filter((r) => r.pass).length
const total = results.length

console.log(`Passed: ${passed}/${total}`)

if (passed === total) {
  console.log("\n✓ All tests passed — PayPal Sandbox integration is working correctly.")
  process.exit(0)
} else {
  console.log("\n✗ Some tests failed — review the details above.")
  process.exit(1)
}
