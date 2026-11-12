"use client"

import Link from "next/link"
import { Check, Sparkles, Star, TriangleAlert, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ProductImage } from "@/components/ui/product-image"
import { cn } from "@/lib/utils"
import type {
  AgentBudgetProduct,
  AgentBudgetResult,
  AgentComparisonResult,
  AgentProductSummary,
  AgentSearchResult,
} from "@/types"

const CARD_SIZES = "(max-width: 640px) 40vw, 160px"

/** Words worth matching a query against, ignoring very short filler tokens. */
const MIN_MATCH_TOKEN_LENGTH = 3

/**
 * Up to two reasons this product matches the shopper's request.
 *
 * Derived only from the server-built product summary — the assistant's prose
 * is never parsed, and a product that matches nothing still renders (with no
 * reasons) rather than being hidden or reworded.
 */
function matchReasons(product: AgentProductSummary, query: string): string[] {
  const reasons: string[] = []

  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= MIN_MATCH_TOKEN_LENGTH)
  const haystack = [...product.categories, ...product.tags].map((value) => value.toLowerCase())
  const matched = tokens.find((token) => haystack.some((value) => value.includes(token)))

  if (matched) reasons.push(`Matches “${matched}”`)
  if (product.compareAtPrice !== undefined) reasons.push("On sale")
  if (product.inStock && product.rating >= 4.5) reasons.push(`Rated ${product.rating}/5`)

  return reasons.slice(0, 2)
}

/**
 * Renderers for the structured artifacts the chat API returns. Every value
 * shown comes from the server catalog — the assistants prose is never parsed
 * to produce prices, stock or links.
 */
export function SearchResults({ result }: { result: AgentSearchResult }) {
  if (result.products.length === 0) {
    return (
      <p className="mt-3 rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
        {result.note ?? "No products matched that search."}
      </p>
    )
  }

  return (
    <div className="mt-3" data-testid="search-results">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {result.resultCount} of {result.totalMatches} products
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {result.products.map((product) => (
          <AgentProductCard
            key={product.id}
            product={product}
            reasons={matchReasons(product, result.query)}
          />
        ))}
      </div>
    </div>
  )
}

export function AgentProductCard({
  product,
  footnote,
  badge,
  reasons,
}: {
  product: AgentProductSummary
  footnote?: string
  badge?: string
  /** Short, server-derived reasons this product matches the request. */
  reasons?: string[]
}) {
  return (
    <Link
      href={product.url}
      data-testid={`agent-product-${product.id}`}
      className="group rounded-lg border p-2 transition-colors hover:bg-neutral-50"
    >
      <div className="relative aspect-square overflow-hidden rounded-md bg-neutral-100">
        <ProductImage
          src={product.image ?? undefined}
          alt={product.name}
          sizes={CARD_SIZES}
        />
        {badge && (
          <Badge variant="secondary" className="absolute top-1.5 left-1.5 bg-white text-[10px]">
            {badge}
          </Badge>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-xs font-medium group-hover:underline">{product.name}</p>
      <p className="mt-1 flex items-baseline gap-1.5 text-xs">
        <span className="font-medium">{product.priceFormatted}</span>
        {product.compareAtPrice !== undefined && (
          <span className="text-muted-foreground line-through">
            {formatCents(product.compareAtPrice, product.currency)}
          </span>
        )}
      </p>
      {reasons && reasons.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {reasons.map((reason) => (
            <li
              key={reason}
              className="flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <Check className="h-2.5 w-2.5 shrink-0 text-success" />
              {reason}
            </li>
          ))}
        </ul>
      )}
      {footnote && <p className="mt-1 text-[11px] text-muted-foreground">{footnote}</p>}
      {!product.inStock && <p className="mt-1 text-[11px] text-destructive">Out of stock</p>}
    </Link>
  )
}

export function ComparisonResults({ comparison }: { comparison: AgentComparisonResult }) {
  const cheapestId = comparison.highlights.cheapest?.id
  const bestRatedId = comparison.highlights.highestRated?.id

  return (
    <div className="mt-3" data-testid="comparison-results">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Comparing {comparison.comparedCount} products
      </p>

      {comparison.notFound.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Ignored unknown product ids: <span className="font-mono">{comparison.notFound.join(", ")}</span>
          </span>
        </p>
      )}

      {/* Responsive cards: one column of stacked attributes per product. */}
      <div className="mt-2 space-y-2">
        {comparison.products.map((product) => {
          const badge = product.id === cheapestId ? "Lowest price" : product.id === bestRatedId ? "Top rated" : undefined
          return (
            <div key={product.id} className="rounded-lg border p-3" data-testid={`comparison-${product.id}`}>
              <div className="flex gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                  <ProductImage src={product.image ?? undefined} alt={product.name} sizes="64px" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={product.url} className="text-sm font-medium hover:underline">
                    {product.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {product.priceFormatted} · {product.availableVariantCount}/{product.variantCount}{" "}
                    variants available
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {badge && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Sparkles className="h-3 w-3" />
                        {badge}
                      </Badge>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Star className="h-3 w-3" />
                      {product.rating} ({product.reviewCount})
                    </span>
                  </div>
                </div>
              </div>

              <dl className="mt-2 divide-y border-t text-xs">
                {comparison.rows.map((row) => (
                  <div key={row.attribute} className="flex gap-2 py-1.5">
                    <dt
                      className={cn(
                        "w-1/3 shrink-0 text-muted-foreground",
                        !row.same && "font-medium text-amber-700"
                      )}
                    >
                      {row.attribute}
                    </dt>
                    <dd className="min-w-0 flex-1 break-words">{row.values[product.id] ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BudgetResults({ budget }: { budget: AgentBudgetResult }) {
  const budgetLabel = budget.budgetFormatted ?? formatCents(budget.budget, budget.currency)
  const topPickIds = budget.recommendations.topPicks.map((pick) => pick.id)

  return (
    <div className="mt-3" data-testid="budget-results">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Wallet className="h-3.5 w-3.5" />
        Budget {budgetLabel}
        {budget.category ? ` · ${budget.category}` : ""}
      </p>

      {budget.eligible.length === 0 ? (
        <div className="mt-2 rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
          <p>{budget.note ?? "Nothing in the catalog fits this budget."}</p>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {budget.eligible.map((product, index) => (
            <BudgetRow
              key={product.id}
              product={product}
              isTopPick={topPickIds.includes(product.id)}
              isBestValue={index === 0}
            />
          ))}
        </div>
      )}

      {/* Shown whether or not anything fits: the shopper sees what the next
          price tier buys, and by how much they would need to stretch. */}
      {budget.recommendations.nextStepUp && (
        <NextTierNote
          nextStepUp={budget.recommendations.nextStepUp}
          currency={budget.currency}
        />
      )}

      {budget.note && budget.eligible.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">{budget.note}</p>
      )}
    </div>
  )
}

/**
 * The cheapest option just out of reach.
 *
 * The tool reports it by id only, so there is no product URL to link to — it
 * is rendered as text rather than as a card.
 */
function NextTierNote({
  nextStepUp,
  currency,
}: {
  nextStepUp: NonNullable<AgentBudgetResult["recommendations"]["nextStepUp"]>
  currency?: string
}) {
  return (
    <p
      data-testid="budget-next-tier"
      className="mt-2 rounded-md bg-neutral-50 px-2.5 py-2 text-[11px] text-muted-foreground"
    >
      Next price tier:{" "}
      <span className="font-medium text-foreground">{nextStepUp.name}</span> at{" "}
      {formatCents(nextStepUp.price, currency)} —{" "}
      {formatCents(nextStepUp.additionalNeeded, currency)} over budget.
    </p>
  )
}

function BudgetRow({
  product,
  isTopPick,
  isBestValue,
}: {
  product: AgentBudgetProduct
  isTopPick: boolean
  isBestValue: boolean
}) {
  // Reasons derived strictly from server-provided numbers.
  const reasons: string[] = []
  if (isBestValue) reasons.push("Best value in your budget")
  if (product.qualifiesForFreeShipping) reasons.push("Free shipping")
  if (product.rating >= 4.5) reasons.push(`Rated ${product.rating}/5`)
  reasons.push(`${product.remainingBudgetFormatted} left in budget`)

  return (
    <div className="rounded-lg border p-3" data-testid={`budget-${product.id}`}>
      <div className="flex gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-100">
          <ProductImage src={product.image ?? undefined} alt={product.name} sizes="64px" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={product.url} className="text-sm font-medium hover:underline">
              {product.name}
            </Link>
            <span className="shrink-0 text-sm font-medium">{product.priceFormatted}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Landed cost {product.estimatedTotalFormatted} ({formatCents(product.price, product.currency)}{" "}
            + {formatCents(product.estimatedShipping, product.currency)} shipping +{" "}
            {formatCents(product.estimatedTax, product.currency)} tax)
          </p>
          {isTopPick && (
            <Badge variant="secondary" className="mt-1.5 gap-1 text-[10px]">
              <Sparkles className="h-3 w-3" />
              Top pick
            </Badge>
          )}
          <ul className="mt-1.5 space-y-0.5">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Check className="h-3 w-3 shrink-0 text-success" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function formatCents(amount: number, currency?: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
  }).format(amount / 100)
}
