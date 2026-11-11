import { z } from "zod"

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
    .max(100_000_000, "Budget is too large"),
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
