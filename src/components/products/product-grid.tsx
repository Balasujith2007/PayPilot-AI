import type { Product } from "@/types"
import { ProductCard } from "./product-card"
import { cn } from "@/lib/utils"

interface ProductGridProps {
  products: Product[]
  className?: string
}

export function ProductGrid({ products, className }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">No products found.</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
