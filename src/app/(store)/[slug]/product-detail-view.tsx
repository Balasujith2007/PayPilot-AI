"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ChevronRight, Heart, Star, Check } from "lucide-react"
import { toast } from "sonner"
import { useCartStore } from "@/store/cart"
import { useWishlistStore } from "@/store/wishlist"
import { useRecentlyViewedStore } from "@/store/recently-viewed"
import { useHydrated } from "@/hooks/use-hydrated"
import { RecentlyViewed } from "@/components/products/recently-viewed"
import { ProductGallery } from "@/components/products/product-gallery"
import { VariantSelector } from "@/components/products/variant-selector"
import { QuantitySelector } from "@/components/products/quantity-selector"
import { ProductCard } from "@/components/products/product-card"
import { ProductReviews } from "@/components/products/product-reviews"
import { Reveal } from "@/components/home/reveal"
import { formatPrice, cn } from "@/lib/utils"
import { breadcrumbJsonLd } from "@/lib/structured-data"
import type { Product, Brand, Category } from "@/types"

interface ProductDetailViewProps {
  product: Product
  relatedProducts: Product[]
  brand: Brand | null
  categoryAncestors?: Category[]
}

const PRODUCT_FAQS = [
  {
    q: "How long does shipping take?",
    a: "Standard shipping typically delivers within 3 to 5 business days. Express shipping is also available at checkout for faster delivery.",
  },
  {
    q: "What is your return and exchange policy?",
    a: "We offer a 30-day hassle-free return and exchange policy. Items must be in their original packaging and condition with all tags attached.",
  },
  {
    q: "Are all products 100% genuine and warrantied?",
    a: "Yes, every product on PayPilot AI is sourced directly from verified authorized brand partners and is covered by standard manufacturer warranty.",
  },
]

export function ProductDetailView({
  product,
  relatedProducts,
  brand,
  categoryAncestors = [],
}: ProductDetailViewProps) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants[0]?.id ?? ""
  )
  const [quantity, setQuantity] = useState(1)
  const [isAdded, setIsAdded] = useState(false)
  const [activeTab, setActiveTab] = useState<"details" | "reviews" | "faqs">("details")

  const addToCart = useCartStore((s) => s.addItem)
  const openCart = useCartStore((s) => s.openCart)
  const wishlistItems = useWishlistStore((s) => s.items)
  const addToWishlist = useWishlistStore((s) => s.addItem)
  const removeFromWishlist = useWishlistStore((s) => s.removeItem)
  const addRecentlyViewed = useRecentlyViewedStore((s) => s.addItem)

  const mounted = useHydrated()

  const isWishlisted = mounted && wishlistItems.some((i) => i.productId === product.id)

  // Track recently viewed product
  useEffect(() => {
    addRecentlyViewed({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.variants[0]?.price ?? 0,
      imageUrl: product.images[0]?.url ?? "",
      imageAlt: product.images[0]?.alt ?? product.name,
    })
  }, [product.id, product.slug, product.name, product.variants, product.images, addRecentlyViewed])

  const selectedVariant =
    product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0]
  if (!selectedVariant) return null

  const hasCompareAt =
    Boolean(selectedVariant.compareAtPrice) &&
    (selectedVariant.compareAtPrice ?? 0) > selectedVariant.price
  const discountPercent = hasCompareAt
    ? Math.round(
        ((selectedVariant.compareAtPrice! - selectedVariant.price) /
          selectedVariant.compareAtPrice!) *
          100
      )
    : 0

  const inStock =
    selectedVariant.inventory.quantity > 0 ||
    selectedVariant.inventory.allowBackorder

  const maxStock = selectedVariant.inventory.allowBackorder
    ? 99
    : Math.max(1, selectedVariant.inventory.quantity || 99)

  function handleAddToCart() {
    if (!inStock) return

    addToCart({
      variantId: selectedVariant.id,
      productId: product.id,
      name: product.name,
      variantName: selectedVariant.name,
      image: product.images[0] ?? { url: "", alt: product.name },
      slug: product.slug,
      price: selectedVariant.price,
      quantity,
    })

    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 1600)
    openCart()
  }

  function handleToggleWishlist() {
    if (isWishlisted) {
      removeFromWishlist(product.id)
      toast("Removed from wishlist")
    } else {
      addToWishlist({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        price: selectedVariant.price,
        image: product.images[0] ?? { url: "", alt: product.name },
      })
      toast.success("Added to wishlist")
    }
  }

  const primaryCategory =
    categoryAncestors[categoryAncestors.length - 1] ?? categoryAncestors[0]

  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Shop", href: "/shop" },
    ...(primaryCategory
      ? [{ name: primaryCategory.name, href: `/${primaryCategory.slug}` }]
      : []),
    { name: product.name, href: `/${product.slug}` },
  ])

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((img) => img.url),
    sku: selectedVariant.sku,
    brand: brand ? { "@type": "Brand", name: brand.name } : undefined,
    aggregateRating:
      product.rating > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          }
        : undefined,
    offers: {
      "@type": "Offer",
      price: (selectedVariant.price / 100).toFixed(2),
      priceCurrency: selectedVariant.currency,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, breadcrumbLd]) }}
      />

      {/* Breadcrumb: Home > Shop > <category> > <product name> */}
      <nav aria-label="Breadcrumb" className="mb-6 sm:mb-9">
        <ol className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-black/60">
          <li>
            <Link href="/" className="hover:text-black transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="text-black/30">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li>
            <Link href="/shop" className="hover:text-black transition-colors">
              Shop
            </Link>
          </li>
          {primaryCategory && (
            <>
              <li aria-hidden="true" className="text-black/30">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                <Link
                  href={`/${primaryCategory.slug}`}
                  className="hover:text-black transition-colors"
                >
                  {primaryCategory.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true" className="text-black/30">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li
            className="font-medium text-black truncate max-w-[220px] sm:max-w-none"
            aria-current="page"
          >
            {product.name}
          </li>
        </ol>
      </nav>

      {/* Top Section: Gallery + Info Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 xl:gap-14 items-start">
        {/* Left: Gallery */}
        <Reveal delay={0.04}>
          <ProductGallery images={product.images} productName={product.name} />
        </Reveal>

        {/* Right: Info Panel */}
        <Reveal delay={0.08}>
          <div className="flex flex-col text-left">
            {/* Product Name in .font-display (large, uppercase) */}
            <h1 className="font-display text-2xl sm:text-3xl lg:text-[40px] font-black uppercase tracking-tight leading-[1.08] text-black">
              {product.name}
            </h1>

            {/* Star Rating with "4.5/5" ONLY if rating data exists */}
            {product.rating > 0 && (
              <div
                className="mt-3 sm:mt-3.5 flex items-center gap-2"
                aria-label={`Rating: ${product.rating} out of 5 stars`}
              >
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => {
                    const filled = i < Math.floor(product.rating)
                    return (
                      <Star
                        key={i}
                        className={cn(
                          "h-4 w-4 sm:h-5 sm:w-5",
                          filled
                            ? "fill-[#FFC633] text-[#FFC633]"
                            : "fill-black/10 text-black/10"
                        )}
                        aria-hidden="true"
                      />
                    )
                  })}
                </div>
                <span className="text-xs sm:text-sm font-semibold text-black">
                  {product.rating.toFixed(1)}
                  <span className="font-normal text-black/60">/5</span>
                </span>
                {product.reviewCount > 0 && (
                  <span className="text-xs sm:text-sm text-black/40">
                    ({product.reviewCount})
                  </span>
                )}
              </div>
            )}

            {/* Price: bold active price, struck original, pink discount pill */}
            <div className="mt-3.5 sm:mt-4 flex flex-wrap items-center gap-2.5 sm:gap-3.5">
              <span className="font-bold text-2xl sm:text-[32px] text-black tracking-tight leading-none">
                {formatPrice(selectedVariant.price, selectedVariant.currency)}
              </span>

              {hasCompareAt && (
                <>
                  <span className="font-bold text-2xl sm:text-[32px] text-black/40 line-through tracking-tight leading-none">
                    {formatPrice(
                      selectedVariant.compareAtPrice!,
                      selectedVariant.currency
                    )}
                  </span>
                  <span className="rounded-full bg-[#FF3333]/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-[#FF3333]">
                    -{discountPercent}%
                  </span>
                </>
              )}
            </div>

            {/* Short Description */}
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-black/60 leading-relaxed">
              {product.description}
            </p>

            {/* Divider */}
            <hr className="my-5 sm:my-6 border-t border-black/10" />

            {/* Variants: "Select Colors" and "Choose Size" ONLY if product has variants */}
            {product.variants.length > 1 && (
              <>
                <VariantSelector
                  variants={product.variants}
                  selectedVariantId={selectedVariantId}
                  onSelect={setSelectedVariantId}
                />
                <hr className="my-5 sm:my-6 border-t border-black/10" />
              </>
            )}

            {/* Quantity Stepper + Add to Cart + Wishlist Heart */}
            <div className="flex items-center gap-3 sm:gap-4 pt-1">
              <QuantitySelector
                quantity={quantity}
                onQuantityChange={setQuantity}
                min={1}
                max={maxStock}
              />

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!inStock}
                aria-label={
                  isAdded
                    ? "Added to Cart"
                    : inStock
                      ? `Add ${quantity} to Cart`
                      : "Out of Stock"
                }
                className="flex-1 rounded-full bg-black text-white hover:bg-black/85 font-medium py-3 sm:py-3.5 px-6 sm:px-8 flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-95 disabled:bg-black/40 disabled:cursor-not-allowed shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 min-h-[44px] sm:min-h-[50px]"
              >
                {isAdded ? (
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Check className="h-5 w-5 stroke-[2.5]" />
                    <span>Added to Cart!</span>
                  </span>
                ) : inStock ? (
                  <span>Add to Cart</span>
                ) : (
                  <span>Out of Stock</span>
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleWishlist}
                aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                className={cn(
                  "h-11 w-11 sm:h-[50px] sm:w-[50px] rounded-full border border-black/10 flex items-center justify-center transition-all duration-200 active:scale-90 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black",
                  isWishlisted
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-white text-black/70 hover:bg-[#F0EEED]"
                )}
              >
                <Heart className={cn("h-5 w-5", isWishlisted && "fill-current")} />
              </button>
            </div>

            {!inStock && (
              <p className="mt-2 text-xs sm:text-sm text-red-600 font-medium">
                This item is currently out of stock.
              </p>
            )}
          </div>
        </Reveal>
      </div>

      {/* Tabs Row Below: "Product Details", "Rating & Reviews", "FAQs" with sliding underline */}
      <section className="mt-14 sm:mt-20">
        <div className="border-b border-black/10">
          <div className="flex items-center justify-center max-w-3xl mx-auto">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={cn(
                "relative flex-1 py-4 sm:py-5 text-center text-sm sm:text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black",
                activeTab === "details"
                  ? "text-black font-semibold"
                  : "text-black/50 hover:text-black/80 font-normal"
              )}
            >
              Product Details
              {activeTab === "details" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("reviews")}
              className={cn(
                "relative flex-1 py-4 sm:py-5 text-center text-sm sm:text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black",
                activeTab === "reviews"
                  ? "text-black font-semibold"
                  : "text-black/50 hover:text-black/80 font-normal"
              )}
            >
              Rating & Reviews
              {product.reviewCount > 0 && ` (${product.reviewCount})`}
              {activeTab === "reviews" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("faqs")}
              className={cn(
                "relative flex-1 py-4 sm:py-5 text-center text-sm sm:text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black",
                activeTab === "faqs"
                  ? "text-black font-semibold"
                  : "text-black/50 hover:text-black/80 font-normal"
              )}
            >
              FAQs
              {activeTab === "faqs" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
              )}
            </button>
          </div>
        </div>

        {/* Tab Content Panels */}
        <div className="py-8 sm:py-12">
          {activeTab === "details" && (
            <div className="max-w-4xl mx-auto space-y-8 text-left animate-fade-in">
              {product.body ? (
                <div
                  className="blog-body text-black/80 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: product.body }}
                />
              ) : (
                <p className="text-black/70 text-base leading-relaxed">
                  {product.description}
                </p>
              )}

              {/* Specifications table */}
              <div className="rounded-[20px] border border-black/10 bg-[#FAFAFA] p-6 sm:p-8">
                <h3 className="font-semibold text-lg text-black mb-4">
                  Product Specifications
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5 text-sm">
                  <div className="flex justify-between border-b border-black/5 pb-2">
                    <dt className="text-black/60">SKU</dt>
                    <dd className="font-medium text-black">{selectedVariant.sku}</dd>
                  </div>
                  {brand && (
                    <div className="flex justify-between border-b border-black/5 pb-2">
                      <dt className="text-black/60">Brand</dt>
                      <dd className="font-medium text-black">{brand.name}</dd>
                    </div>
                  )}
                  {primaryCategory && (
                    <div className="flex justify-between border-b border-black/5 pb-2">
                      <dt className="text-black/60">Category</dt>
                      <dd className="font-medium text-black">{primaryCategory.name}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-black/5 pb-2">
                    <dt className="text-black/60">Availability</dt>
                    <dd className="font-medium text-black">
                      {inStock ? "In Stock" : "Out of Stock"}
                    </dd>
                  </div>
                  {product.tags.length > 0 && (
                    <div className="flex justify-between border-b border-black/5 pb-2 sm:col-span-2">
                      <dt className="text-black/60">Tags</dt>
                      <dd className="font-medium text-black">
                        {product.tags.join(", ")}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}

          {activeTab === "reviews" && (
            <ProductReviews
              productRating={product.rating}
              reviewCount={product.reviewCount}
            />
          )}

          {activeTab === "faqs" && (
            <div className="max-w-3xl mx-auto space-y-4 text-left animate-fade-in">
              {PRODUCT_FAQS.map((faq, idx) => (
                <div
                  key={idx}
                  className="rounded-[16px] border border-black/10 bg-white p-5 sm:p-6"
                >
                  <h4 className="font-semibold text-black text-base">
                    {faq.q}
                  </h4>
                  <p className="mt-2 text-sm text-black/70 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* YOU MIGHT ALSO LIKE (Hidden if fewer than 2 related products) */}
      {relatedProducts.length >= 2 && (
        <section className="mt-16 sm:mt-24 border-t border-black/10 pt-12 sm:pt-16">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[40px] font-black uppercase tracking-tight text-center text-black mb-8 sm:mb-14">
            YOU MIGHT ALSO LIKE
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.slice(0, 4).map((relProduct, index) => (
              <Reveal key={relProduct.id} delay={index * 0.08}>
                <ProductCard product={relProduct} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Recently viewed */}
      <RecentlyViewed excludeProductId={product.id} />
    </div>
  )
}
