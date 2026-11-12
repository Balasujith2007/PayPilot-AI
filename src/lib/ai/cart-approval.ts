import { PLACEHOLDER_IMAGE } from "@/lib/constants"
import type { CartProposal, CartProposalLine, ProductImage } from "@/types"

/**
 * The exact argument `useCartStore.addItem` accepts. Declared here so the
 * mapping from a server proposal to a cart line is a single, testable seam.
 */
export interface CartItemInput {
  variantId: string
  productId: string
  name: string
  variantName: string
  image: ProductImage
  slug: string
  price: number
  quantity: number
}

/**
 * Convert an approved proposal line into a cart-store input.
 *
 * `price` is always the server's `unitPrice` in cents — the proposal carries no
 * client-editable amount, so the cart can never be seeded with a shopper- or
 * model-supplied price. The proposal only has an image URL, while the cart
 * expects a {@link ProductImage}, which is adapted here.
 */
export function toCartItemInput(line: CartProposalLine): CartItemInput {
  return {
    variantId: line.variantId,
    productId: line.productId,
    name: line.name,
    variantName: line.variantName,
    image: {
      url: line.image ?? PLACEHOLDER_IMAGE,
      alt: `${line.name} — ${line.variantName}`,
    },
    slug: line.slug,
    price: line.unitPrice,
    quantity: line.quantity,
  }
}

function lineKey(line: CartProposalLine): string {
  return [line.variantId, line.quantity, line.unitPrice, line.lineTotal].join(":")
}

/**
 * True when a freshly revalidated proposal no longer matches what the shopper
 * was shown. Availability, prices or totals moved on, so the approval UI must
 * re-render the card and ask again instead of applying a stale proposal.
 */
export function proposalDiffersFrom(displayed: CartProposal, fresh: CartProposal): boolean {
  if (displayed.summary.total !== fresh.summary.total) return true
  if (displayed.rejected.length !== fresh.rejected.length) return true
  if (displayed.items.length !== fresh.items.length) return true

  const displayedLines = displayed.items.map(lineKey).sort()
  const freshLines = fresh.items.map(lineKey).sort()
  return displayedLines.some((key, index) => key !== freshLines[index])
}
