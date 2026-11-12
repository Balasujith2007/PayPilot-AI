"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  Package,
  ExternalLink,
  X,
  RefreshCw,
  Database,
  ArrowUpDown,
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { formatPrice } from "@/lib/utils"
import { ProductImageDropzone, type ProductImageItem } from "@/components/admin/product-image-dropzone"
import { toast } from "sonner"

interface Variant {
  id: string
  name: string
  sku: string
  price: number // in cents/paise
  compareAtPrice: number | null
  quantity: number
}

interface Category {
  id: string
  name: string
  slug: string
}

interface Brand {
  id: string
  name: string
  slug: string
}

interface Product {
  id: string
  name: string
  slug: string
  description: string
  body?: string | null
  images: ProductImageItem[]
  status: "ACTIVE" | "DRAFT" | "ARCHIVED"
  tags: string[]
  brand?: Brand | null
  categories: Category[]
  variants: Variant[]
  createdAt: string
  updatedAt: string
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("")

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [formName, setFormName] = useState("")
  const [formSlug, setFormSlug] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formBody, setFormBody] = useState("")
  const [formBrandId, setFormBrandId] = useState("")
  const [formCategoryIds, setFormCategoryIds] = useState<string[]>([])
  const [formImages, setFormImages] = useState<ProductImageItem[]>([])
  const [formPrice, setFormPrice] = useState("") // in Rupees
  const [formCompareAtPrice, setFormCompareAtPrice] = useState("") // in Rupees
  const [formSku, setFormSku] = useState("")
  const [formQuantity, setFormQuantity] = useState("50")
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "DRAFT" | "ARCHIVED">("ACTIVE")

  // Load products from DB
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (selectedCategory) params.set("category", selectedCategory)
      if (selectedStatus) params.set("status", selectedStatus)

      const res = await fetch(`/api/admin/products?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setProducts(data.products)
      } else {
        toast.error("Failed to load products from database")
      }
    } catch {
      toast.error("Network error while loading products")
    } finally {
      setLoading(false)
    }
  }, [search, selectedCategory, selectedStatus])

  // Load categories and brands
  useEffect(() => {
    async function loadMeta() {
      try {
        const [catRes, brandRes] = await Promise.all([
          fetch("/api/admin/categories"),
          fetch("/api/admin/brands"),
        ])
        const [catData, brandData] = await Promise.all([catRes.json(), brandRes.json()])
        if (catData.success) setCategories(catData.categories)
        if (brandData.success) setBrands(brandData.brands)
      } catch (e) {
        console.error("Failed to load metadata", e)
      }
    }
    loadMeta()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadProducts])

  // 1-Click Sync Real Storefront Catalog to Neon DB
  const handleSyncCatalog = async () => {
    try {
      setSyncing(true)
      const res = await fetch("/api/admin/products/sync", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message || "Synced real products into Neon PostgreSQL!")
        await loadProducts()
      } else {
        toast.error(data.error || "Failed to sync catalog")
      }
    } catch {
      toast.error("Failed to connect to database sync endpoint")
    } finally {
      setSyncing(false)
    }
  }

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingProduct(null)
    setFormName("")
    setFormSlug("")
    setFormDescription("")
    setFormBody("")
    setFormBrandId(brands[0]?.id || "")
    setFormCategoryIds(categories.slice(0, 1).map((c) => c.id))
    setFormImages([])
    setFormPrice("1999")
    setFormCompareAtPrice("2499")
    setFormSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`)
    setFormQuantity("45")
    setFormStatus("ACTIVE")
    setIsModalOpen(true)
  }

  // Open modal for Edit
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p)
    setFormName(p.name)
    setFormSlug(p.slug)
    setFormDescription(p.description)
    setFormBody(p.body || "")
    setFormBrandId(p.brand?.id || brands[0]?.id || "")
    setFormCategoryIds(p.categories.map((c) => c.id))
    setFormImages(
      p.images && p.images.length > 0
        ? p.images
        : [{ url: "/images/products/placeholder.svg", alt: p.name, width: 800, height: 800 }]
    )
    const variant = p.variants?.[0]
    setFormPrice(variant ? (variant.price / 100).toString() : "999")
    setFormCompareAtPrice(
      variant?.compareAtPrice ? (variant.compareAtPrice / 100).toString() : ""
    )
    setFormSku(variant?.sku || "")
    setFormQuantity(variant?.quantity !== undefined ? variant.quantity.toString() : "0")
    setFormStatus(p.status)
    setIsModalOpen(true)
  }

  // Submit Product Create or Edit
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formDescription.trim()) {
      toast.error("Please enter both product name and description")
      return
    }

    try {
      setSaving(true)
      const payload = {
        name: formName.trim(),
        description: formDescription.trim(),
        body: formBody.trim() || null,
        brandId: formBrandId || brands[0]?.id,
        categoryIds: formCategoryIds,
        images:
          formImages.length > 0
            ? formImages
            : [
                {
                  url: "/images/products/placeholder.svg",
                  alt: formName.trim(),
                  width: 800,
                  height: 800,
                },
              ],
        status: formStatus,
        price: parseFloat(formPrice) || 0,
        compareAtPrice: formCompareAtPrice ? parseFloat(formCompareAtPrice) || null : null,
        sku: formSku,
        quantity: parseInt(formQuantity) || 0,
      }

      if (editingProduct) {
        // Update
        const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) {
          toast.success(`Updated "${formName}" in database!`)
          setIsModalOpen(false)
          loadProducts()
        } else {
          toast.error(data.error || "Failed to update product")
        }
      } else {
        // Create
        const res = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) {
          toast.success(`Added "${formName}" to database!`)
          setIsModalOpen(false)
          loadProducts()
        } else {
          toast.error(data.error || "Failed to create product")
        }
      }
    } catch {
      toast.error("Failed to save product")
    } finally {
      setSaving(false)
    }
  }

  // Delete / Archive Product
  const handleDeleteProduct = async (p: Product) => {
    if (
      !confirm(
        `Are you sure you want to remove "${p.name}"? If it has historical orders, it will be archived safely.`
      )
    ) {
      return
    }

    try {
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        loadProducts()
      } else {
        toast.error(data.error || "Failed to delete product")
      }
    } catch {
      toast.error("Failed to delete product")
    }
  }

  // Live discount calculation for modal preview
  const numPrice = parseFloat(formPrice) || 0
  const numCompare = parseFloat(formCompareAtPrice) || 0
  const discountPct =
    numCompare > numPrice && numPrice > 0
      ? Math.round(((numCompare - numPrice) / numCompare) * 100)
      : null

  // Summary Metrics
  const totalCount = products.length
  const activeCount = products.filter((p) => p.status === "ACTIVE").length
  const lowStockCount = products.filter((p) => (p.variants?.[0]?.quantity ?? 0) < 15).length
  const outOfStockCount = products.filter((p) => (p.variants?.[0]?.quantity ?? 0) === 0).length

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Add Product and Sync CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/10 pb-5">
        <PageHeader
          title="Product Management"
          description="Manage actual storefront products, pricing, stock levels, and media stored in Neon PostgreSQL."
        />

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
          <button
            type="button"
            onClick={handleSyncCatalog}
            disabled={syncing || loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white py-2.5 px-4 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer shadow-2xs"
            title="Populate or sync live storefront products to database"
          >
            <Database className={`size-3.5 text-black/70 ${syncing ? "animate-pulse text-emerald-600" : ""}`} />
            <span>{syncing ? "Syncing DB..." : "Sync DB Catalog"}</span>
          </button>

          <button
            type="button"
            onClick={loadProducts}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white p-2.5 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer shadow-2xs"
            title="Refresh database"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-full bg-black py-2.5 px-5 text-xs font-bold text-white shadow-xs hover:bg-black/85 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Inventory Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="rounded-2xl border-black/10 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-black/60">Total Products</span>
          <p className="text-xl font-black text-black mt-1 tabular-nums">{totalCount}</p>
        </Card>
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-900">Active in Store</span>
          <p className="text-xl font-black text-emerald-900 mt-1 tabular-nums">{activeCount}</p>
        </Card>
        <Card className="rounded-2xl border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-900">Low Stock (&lt; 15 units)</span>
          <p className="text-xl font-black text-amber-900 mt-1 tabular-nums">{lowStockCount}</p>
        </Card>
        <Card className="rounded-2xl border-red-200 bg-red-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-red-900">Out of Stock</span>
          <p className="text-xl font-black text-red-900 mt-1 tabular-nums">{outOfStockCount}</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-black/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name, slug, or keywords..."
            className="w-full rounded-full bg-white border border-black/10 pl-10 pr-4 py-2.5 text-xs font-medium text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-full bg-white border border-black/10 px-4 py-2.5 text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer shadow-2xs w-full sm:w-auto"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-full bg-white border border-black/10 px-4 py-2.5 text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer shadow-2xs w-full sm:w-auto"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Product List Table */}
      <Card className="rounded-[20px] border-black/10 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-black/10 bg-[#F0EEED]/40 text-black/60 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 pl-6">Product</th>
                <th className="py-3.5">Category & Brand</th>
                <th className="py-3.5 text-right">Price</th>
                <th className="py-3.5 text-right">Discount / Compare</th>
                <th className="py-3.5 text-center">Stock Level</th>
                <th className="py-3.5 text-center">Status</th>
                <th className="py-3.5 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-black/50">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="size-4 animate-spin" />
                      <span>Loading products from Neon PostgreSQL...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-black/50">
                    <p className="font-semibold text-sm">No products found in database</p>
                    <p className="text-xs text-black/40 mt-1">
                      Click &quot;Sync DB Catalog&quot; to load the site&apos;s current catalog, or &quot;Add New Product&quot;.
                    </p>
                    <button
                      type="button"
                      onClick={handleSyncCatalog}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-black/85 transition-all cursor-pointer"
                    >
                      <Database className="size-3.5" />
                      <span>Sync 14 Storefront Products Now</span>
                    </button>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const defaultVariant = p.variants?.[0]
                  const price = defaultVariant?.price ?? 0
                  const comparePrice = defaultVariant?.compareAtPrice
                  const stock = defaultVariant?.quantity ?? 0
                  const firstImg = p.images?.[0]
                  const firstImgUrl = typeof firstImg === "string" ? firstImg : firstImg?.url

                  return (
                    <tr key={p.id} className="hover:bg-[#F0EEED]/30 transition-colors">
                      {/* Product Thumbnail & Title */}
                      <td className="py-3.5 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="relative size-12 rounded-xl overflow-hidden bg-[#F0EEED] border border-black/10 shrink-0">
                            {firstImgUrl ? (
                              <Image
                                src={firstImgUrl}
                                alt={(typeof firstImg === "object" && firstImg?.alt) || p.name}
                                fill
                                unoptimized={Boolean(firstImgUrl.startsWith("data:") || firstImgUrl.startsWith("http"))}
                                className="object-cover"
                              />
                            ) : (
                              <div className="size-full flex items-center justify-center text-black/30">
                                <Package className="size-5" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-black text-xs line-clamp-1 max-w-[220px]">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-black/40 font-mono">
                              SKU: {defaultVariant?.sku || "N/A"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category & Brand */}
                      <td className="py-3.5">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-black">
                            {p.categories?.map((c) => c.name).join(", ") || "General"}
                          </p>
                          <p className="text-[10px] text-black/50">
                            {p.brand?.name || "PayPilot AI"}
                          </p>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 text-right font-bold text-black tabular-nums">
                        {formatPrice(price)}
                      </td>

                      {/* Compare At / Discount Price */}
                      <td className="py-3.5 text-right tabular-nums">
                        {comparePrice && comparePrice > price ? (
                          <div>
                            <span className="line-through text-black/40 text-[11px]">
                              {formatPrice(comparePrice)}
                            </span>
                            <span className="ml-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-sm">
                              {Math.round(((comparePrice - price) / comparePrice) * 100)}% OFF
                            </span>
                          </div>
                        ) : (
                          <span className="text-black/30 text-[11px]">Regular</span>
                        )}
                      </td>

                      {/* Stock Level */}
                      <td className="py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            stock === 0
                              ? "bg-red-100 text-red-800"
                              : stock < 15
                              ? "bg-amber-100 text-amber-900"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {stock === 0 ? "Out of stock" : `${stock} units`}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 text-center">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            p.status === "ACTIVE"
                              ? "bg-black text-white"
                              : p.status === "DRAFT"
                              ? "bg-black/10 text-black"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/${p.slug}`}
                            target="_blank"
                            title="View product in live storefront"
                            className="p-1.5 rounded-lg text-black/60 hover:text-black hover:bg-[#F0EEED] transition-colors"
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit product details & images"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-black/10 bg-white text-xs font-bold text-black hover:bg-black hover:text-white shadow-2xs transition-all cursor-pointer"
                          >
                            <Edit2 className="size-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            title="Delete or archive product"
                            className="p-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── CREATE / EDIT PRODUCT MODAL DRAWER ──────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-[24px] border border-black/10 bg-white p-4 sm:p-8 shadow-2xl text-left">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-black/10 pb-4 mb-6">
              <div>
                <h3 className="font-bold text-lg text-black">
                  {editingProduct ? `Edit "${editingProduct.name}"` : "Create New Product"}
                </h3>
                <p className="text-xs text-black/60">
                  Saves directly to Neon PostgreSQL database and updates the storefront.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-black/60 hover:bg-[#F0EEED] hover:text-black transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitProduct} className="space-y-5">
              {/* Product Name & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-black mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Wireless Noise-Cancelling Headphones"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs text-black font-medium focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="auto-generated-if-empty"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs font-mono text-black/70 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Short Description *
                </label>
                <textarea
                  required
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Concise overview shown in cards and summaries..."
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs text-black font-medium focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Category & Brand Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Primary Category
                  </label>
                  <select
                    value={formCategoryIds[0] || ""}
                    onChange={(e) => setFormCategoryIds([e.target.value])}
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs text-black font-semibold focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Brand
                  </label>
                  <select
                    value={formBrandId}
                    onChange={(e) => setFormBrandId(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs text-black font-semibold focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing & Discounts (INR ₹) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[#F0EEED]/40 p-4 rounded-2xl border border-black/10">
                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Retail Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="1999"
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Compare-at Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCompareAtPrice}
                    onChange={(e) => setFormCompareAtPrice(e.target.value)}
                    placeholder="2499 (for discount)"
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  {discountPct !== null && (
                    <span className="block mt-1 text-[10px] font-bold text-red-600">
                      Save {discountPct}% OFF
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Stock Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    placeholder="50"
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as "ACTIVE" | "DRAFT" | "ARCHIVED")
                    }
                    className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              {/* SKU */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  SKU Code
                </label>
                <input
                  type="text"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  placeholder="WH-BLK-001"
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-mono font-medium text-black focus:outline-none focus:ring-2 focus:ring-black uppercase"
                />
              </div>

              {/* Drag & Drop Product Image Uploader */}
              <div className="pt-2">
                <ProductImageDropzone
                  images={formImages}
                  onChange={setFormImages}
                  productName={formName || "Product"}
                  maxImages={8}
                />
              </div>

              {/* Detailed Long Body / Features HTML */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Detailed Description / Specifications (HTML)
                </label>
                <textarea
                  rows={4}
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="<h3>Features</h3><ul><li>Feature 1</li></ul>"
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs font-mono text-black focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-black/10 py-2.5 px-5 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-black py-2.5 px-6 text-xs font-bold text-white hover:bg-black/85 disabled:opacity-50 active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-2"
                >
                  {saving && <RefreshCw className="size-3 animate-spin" />}
                  <span>{editingProduct ? "Save Changes in DB" : "Create Product in DB"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
