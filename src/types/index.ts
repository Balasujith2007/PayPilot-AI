// ============================================================================
// Core Ecommerce Types — Backend-Agnostic Data Contract
// ============================================================================

// --- Brand ---

export interface Brand {
  id: string
  name: string
  slug: string
  description: string
}

// --- CMS-style Pages ---

export interface CmsPage {
  id: string
  title: string
  slug: string
  /** Short summary shown on the pages index */
  excerpt?: string
  /** Full HTML content rendered with .blog-body prose */
  body: string
  publishedAt: string
  updatedAt?: string
}

// --- Blog Posts ---

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  body: string
  author: string
  tags: string[]
  coverImage?: ProductImage
  publishedAt: string
  updatedAt?: string
}

// --- Product ---

export type ProductStatus = "draft" | "active" | "archived"

export interface ProductImage {
  url: string
  alt: string
  width?: number
  height?: number
}

export interface ProductOption {
  name: string // e.g., "Color", "Size"
  value: string // e.g., "Black", "M"
}

export interface VariantInventory {
  quantity: number
  trackInventory: boolean
  allowBackorder: boolean
}

export interface ProductVariant {
  id: string
  productId: string
  sku: string
  name: string
  price: number // in cents
  compareAtPrice?: number // original price for sale display
  currency: string
  inventory: VariantInventory
  options: ProductOption[]
  images: ProductImage[]
  weight?: number
  dimensions?: { length: number; width: number; height: number }
}

export interface Product {
  id: string
  name: string
  slug: string
  /** Short blurb shown in the product info column (1–2 sentences) */
  description: string
  /** Full HTML description shown below gallery/add-to-cart (.blog-body prose) */
  body?: string
  images: ProductImage[]
  status: ProductStatus
  brandId: string
  categoryIds: string[]
  tags: string[]
  variants: ProductVariant[]
  rating: number
  reviewCount: number
  featured: boolean
  createdAt: string
  updatedAt: string
}

// --- Category ---

export interface Category {
  id: string
  name: string
  slug: string
  description: string
  image?: ProductImage
  parentId?: string
  order: number
}

// --- Cart ---

export interface CartItem {
  id: string
  variantId: string
  productId: string
  name: string
  variantName: string
  image: ProductImage
  slug: string
  price: number
  quantity: number
  lineTotal: number
}

export interface Cart {
  id: string
  items: CartItem[]
  subtotal: number
  tax: number
  shipping: number
  total: number
  itemCount: number
}

// --- Order ---

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"

export interface OrderLineItem {
  id: string
  productId: string
  variantId: string
  name: string
  variantName: string
  sku: string
  image: ProductImage
  price: number
  quantity: number
  total: number
}

export interface Order {
  id: string
  orderNumber: string
  userId?: string
  items: OrderLineItem[]
  status: OrderStatus
  paymentStatus: PaymentStatus
  subtotal: number
  tax: number
  shipping: number
  total: number
  currency: string
  shippingAddress: Address
  billingAddress?: Address
  customerEmail: string
  customerName: string
  createdAt: string
  updatedAt: string
  /** How the order was paid. Absent on pre-existing demo orders. */
  paymentMethod?: PaymentMethod
  /**
   * Provider-side reference for the payment (for PayPal, the capture id).
   * Written only by the server after a verified capture.
   */
  paymentReference?: string
  /** PayPal order id returned by PayPal Orders API. */
  paypalOrderId?: string
  /** Timestamp when payment was verified and completed. */
  completedAt?: string
  /** Courier partner (e.g. Blue Dart, Delhivery) assigned by admin */
  carrier?: string
  /** AWB tracking code assigned by admin */
  trackingNumber?: string
}

// --- User ---

export type UserRole = "customer" | "admin"

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  addresses: Address[]
  createdAt: string
  updatedAt: string
}

// --- Address ---

export type AddressType = "shipping" | "billing"

export interface Address {
  id: string
  type: AddressType
  firstName: string
  lastName: string
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone?: string
  isDefault: boolean
}

// --- Payment ---

export type PaymentMethod = "card" | "paypal" | "bank_transfer" | "wallet" | "other"

export interface Payment {
  id: string
  orderId: string
  method: PaymentMethod
  status: PaymentStatus
  amount: number
  currency: string
  transactionId?: string
  metadata?: Record<string, string>
}

// --- Review (placeholder for v2) ---

export interface Review {
  id: string
  productId: string
  userId: string
  rating: number // 1-5
  title: string
  content: string
  verified: boolean
  createdAt: string
}

// ============================================================================
// Infrastructure Types
// ============================================================================

// --- API Response ---

export type ApiResponse<T> =
  | { data: T; error?: never }
  | { data?: never; error: ApiError }

export interface ApiError {
  code: string
  message: string
  field?: string
  details?: Record<string, string[]>
}

// --- AI Agent ---

/** Summary of a tool the agent invoked while answering. Args are not echoed. */
export interface AgentToolCallSummary {
  name: string
  ok: boolean
}

/**
 * Compact catalog product. Always rebuilt server-side from the product
 * repository — no value here is ever taken from the model or the client.
 */
export type AgentProductSummary = {
  id: string
  name: string
  slug: string
  url: string
  description: string
  /** Primary catalog image URL, or null when the product has none. */
  image: string | null
  /** Unit price in cents */
  price: number
  priceFormatted: string
  compareAtPrice?: number
  currency: string
  rating: number
  reviewCount: number
  brand: string | null
  categories: string[]
  tags: string[]
  inStock: boolean
}

/** Result of the `search_products` tool. */
export type AgentSearchResult = {
  query: string
  category: string | null
  categoryMatched: boolean
  resultCount: number
  totalMatches: number
  products: AgentProductSummary[]
  note?: string
}

export type AgentComparisonProduct = AgentProductSummary & {
  variantCount: number
  availableVariantCount: number
  variantNames: string[]
  compareAtPriceFormatted?: string
}

/** One compared attribute, keyed by product id. */
export type AgentComparisonRow = {
  attribute: string
  /** True when every compared product shares the same value. */
  same: boolean
  values: Record<string, string>
}

/** Result of the `compare_products` tool. */
export type AgentComparisonResult = {
  currency: string
  comparedCount: number
  notFound: string[]
  products: AgentComparisonProduct[]
  rows: AgentComparisonRow[]
  highlights: {
    cheapest: { id: string; name: string; price: number }
    highestRated: { id: string; name: string; rating: number }
  }
}

export type AgentBudgetProduct = AgentProductSummary & {
  remainingBudget: number
  remainingBudgetFormatted: string
  estimatedShipping: number
  estimatedTax: number
  estimatedTotal: number
  estimatedTotalFormatted: string
  qualifiesForFreeShipping: boolean
}

export type AgentBudgetPick = {
  id: string
  name: string
  price: number
  priceFormatted: string
  rating: number
}

/** Result of the `check_budget` tool. */
export type AgentBudgetResult = {
  budget: number
  budgetFormatted?: string
  currency?: string
  category: string | null
  categoryMatched?: boolean
  requirements?: string | null
  thresholds?: {
    freeShipping: number
    freeShippingFormatted: string
    taxRate: number
  }
  eligibleCount: number
  totalEligible?: number
  eligible: AgentBudgetProduct[]
  recommendations: {
    topPicks: AgentBudgetPick[]
    cheapest: { id: string; name: string; price: number } | null
    highestRated: { id: string; name: string; rating: number } | null
    nextStepUp: {
      id: string
      name: string
      price: number
      additionalNeeded: number
    } | null
  }
  note?: string
}

/** One line of a cart proposal. Every value is server-catalog derived. */
export type CartProposalLine = {
  productId: string
  variantId: string
  name: string
  variantName: string
  sku: string
  slug: string
  url: string
  image: string | null
  /** Unit price in cents, read from the catalog */
  unitPrice: number
  unitPriceFormatted: string
  quantity: number
  lineTotal: number
  lineTotalFormatted: string
  currency: string
  availableQuantity: number
}

export type CartProposalRejectionCode =
  | "NOT_FOUND"
  | "VARIANT_NOT_FOUND"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_STOCK"

/** A requested line the server refused, with a shopper-readable reason. */
export type CartProposalRejection = {
  productId: string
  variantId: string | null
  quantity: number
  code: CartProposalRejectionCode
  message: string
}

export type CartProposalSummary = {
  itemCount: number
  subtotal: number
  subtotalFormatted: string
  shipping: number
  shippingFormatted: string
  tax: number
  taxFormatted: string
  total: number
  totalFormatted: string
  freeShippingThreshold: number
  qualifiesForFreeShipping: boolean
}

/**
 * A cart proposal awaiting explicit shopper approval.
 *
 * `applied` and `paymentInitiated` are always `false`: nothing in this payload
 * can change the cart, start checkout or take a payment.
 *
 * The identity fields are issued by the server when the proposal is registered
 * (see src/lib/ai/approvals). They are the *only* thing the shopper's approval
 * request sends back: the browser never resubmits prices or stock.
 */
export type CartProposal = {
  action: "add_to_cart"
  status: "proposed"
  applied: false
  requiresApproval: true
  paymentInitiated: false
  currency: string
  items: CartProposalLine[]
  rejected: CartProposalRejection[]
  summary: CartProposalSummary
  note?: string
  /** Server-issued id required to approve or reject this proposal. */
  proposalId?: string
  /** ISO timestamp the proposal was registered. */
  createdAt?: string
  /** ISO timestamp after which the proposal can no longer be approved. */
  expiresAt?: string
}

/**
 * Outcome of `POST /api/agent/cart/approve`.
 *
 * `APPROVED` carries the freshly revalidated lines the browser may add to its
 * cart. `STALE` means the catalog moved on: nothing is applied and the
 * replacement proposal must be confirmed again.
 */
export type CartApprovalDecision =
  | {
      status: "APPROVED"
      proposalId: string
      decidedAt: string
      proposal: CartProposal
    }
  | {
      status: "STALE"
      proposalId: string
      decidedAt: string
      /** Human-readable reason the earlier proposal could not be applied. */
      reason: string
      /** A fresh proposal (new id and expiry) that must be approved again. */
      proposal: CartProposal
    }

/** Outcome of `POST /api/agent/cart/reject`. Never touches a cart. */
export interface CartRejectionResult {
  status: "REJECTED"
  proposalId: string
  decidedAt: string
}

/** Structured, server-derived output the chat UI can render for this turn. */
export type AgentChatArtifacts = {
  search?: AgentSearchResult
  comparison?: AgentComparisonResult
  budget?: AgentBudgetResult
  cartProposal?: CartProposal
}

export interface AgentChatResult {
  reply: string
  model: string
  toolCalls: AgentToolCallSummary[]
  /** Rebuilt server-side from tool results — never from model text. */
  artifacts: AgentChatArtifacts
}

// --- Pagination ---

export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedResult<T> {
  items: T[]
  pagination: PaginationMeta
}

// --- Filtering & Sorting ---

export type SortOrder = "asc" | "desc"

export interface SortOption {
  field: string
  order: SortOrder
}

export interface PriceRange {
  min?: number
  max?: number
}

export interface ProductFilters {
  category?: string
  priceRange?: PriceRange
  inStock?: boolean
  search?: string
  tags?: string[]
}

// --- Checkout Provider ---

export interface CheckoutSession {
  id: string
  url: string
  status: "open" | "complete" | "expired"
  orderId?: string
  metadata?: Record<string, string>
}

export interface WebhookResult {
  success: boolean
  orderId?: string
  error?: string
}

export interface CheckoutProvider {
  createSession(
    cart: Cart,
    customer?: { email: string; shippingAddress?: Address }
  ): Promise<CheckoutSession>
  getSession(sessionId: string): Promise<CheckoutSession>
  handleWebhook(
    payload: unknown,
    signature: string
  ): Promise<WebhookResult>
}

// --- Data Repository Interfaces ---

export interface ProductRepository {
  list(
    filters?: ProductFilters,
    sort?: SortOption,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Product>>
  getBySlug(slug: string): Promise<Product | null>
  getById(id: string): Promise<Product | null>
  getFeatured(limit?: number): Promise<Product[]>
  getByCategory(
    categorySlug: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Product>>
  search(
    query: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Product>>
}

export interface CategoryRepository {
  list(): Promise<Category[]>
  getBySlug(slug: string): Promise<Category | null>
  getById(id: string): Promise<Category | null>
}

export interface OrderRepository {
  list(
    userId?: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Order>>
  getById(id: string): Promise<Order | null>
  create(order: Order | (Omit<Order, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string; updatedAt?: string })): Promise<Order>
  updateStatus(id: string, status: OrderStatus): Promise<Order>
}

// ============================================================================
// PayPal Checkout (Task 20)
// ============================================================================

/**
 * Sandbox is the default and the only mode the app will enter on its own.
 * Live requires an explicitly configured live API base URL — see
 * src/lib/paypal/config.ts. The app never switches to live by itself.
 */
export type PaypalMode = "sandbox" | "live"

/**
 * Client-safe PayPal settings.
 *
 * Contains the *client id* only, which is public by design (it is embedded in
 * the PayPal JS SDK script tag). The client secret never leaves the server and
 * is never exposed through a NEXT_PUBLIC_ variable.
 */
export type PaypalClientConfig = {
  enabled: boolean
  clientId: string | null
  currency: string
  mode: PaypalMode
  /** Populated when PayPal is not usable, so the UI can explain why. */
  reason?: string
}

/** One requested checkout line. Prices are never accepted from the browser. */
export type PaypalCheckoutLineInput = {
  productId: string
  variantId: string
  quantity: number
}

/** A checkout line rebuilt from the server-side catalog. */
export type PaypalCheckoutLine = {
  productId: string
  variantId: string
  name: string
  variantName: string
  sku: string
  image: ProductImage
  /** Unit price in cents, read from the catalog. */
  unitPrice: number
  quantity: number
  lineTotal: number
}

/** Server-calculated money for a checkout, in cents. */
export type PaypalCheckoutAmounts = {
  subtotal: number
  shipping: number
  tax: number
  total: number
  currency: string
}

/** Result of `POST /api/paypal/orders`. */
export type PaypalOrderResponse = {
  checkoutRef: string
  paypalOrderId: string
  amounts: PaypalCheckoutAmounts
  expiresAt: string
}

export type PaypalCheckoutStatus = "PENDING" | "COMPLETED" | "FAILED"

/**
 * Result of `POST /api/paypal/capture`.
 *
 * `COMPLETED` is the only status that may be shown as a paid order, and it is
 * produced exclusively from a server-verified PayPal capture.
 */
export type PaypalCaptureResponse = {
  status: PaypalCheckoutStatus
  checkoutRef: string
  paypalOrderId: string
  /** Present once the server has verified and recorded the capture. */
  order?: Order
  /** PayPal capture id, when the capture completed. */
  captureId?: string
  /** Shopper-readable explanation when the capture did not complete. */
  reason?: string
}

/** Result of `GET /api/paypal/orders?ref=…` for the confirmation page. */
export type PaypalOrderLookup = {
  checkoutRef: string
  status: PaypalCheckoutStatus
  amounts: PaypalCheckoutAmounts
  createdAt: string
  expiresAt: string
  captureId?: string
  order?: Order
}
