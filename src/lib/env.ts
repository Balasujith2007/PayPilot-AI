import { z } from "zod"

// Validate environment variables at build/startup time.
// Add required vars here as you integrate real services.

/**
 * A setting that may be absent. Deployments commonly ship unset secrets as
 * empty strings (`GEMINI_API_KEY=` in a .env file, `""` in Docker/compose);
 * those must be treated as "not configured" rather than crashing startup.
 */
function optionalString() {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(1).optional()
  )
}

const envSchema = z.object({
  // Required
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Optional — add validation as you integrate services
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),

  // Gemini AI (server-side only — never expose through a NEXT_PUBLIC_ var).
  // Optional so the app boots without AI configured; the agent endpoints
  // fail closed with a 503 when the key is missing.
  //   gemini-2.5-flash       → rejected with 404 ("no longer available to new users")
  //   gemini-3.8-flash       → accepts requests but does not respond in time
  //   gemini-3.6-flash       → responsive; override with GEMINI_MODEL if needed
  GEMINI_API_KEY: optionalString(),
  GEMINI_MODEL: optionalString().default("gemini-3.6-flash"),

  // Uncomment when integrating a payment provider:
  // STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  // NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  // STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

})

export type Env = z.infer<typeof envSchema>

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error(
      "❌ Invalid environment variables:",
      result.error.flatten().fieldErrors
    )
    throw new Error("Invalid environment variables")
  }

  return result.data
}

export const env = validateEnv()
