"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Check,
  CircleMinus,
  CirclePlus,
  Scale,
  TriangleAlert,
  Trophy,
  X,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { ProductImage } from "@/components/ui/product-image"
import { cn, formatPrice } from "@/lib/utils"
import {
  MAX_COMPARE_PRODUCTS,
  MIN_COMPARE_PRODUCTS,
  type ComparableProduct,
  type ComparisonRow,
  type ComparisonRowGroup,
  type ProductComparison,
} from "@/lib/comparison"
import { compareHref, useCompareStore } from "@/store/compare"
import { useHydrated } from "@/hooks/use-hydrated"

export interface CompareCatalogOption {
  id: string
  name: string
  slug: string
}

interface CompareViewProps {
  requestedIds: string[]
  products: ComparableProduct[]
  comparison: ProductComparison | null
  invalidIds: string[]
  overLimitIds: string[]
  catalog: CompareCatalogOption[]
}

const GROUP_LABELS: Record<ComparisonRowGroup, string> = {
  pricing: "Pricing",
  overview: "Overview",
  availability: "Availability",
  specifications: "Specifications",
  details: "Details",
}
const GROUP_ORDER: ComparisonRowGroup[] = [
  "pricing",
  "overview",
  "availability",
  "specifications",
  "details",
]

export function CompareView({
  requestedIds,
  products,
  comparison,
  invalidIds,
  overLimitIds,
  catalog,
}: CompareViewProps) {
  const router = useRouter()
  const hydrated = useHydrated()
  const [isPending, startTransition] = useTransition()
  const [differencesOnly, setDifferencesOnly] = useState(false)
  const storedItems = useCompareStore((s) => s.items)
  const setStoredItems = useCompareStore((s) => s.setItems)

  const productIds = products.map((p) => p.id)

  // Landing on /compare without IDs: restore the saved selection.
  useEffect(() => {
    if (hydrated && requestedIds.length === 0 && storedItems.length > 0) {
      router.replace(compareHref(storedItems.map((i) => i.productId)))
    }
  }, [hydrated, requestedIds.length, storedItems, router])

  // Keep the saved selection in sync with the server-validated products.
  const productKey = productIds.join(",")
  useEffect(() => {
    if (!hydrated || requestedIds.length === 0) return
    const storedKey = useCompareStore.getState().items.map((i) => i.productId).join(",")
    if (storedKey !== productKey) {
      setStoredItems(products.map((p) => ({ productId: p.id, name: p.name, slug: p.slug })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, productKey])

  function navigate(ids: string[]) {
    setStoredItems(
      ids.flatMap((id) => {
        const option = catalog.find((c) => c.id === id)
        return option ? [{ productId: option.id, name: option.name, slug: option.slug }] : []
      })
    )
    startTransition(() => {
      router.replace(compareHref(ids), { scroll: false })
    })
  }

  const handleRemove = (id: string) => navigate(productIds.filter((p) => p !== id))
  const handleAdd = (id: string) => navigate([...productIds, id])
  const handleReplace = (oldId: string, newId: string) =>
    navigate(productIds.map((p) => (p === oldId ? newId : p)))

  const availableOptions = catalog.filter((c) => !productIds.includes(c.id))
  const canAdd = products.length < MAX_COMPARE_PRODUCTS && availableOptions.length > 0
  const restoring = hydrated && requestedIds.length === 0 && storedItems.length > 0

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8" aria-busy={isPending}>
      <PageHeader
        title="Compare Products"
        description={`Compare up to ${MAX_COMPARE_PRODUCTS} products side by side. Everything shown comes from the product catalog.`}
      >
        {comparison && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={differencesOnly}
              onChange={(e) => setDifferencesOnly(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Show differences only
          </label>
        )}
      </PageHeader>

      <div className="mt-6 space-y-3">
        {invalidIds.length > 0 && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>
              {invalidIds.length === 1 ? "A product could not be found" : "Some products could not be found"}
            </AlertTitle>
            <AlertDescription>
              Ignored invalid or unknown product ID{invalidIds.length > 1 ? "s" : ""}:{" "}
              <span className="font-mono">{invalidIds.join(", ")}</span>
            </AlertDescription>
          </Alert>
        )}
        {overLimitIds.length > 0 && (
          <Alert>
            <TriangleAlert />
            <AlertTitle>Comparison limit reached</AlertTitle>
            <AlertDescription>
              Only the first {MAX_COMPARE_PRODUCTS} products are compared. Not shown:{" "}
              <span className="font-mono">{overLimitIds.join(", ")}</span>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className={cn("transition-opacity", isPending && "opacity-60")}>
        {comparison ? (
          <>
            <RecommendationCard comparison={comparison} />
            <ComparisonTable
              comparison={comparison}
              differencesOnly={differencesOnly}
              canAdd={canAdd}
              availableOptions={availableOptions}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onReplace={handleReplace}
            />
            <InsightsSection comparison={comparison} />
          </>
        ) : (
          <NotEnoughProducts
            products={products}
            restoring={restoring}
            canAdd={canAdd}
            availableOptions={availableOptions}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ProductSelect({
  options,
  onSelect,
  label,
  placeholder,
  className,
}: {
  options: CompareCatalogOption[]
  onSelect: (id: string) => void
  label: string
  placeholder: string
  className?: string
}) {
  return (
    <select
      aria-label={label}
      value=""
      onChange={(e) => e.target.value && onSelect(e.target.value)}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  )
}

function NotEnoughProducts({
  products,
  restoring,
  canAdd,
  availableOptions,
  onAdd,
  onRemove,
}: {
  products: ComparableProduct[]
  restoring: boolean
  canAdd: boolean
  availableOptions: CompareCatalogOption[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  if (restoring) {
    return <p className="mt-10 text-sm text-muted-foreground">Loading your comparison…</p>
  }
  const needed = MIN_COMPARE_PRODUCTS - products.length
  return (
    <div className="mt-10 flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center">
      <Scale className="h-12 w-12 text-muted-foreground/50" />
      <h2 className="mt-4 text-lg font-medium">
        {products.length === 0
          ? "No products selected"
          : `Add ${needed} more product${needed > 1 ? "s" : ""} to compare`}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Select at least {MIN_COMPARE_PRODUCTS} products. Use the compare button on any product, or
        pick from the list below.
      </p>
      {products.length > 0 && (
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-1 rounded-full border bg-neutral-50 py-1 pr-1 pl-3 text-sm"
            >
              {p.name}
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-neutral-200"
                aria-label={`Remove ${p.name} from comparison`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <ProductSelect
          options={availableOptions}
          onSelect={onAdd}
          label="Add a product to compare"
          placeholder="+ Add a product…"
          className="mt-6 max-w-xs"
        />
      )}
      <Button variant="link" asChild className="mt-2">
        <Link href="/shop">Browse all products</Link>
      </Button>
    </div>
  )
}

function RecommendationCard({ comparison }: { comparison: ProductComparison }) {
  const rec = comparison.recommendation
  if (!rec) return null
  const nameOf = (id: string) => comparison.products.find((p) => p.id === id)?.name ?? id
  const sortedScores = [...rec.scores].sort((a, b) => b.total - a.total)

  return (
    <section
      aria-labelledby="best-value-heading"
      className="mt-8 rounded-lg border bg-neutral-50 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-rating" />
        <div>
          <h2 id="best-value-heading" className="text-lg font-semibold">
            Best value: {rec.productName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{rec.summary}</p>
        </div>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium">How this is calculated</summary>
        <ul className="mt-3 space-y-1 text-muted-foreground">
          {rec.criteria.map((c) => (
            <li key={c.key}>
              <span className="font-medium text-foreground">
                {c.label} ({Math.round(c.weight * 100)}%)
              </span>{" "}
              — {c.description}
            </li>
          ))}
        </ul>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Product</th>
                {rec.criteria.map((c) => (
                  <th key={c.key} className="py-2 pr-3 font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="py-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {sortedScores.map((s) => (
                <tr key={s.productId} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{nameOf(s.productId)}</td>
                  {s.breakdown.map((b) => (
                    <td key={b.criterion} className="py-2 pr-3 text-muted-foreground">
                      {b.points} <span className="text-[11px]">({b.detail})</span>
                    </td>
                  ))}
                  <td className="py-2 font-semibold">{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {rec.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </details>
    </section>
  )
}

function ComparisonTable({
  comparison,
  differencesOnly,
  canAdd,
  availableOptions,
  onAdd,
  onRemove,
  onReplace,
}: {
  comparison: ProductComparison
  differencesOnly: boolean
  canAdd: boolean
  availableOptions: CompareCatalogOption[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onReplace: (oldId: string, newId: string) => void
}) {
  const { products, rows, recommendation } = comparison
  const visibleRows = differencesOnly ? rows.filter((r) => r.differs) : rows
  const grouped = useMemo(
    () =>
      GROUP_ORDER.map((g) => ({ group: g, rows: visibleRows.filter((r) => r.group === g) })).filter(
        (g) => g.rows.length > 0
      ),
    [visibleRows]
  )
  const columnCount = products.length + (canAdd ? 1 : 0)

  return (
    <section aria-labelledby="comparison-heading" className="mt-8">
      <h2 id="comparison-heading" className="sr-only">
        Side-by-side comparison
      </h2>
      <div className="overflow-x-auto rounded-lg border">
        <table
          className="w-full table-fixed border-collapse text-sm"
          style={{ minWidth: `${160 + columnCount * 200}px` }}
        >
          <colgroup>
            <col className="w-36 sm:w-44" />
            {Array.from({ length: columnCount }).map((_, i) => (
              <col key={i} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b align-top">
              <th scope="col" className="sticky left-0 z-10 bg-white p-3 text-left text-xs font-medium text-muted-foreground">
                {products.length} products
              </th>
              {products.map((p) => (
                <th key={p.id} scope="col" className="p-3 text-left font-normal">
                  <ProductColumnHeader
                    product={p}
                    isBestValue={recommendation?.productId === p.id}
                    canRemove
                    replaceOptions={availableOptions}
                    onRemove={() => onRemove(p.id)}
                    onReplace={(newId) => onReplace(p.id, newId)}
                  />
                </th>
              ))}
              {canAdd && (
                <th scope="col" className="p-3 text-left align-middle font-normal">
                  <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center">
                    <CirclePlus className="h-6 w-6 text-muted-foreground" />
                    <ProductSelect
                      options={availableOptions}
                      onSelect={onAdd}
                      label="Add a product to compare"
                      placeholder="+ Add a product…"
                    />
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 && (
              <tr>
                <td colSpan={columnCount + 1} className="p-6 text-center text-muted-foreground">
                  These products have no differences in the compared fields.
                </td>
              </tr>
            )}
            {grouped.map(({ group, rows: groupRows }) => (
              <GroupRows key={group} group={group} rows={groupRows} columnCount={columnCount} canAdd={canAdd} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-50 ring-1 ring-amber-200" /> Values differ
        </span>
        <span className="inline-flex items-center gap-1">
          <Check className="h-3 w-3 text-success" /> Best on this row
        </span>
        <span>“Not specified” means the catalog has no data for that field.</span>
      </p>
    </section>
  )
}

function GroupRows({
  group,
  rows,
  columnCount,
  canAdd,
}: {
  group: ComparisonRowGroup
  rows: ComparisonRow[]
  columnCount: number
  canAdd: boolean
}) {
  return (
    <>
      <tr className="border-b bg-neutral-50">
        <th
          scope="colgroup"
          colSpan={columnCount + 1}
          className="sticky left-0 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {GROUP_LABELS[group]}
        </th>
      </tr>
      {rows.map((r) => (
        <tr
          key={r.key}
          data-differs={r.differs || undefined}
          className={cn("border-b align-top last:border-0", r.differs && "bg-amber-50/60")}
        >
          <th
            scope="row"
            className={cn(
              "sticky left-0 z-10 p-3 text-left text-xs font-medium",
              r.differs ? "bg-amber-50" : "bg-white"
            )}
          >
            {r.label}
            {r.differs && (
              <span className="mt-1 block text-[10px] font-normal uppercase tracking-wide text-amber-700">
                Differs
              </span>
            )}
          </th>
          {r.values.map((value, i) => {
            const isBest = r.bestIndexes.includes(i)
            return (
              <td
                key={i}
                className={cn(
                  "p-3 break-words",
                  r.key === "description" && "text-xs leading-relaxed text-muted-foreground"
                )}
              >
                {value === null ? (
                  <span className="text-xs italic text-muted-foreground">Not specified</span>
                ) : (
                  <span className={cn(isBest && "font-semibold text-success")}>{value}</span>
                )}
                {isBest && r.bestLabel && (
                  <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-success">
                    <Check className="h-3 w-3" />
                    {r.bestLabel}
                  </span>
                )}
              </td>
            )
          })}
          {canAdd && <td />}
        </tr>
      ))}
    </>
  )
}

function ProductColumnHeader({
  product,
  isBestValue,
  canRemove,
  replaceOptions,
  onRemove,
  onReplace,
}: {
  product: ComparableProduct
  isBestValue: boolean
  canRemove: boolean
  replaceOptions: CompareCatalogOption[]
  onRemove: () => void
  onReplace: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2" data-testid={`compare-column-${product.id}`}>
      <div className="relative aspect-square w-full max-w-[160px] overflow-hidden rounded-md bg-neutral-100">
        <ProductImage
          src={product.image?.url}
          alt={product.image?.alt ?? product.name}
          sizes="160px"
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm hover:bg-neutral-50"
            aria-label={`Remove ${product.name} from comparison`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isBestValue && (
        <Badge className="w-fit gap-1">
          <Trophy className="h-3 w-3" /> Best value
        </Badge>
      )}
      <Link href={`/${product.slug}`} className="font-medium leading-snug hover:underline">
        {product.name}
      </Link>
      <span className="text-sm">{formatPrice(product.price.min, product.price.currency)}</span>
      {replaceOptions.length > 0 && (
        <ProductSelect
          options={replaceOptions}
          onSelect={onReplace}
          label={`Replace ${product.name} with another product`}
          placeholder="Replace with…"
          className="text-xs"
        />
      )}
    </div>
  )
}

function InsightsSection({ comparison }: { comparison: ProductComparison }) {
  return (
    <section aria-labelledby="insights-heading" className="mt-12">
      <h2 id="insights-heading" className="text-xl font-bold tracking-tight">
        Advantages &amp; disadvantages
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Based only on catalog data, relative to the other products in this comparison.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {comparison.insights.map((insight) => {
          const product = comparison.products.find((p) => p.id === insight.productId)
          if (!product) return null
          return (
            <div key={insight.productId} className="rounded-lg border p-4">
              <h3 className="font-medium">{product.name}</h3>
              <InsightList
                title="Advantages"
                items={insight.advantages}
                icon={<CirclePlus className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
              />
              <InsightList
                title="Disadvantages"
                items={insight.disadvantages}
                icon={<CircleMinus className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function InsightList({
  title,
  items,
  icon,
}: {
  title: string
  items: string[]
  icon: React.ReactNode
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">None identified from available data.</p>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm">
              {icon}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
