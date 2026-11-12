import { z } from "zod"
import { MAX_COMPARE_PRODUCTS, MIN_COMPARE_PRODUCTS } from "@/lib/comparison"

/**
 * Upper bound on a budget request, in cents. Shared by the budget API
 * (`budgetRequestSchema`) and the agent `check_budget` tool arguments so both
 * layers enforce the same ceiling.
 */
export const MAX_BUDGET_CENTS = 100_000_000

// --- Address ---

export const addressSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  line1: z.string().min(1, "Address is required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
  phone: z.string().optional(),
})

// --- Auth ---

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export const registerSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
})

// --- Checkout ---

export const checkoutFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  sameAsShipping: z.boolean().default(true),
})

// --- Contact ---

export const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
})

// --- Newsletter ---

export const newsletterSchema = z.object({
  email: z.string().email("Invalid email address"),
})

// --- AI Agent ---

export const AGENT_MAX_MESSAGES = 20
export const AGENT_MAX_MESSAGE_LENGTH = 2000

export const agentChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(
      AGENT_MAX_MESSAGE_LENGTH,
      `Message must be at most ${AGENT_MAX_MESSAGE_LENGTH} characters`
    ),
})

export const agentChatRequestSchema = z.object({
  messages: z
    .array(agentChatMessageSchema)
    .min(1, "At least one message is required")
    .max(AGENT_MAX_MESSAGES, `At most ${AGENT_MAX_MESSAGES} messages are allowed`),
})

// --- AI Agent Tool Arguments ---
//
// These schemas are the authoritative validation for anything Gemini sends
// back as tool arguments. The model's request is untrusted input, so every
// field is bounded and coerced before a tool implementation sees it.

export const AGENT_TOOL_MAX_RESULTS = 10
export const AGENT_TOOL_MAX_CART_LINES = 10
export const AGENT_TOOL_MAX_QUANTITY = 10

/** A short identifier or keyword. */
const toolText = (max: number) => z.string().trim().min(1).max(max)

/**
 * Gemini occasionally serialises integers as numeric strings, so integer
 * arguments are coerced — but still range-checked against the same bounds.
 */
const toolCount = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max)

export const searchProductsArgsSchema = z.object({
  query: toolText(120),
  category: toolText(60).optional(),
  limit: toolCount(1, AGENT_TOOL_MAX_RESULTS).optional(),
})

export const compareProductsArgsSchema = z.object({
  productIds: z
    .array(toolText(64))
    .min(MIN_COMPARE_PRODUCTS)
    .max(MAX_COMPARE_PRODUCTS),
})

export const checkBudgetArgsSchema = z.object({
  budget: z.coerce.number().int().min(1).max(MAX_BUDGET_CENTS),
  category: toolText(60).optional(),
  requirements: toolText(120).optional(),
})

export const cartActionLineSchema = z.object({
  productId: toolText(64),
  variantId: toolText(64).optional(),
  quantity: toolCount(1, AGENT_TOOL_MAX_QUANTITY),
})

export const proposeCartActionArgsSchema = z.object({
  items: z
    .array(cartActionLineSchema)
    .min(1)
    .max(AGENT_TOOL_MAX_CART_LINES),
})

// --- Cart proposal approval (Task 19) ---

/**
 * How long a registered proposal stays approvable. Short enough that a stale
 * cart is unlikely, long enough for a shopper to read the card.
 */
export const AGENT_PROPOSAL_TTL_MS = 15 * 60 * 1000

/**
 * Server-issued proposal identifier. Bounded and shape-checked so a malformed
 * or injected id is rejected before any lookup happens.
 */
export const proposalIdSchema = z
  .string()
  .trim()
  .regex(/^prop_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, "Invalid proposal ID")

/**
 * The complete body of an approve/reject request.
 *
 * Deliberately the *only* accepted field: prices, stock levels and product
 * details are read from the stored proposal, never from the browser.
 */
export const proposalDecisionRequestSchema = z.object({
  proposalId: proposalIdSchema,
})

// --- Type exports ---

export type AddressFormData = z.infer<typeof addressSchema>
export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type CheckoutFormData = z.infer<typeof checkoutFormSchema>
export type ContactFormData = z.infer<typeof contactFormSchema>
export type NewsletterFormData = z.infer<typeof newsletterSchema>

// --- Product comparison ---

export const productIdSchema = z
  .string()
  .trim()
  .min(1, "Product ID is required")
  .max(64, "Product ID is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "Product ID contains invalid characters")

export const compareProductsSchema = z.object({
  productIds: z
    .array(productIdSchema)
    .min(2, "Select at least 2 products to compare")
    .max(4, "You can compare up to 4 products")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Product IDs must be unique",
    }),
})

export type CompareProductsRequest = z.infer<typeof compareProductsSchema>

// --- Budget recommendations ---

const keywordListSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.split(",") : value),
  z
    .array(z.string().trim().max(50, "Each keyword must be 50 characters or fewer"))
    .transform((list) => list.filter(Boolean))
    .pipe(z.array(z.string()).max(10, "Use up to 10 keywords"))
)

export const budgetRequestSchema = z.object({
  budget: z
    .number({ error: "Budget must be a number (in cents)" })
    .int("Budget must be a whole number of cents")
    .positive("Budget must be greater than 0")
    .max(MAX_BUDGET_CENTS, "Budget is too large"),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code")
    .optional(),
  category: z.string().trim().min(1, "Category is empty").max(64, "Category is too long").optional(),
  keywords: keywordListSchema.optional(),
  intendedUse: z.string().trim().max(200, "Intended use must be 200 characters or fewer").optional(),
  maxAlternatives: z
    .number({ error: "maxAlternatives must be a number" })
    .int("maxAlternatives must be a whole number")
    .min(0, "maxAlternatives cannot be negative")
    .max(10, "maxAlternatives can be at most 10")
    .optional(),
  includeOutOfStock: z.boolean({ error: "includeOutOfStock must be true or false" }).optional(),
})

export type BudgetRequestInput = z.infer<typeof budgetRequestSchema>

// --- Agent chat + tool argument types ---

export type AgentChatMessage = z.infer<typeof agentChatMessageSchema>
export type AgentChatRequest = z.infer<typeof agentChatRequestSchema>
export type SearchProductsArgs = z.infer<typeof searchProductsArgsSchema>
export type CompareProductsArgs = z.infer<typeof compareProductsArgsSchema>
export type CheckBudgetArgs = z.infer<typeof checkBudgetArgsSchema>
export type CartActionLine = z.infer<typeof cartActionLineSchema>
export type ProposeCartActionArgs = z.infer<typeof proposeCartActionArgsSchema>
export type ProposalDecisionRequest = z.infer<typeof proposalDecisionRequestSchema>

// --- PayPal checkout (Task 20) ---

/** Bounds for a checkout request, mirroring the storefront cart. */
export const MAX_CHECKOUT_LINES = 20
export const MAX_CHECKOUT_QUANTITY = 99

/** How long a created PayPal order stays capturable. */
export const PAYPAL_CHECKOUT_TTL_MS = 60 * 60 * 1000

export const variantIdSchema = z
  .string()
  .trim()
  .min(1, "Variant ID is required")
  .max(64, "Variant ID is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "Variant ID contains invalid characters")

/**
 * A requested checkout line.
 *
 * Deliberately carries no price, name or stock: quantities are the only
 * shopper-controlled number and everything else is rebuilt from the catalog.
 * Unknown fields are stripped by Zod, so a `price` sent by a manipulated
 * client never reaches the order builder.
 */
export const checkoutLineInputSchema = z.object({
  productId: productIdSchema,
  variantId: variantIdSchema,
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(MAX_CHECKOUT_QUANTITY, `Quantity must be at most ${MAX_CHECKOUT_QUANTITY}`),
})

export const paypalCreateOrderRequestSchema = z.object({
  items: z
    .array(checkoutLineInputSchema)
    .min(1, "At least one item is required")
    .max(MAX_CHECKOUT_LINES, `At most ${MAX_CHECKOUT_LINES} items are allowed`),
  customerEmail: z.string().email("Invalid email address").optional(),
  customerName: z.string().trim().max(200, "Name is too long").optional(),
  userId: z.string().trim().max(100, "User ID is too long").optional(),
  /**
   * Optional because the shopper may complete the address inside PayPal.
   * It is only ever used to label the order — never to price it.
   */
  shippingAddress: addressSchema.optional(),
})

/** PayPal order ids are 6–32 alphanumeric characters, e.g. `5O190127TN364715T`. */
export const paypalOrderIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{6,32}$/, "Invalid PayPal order ID")

/** Server-issued checkout reference, e.g. `chk_<uuid>`. */
export const checkoutRefSchema = z
  .string()
  .trim()
  .regex(
    /^chk_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    "Invalid checkout reference"
  )

export const paypalCaptureRequestSchema = z.object({
  checkoutRef: checkoutRefSchema,
  paypalOrderId: paypalOrderIdSchema,
})

export type CheckoutLineInput = z.infer<typeof checkoutLineInputSchema>
export type PaypalCreateOrderRequest = z.infer<typeof paypalCreateOrderRequestSchema>
export type PaypalCaptureRequest = z.infer<typeof paypalCaptureRequestSchema>

// --- Orders (Task 21) ---

export const orderIdParamSchema = z
  .string()
  .trim()
  .min(1, "Order ID is required")
  .max(128, "Order ID is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid order ID format")

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  userId: z.string().trim().max(100).optional(),
  email: z.string().email().optional(),
})

export type OrderListQuery = z.infer<typeof orderListQuerySchema>

