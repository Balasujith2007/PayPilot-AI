import { Type } from "@google/genai"
import { z } from "zod"

import { productRepository } from "@/lib/repositories"
import {
  AGENT_TOOL_MAX_CART_LINES,
  AGENT_TOOL_MAX_QUANTITY,
  proposeCartActionArgsSchema,
} from "@/lib/validators"
import type { ProposeCartActionArgs } from "@/lib/validators"
import { siteConfig } from "@/lib/config"
import type { CartProposal, ProductVariant } from "@/types"

import {
  computeCartTotals,
  defineAgentTool,
  formatCents,
  isPurchasable,
  primaryVariant,
  productUrl,
  stockFor,
  toolFailure,
  toolSuccess,
} from "./shared"

const NAME = "propose_cart_action"

interface ProposedLine {
  productId: string
  variantId: string
  name: string
  variantName: string
  sku: string
  slug: string
  url: string
  image: string | null
  unitPrice: number
  unitPriceFormatted: string
  quantity: number
  lineTotal: number
  lineTotalFormatted: string
  currency: string
  availableQuantity: number
}

interface RejectedLine {
  productId: string
  variantId: string | null
  quantity: number
  code:
    | "NOT_FOUND"
    | "VARIANT_NOT_FOUND"
    | "OUT_OF_STOCK"
    | "INSUFFICIENT_STOCK"
  message: string
}

/**
 * Build a cart proposal for the shopper to confirm.
 *
 * This tool is deliberately side-effect free: it never writes to the cart,
 * never starts checkout and never creates or captures a payment. It returns a
 * structured proposal that the UI must apply after explicit user approval.
 */
export const proposeCartActionTool = defineAgentTool<ProposeCartActionArgs>({
  name: NAME,
  description:
    "Prepare a proposal to add products to the shopper's cart. Use this when the shopper says they want to buy or add something. This only creates a proposal — it does not change the cart, start checkout or take any payment. Always ask the shopper to confirm in the interface.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: `Products to propose adding (1-${AGENT_TOOL_MAX_CART_LINES} lines).`,
        items: {
          type: Type.OBJECT,
          properties: {
            productId: {
              type: Type.STRING,
              description: 'Product id from search_products, for example "prod-1".',
            },
            variantId: {
              type: Type.STRING,
              description:
                "Optional variant id. Omit to use the default variant for the product.",
            },
            quantity: {
              type: Type.INTEGER,
              description: `How many units (1-${AGENT_TOOL_MAX_QUANTITY}).`,
            },
          },
          required: ["productId", "quantity"],
        },
      },
    },
    required: ["items"],
  },
  schema: proposeCartActionArgsSchema,
  async execute(args) {
    const accepted: ProposedLine[] = []
    const rejected: RejectedLine[] = []

    for (const line of args.items) {
      // Always re-read the product from the server catalog: prices and stock
      // are never taken from the model or the client.
      const product = await productRepository.getById(line.productId)

      if (!product || product.status !== "active") {
        rejected.push({
          productId: line.productId,
          variantId: line.variantId ?? null,
          quantity: line.quantity,
          code: "NOT_FOUND",
          message: `No active product with id "${line.productId}".`,
        })
        continue
      }

      const variant: ProductVariant | undefined = line.variantId
        ? product.variants.find((candidate) => candidate.id === line.variantId)
        : primaryVariant(product)

      if (!variant) {
        rejected.push({
          productId: product.id,
          variantId: line.variantId ?? null,
          quantity: line.quantity,
          code: "VARIANT_NOT_FOUND",
          message: `"${product.name}" has no variant with id "${line.variantId}".`,
        })
        continue
      }

      if (!isPurchasable(variant)) {
        rejected.push({
          productId: product.id,
          variantId: variant.id,
          quantity: line.quantity,
          code: "OUT_OF_STOCK",
          message: `"${product.name} (${variant.name})" is out of stock.`,
        })
        continue
      }

      const availableQuantity = stockFor(variant)
      if (line.quantity > availableQuantity) {
        rejected.push({
          productId: product.id,
          variantId: variant.id,
          quantity: line.quantity,
          code: "INSUFFICIENT_STOCK",
          message: `Only ${availableQuantity} of "${product.name} (${variant.name})" are available.`,
        })
        continue
      }

      const lineTotal = variant.price * line.quantity
      accepted.push({
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        variantName: variant.name,
        sku: variant.sku,
        slug: product.slug,
        url: productUrl(product.slug),
        image: variant.images[0]?.url ?? product.images[0]?.url ?? null,
        unitPrice: variant.price,
        unitPriceFormatted: formatCents(variant.price, variant.currency),
        quantity: line.quantity,
        lineTotal,
        lineTotalFormatted: formatCents(lineTotal, variant.currency),
        currency: variant.currency,
        availableQuantity,
      })
    }

    if (accepted.length === 0) {
      return toolFailure(
        NAME,
        "NOT_FOUND",
        rejected[0]?.message ?? "None of the requested products could be added."
      )
    }

    const subtotal = accepted.reduce((sum, line) => sum + line.lineTotal, 0)
    const totals = computeCartTotals(subtotal)

    return toolSuccess(NAME, {
      action: "add_to_cart",
      status: "proposed",
      // Explicitly restate the safety contract so the model cannot imply the
      // cart changed or a payment was started.
      applied: false,
      requiresApproval: true,
      paymentInitiated: false,
      currency: siteConfig.currency,
      items: accepted,
      rejected,
      summary: {
        itemCount: accepted.reduce((sum, line) => sum + line.quantity, 0),
        subtotal: totals.subtotal,
        subtotalFormatted: formatCents(totals.subtotal, siteConfig.currency),
        shipping: totals.shipping,
        shippingFormatted:
          totals.shipping === 0 ? "Free" : formatCents(totals.shipping, siteConfig.currency),
        tax: totals.tax,
        taxFormatted: formatCents(totals.tax, siteConfig.currency),
        total: totals.total,
        totalFormatted: formatCents(totals.total, siteConfig.currency),
        freeShippingThreshold: siteConfig.freeShippingThreshold,
        qualifiesForFreeShipping: totals.shipping === 0,
      },
      note:
        rejected.length > 0
          ? "Some lines were rejected — see `rejected`. Tell the shopper about them, then ask them to confirm the rest."
          : "Nothing has been added yet. Ask the shopper to review and confirm this proposal.",
    })
  },
})

/**
 * Runtime guard for the proposal that leaves this module for the browser.
 *
 * The payload is assembled here from the catalog, but it is validated again on
 * the way out so a future edit can never quietly ship a half-shaped proposal
 * to the approval UI, and so the approval UI can trust `requiresApproval` and
 * `applied` before it touches the cart.
 */
export const cartProposalSchema = z.object({
  action: z.literal("add_to_cart"),
  status: z.literal("proposed"),
  applied: z.literal(false),
  requiresApproval: z.literal(true),
  paymentInitiated: z.literal(false),
  currency: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
        name: z.string().min(1),
        variantName: z.string(),
        sku: z.string(),
        slug: z.string().min(1),
        url: z.string().min(1),
        image: z.string().nullable(),
        unitPrice: z.number().int().nonnegative(),
        unitPriceFormatted: z.string(),
        quantity: z.number().int().positive(),
        lineTotal: z.number().int().nonnegative(),
        lineTotalFormatted: z.string(),
        currency: z.string().min(1),
        availableQuantity: z.number().int().nonnegative(),
      })
    )
    .min(1),
  rejected: z.array(
    z.object({
      productId: z.string(),
      variantId: z.string().nullable(),
      quantity: z.number().int().positive(),
      code: z.enum([
        "NOT_FOUND",
        "VARIANT_NOT_FOUND",
        "OUT_OF_STOCK",
        "INSUFFICIENT_STOCK",
      ]),
      message: z.string(),
    })
  ),
  summary: z.object({
    itemCount: z.number().int().nonnegative(),
    subtotal: z.number().int().nonnegative(),
    subtotalFormatted: z.string(),
    shipping: z.number().int().nonnegative(),
    shippingFormatted: z.string(),
    tax: z.number().int().nonnegative(),
    taxFormatted: z.string(),
    total: z.number().int().nonnegative(),
    totalFormatted: z.string(),
    freeShippingThreshold: z.number().int().nonnegative(),
    qualifiesForFreeShipping: z.boolean(),
  }),
  note: z.string().optional(),
})

/**
 * Validate an untrusted payload into a {@link CartProposal}.
 * Returns `null` when the payload does not match the contract exactly.
 */
export function parseCartProposal(data: unknown): CartProposal | null {
  const parsed = cartProposalSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}
