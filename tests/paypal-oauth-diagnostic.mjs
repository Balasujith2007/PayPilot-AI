// PayPal OAuth diagnostic — check credential encoding without printing secrets
// Run: node tests/paypal-oauth-diagnostic.mjs
import { register } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import nextEnv from "@next/env"

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
process.chdir(PROJECT_ROOT)

nextEnv.loadEnvConfig(PROJECT_ROOT)

register("./ts-alias-loader.mjs", import.meta.url, { data: { root: PROJECT_ROOT } })

console.log("PayPal OAuth Diagnostic")
console.log("========================\n")

// Step 1: Check environment variable encoding
console.log("Step 1: Checking environment variable encoding")
const clientId = process.env.PAYPAL_CLIENT_ID
const clientSecret = process.env.PAYPAL_CLIENT_SECRET
const apiBaseUrl = process.env.PAYPAL_API_BASE_URL

if (!clientId || !clientSecret || !apiBaseUrl) {
  console.log("✗ FAIL: Environment variables not set")
  process.exit(1)
}

// Check for hidden characters
const hasNewline = (str) => str.includes("\n") || str.includes("\r")
const hasTab = (str) => str.includes("\t")
const hasNonPrintable = (str) => [...str].some(c => c.charCodeAt(0) < 32 && c.charCodeAt(0) !== 10 && c.charCodeAt(0) !== 13)

console.log(`Client ID length: ${clientId.length}`)
console.log(`Client ID has newline: ${hasNewline(clientId)}`)
console.log(`Client ID has tab: ${hasTab(clientId)}`)
console.log(`Client ID has non-printable chars: ${hasNonPrintable(clientId)}`)

console.log(`\nClient Secret length: ${clientSecret.length}`)
console.log(`Client Secret has newline: ${hasNewline(clientSecret)}`)
console.log(`Client Secret has tab: ${hasTab(clientSecret)}`)
console.log(`Client Secret has non-printable chars: ${hasNonPrintable(clientSecret)}`)

console.log(`\nAPI Base URL: ${apiBaseUrl}`)

// Step 2: Check Basic Auth encoding
console.log("\nStep 2: Checking Basic Auth encoding")
const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
console.log(`Basic Auth header length: ${credentials.length}`)
console.log(`Basic Auth encoding: Base64 (standard)`)

// Step 3: Check URL parsing
console.log("\nStep 3: Checking API endpoint URL")
try {
  const url = new URL(apiBaseUrl)
  console.log(`Protocol: ${url.protocol}`)
  console.log(`Host: ${url.host}`)
  console.log(`Hostname: ${url.hostname}`)
  console.log(`Port: ${url.port || "default"}`)
  console.log(`Pathname: ${url.pathname || "/"}`)
} catch (error) {
  console.log(`✗ FAIL: URL parsing error - ${error.message}`)
}

// Step 4: Simulate the request headers
console.log("\nStep 4: Request headers simulation")
console.log(`Authorization: Basic ${credentials.substring(0, 20)}...${credentials.substring(credentials.length - 10)}`)
console.log(`Content-Type: application/x-www-form-urlencoded`)
console.log(`Body: grant_type=client_credentials`)

// Step 5: Test actual request with detailed error capture
console.log("\nStep 5: Testing actual OAuth request")
try {
  const { readPaypalConfig } = await import("@/lib/paypal/config.ts")
  const { createPaypalClient } = await import("@/lib/paypal/client.ts")

  const configResult = readPaypalConfig()
  if (!configResult.ok) {
    console.log(`✗ FAIL: Config validation - ${configResult.code}: ${configResult.message}`)
    process.exit(1)
  }

  console.log(`Config mode: ${configResult.config.mode}`)
  console.log(`Config base URL: ${configResult.config.baseUrl}`)

  // Make a raw request to see the exact error
  const rawResponse = await fetch(`${configResult.config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  console.log(`Response status: ${rawResponse.status}`)
  console.log(`Response status text: ${rawResponse.statusText}`)

  const errorBody = await rawResponse.text()
  console.log(`Response body: ${errorBody}`)

  if (rawResponse.status === 401) {
    console.log("\n✗ FAIL: HTTP 401 - Client Authentication failed")
    console.log("This indicates PayPal rejected the credentials.")
    console.log("Possible causes:")
    console.log("  1. Credentials are from Live environment, not Sandbox")
    console.log("  2. Credentials are from a different PayPal Developer app")
    console.log("  3. Credentials have been revoked or are invalid")
    console.log("  4. Credentials are incorrectly formatted (e.g., truncated)")
  }

} catch (error) {
  console.log(`✗ FAIL: Request error - ${error.message}`)
  console.log(error.stack)
}
