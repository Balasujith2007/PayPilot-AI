"use client"

import { useState, useEffect, useCallback } from "react"
import {
  FolderTree,
  Plus,
  RefreshCw,
  Package,
  Layers,
  X,
  ExternalLink,
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import Link from "next/link"

interface Category {
  id: string
  name: string
  slug: string
  description: string
  _count?: { products: number }
}

interface Brand {
  id: string
  name: string
  slug: string
  description: string
  _count?: { products: number }
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  // Add Category Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [catRes, brandRes] = await Promise.all([
        fetch("/api/admin/categories"),
        fetch("/api/admin/brands"),
      ])
      const [catData, brandData] = await Promise.all([catRes.json(), brandRes.json()])
      if (catData.success) setCategories(catData.categories)
      if (brandData.success) setBrands(brandData.brands)
    } catch {
      toast.error("Failed to load categories and brands")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      toast.error("Category name is required")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Created category "${formName}" in database!`)
        setIsModalOpen(false)
        setFormName("")
        setFormDescription("")
        loadData()
      } else {
        toast.error(data.error || "Failed to create category")
      }
    } catch {
      toast.error("Network error while creating category")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/10 pb-5">
        <PageHeader
          title="Categories & Brands"
          description="Manage store departments, catalog hierarchy, and brand partners in Neon PostgreSQL."
        />

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white p-2.5 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer"
            title="Refresh database"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-black py-2.5 px-5 text-xs font-bold text-white shadow-xs hover:bg-black/85 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Categories Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-black flex items-center gap-2">
            <FolderTree className="size-4" />
            <span>Product Categories ({categories.length})</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((c) => (
            <Card
              key={c.id}
              className="rounded-[20px] border-black/10 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-bold text-sm text-black line-clamp-1">{c.name}</h4>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold text-black/70">
                    {c._count?.products || 0} products
                  </span>
                </div>
                <p className="text-[11px] text-black/60 line-clamp-2 mb-4">
                  {c.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-black/5 text-[10px] text-black/50">
                <span className="font-mono">slug: /{c.slug}</span>
                <Link
                  href={`/${c.slug}`}
                  target="_blank"
                  className="font-semibold text-black hover:underline flex items-center gap-1"
                >
                  <span>View</span>
                  <ExternalLink className="size-2.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Brands Directory */}
      <div className="pt-6 border-t border-black/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-black flex items-center gap-2">
            <Layers className="size-4" />
            <span>Featured Brands & Manufacturers ({brands.length})</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((b) => (
            <Card
              key={b.id}
              className="rounded-[20px] border-black/10 bg-white p-5 shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-black text-sm text-black tracking-tight uppercase">
                    {b.name}
                  </h4>
                  <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                    {b._count?.products || 0} items
                  </span>
                </div>
                <p className="text-[11px] text-black/60 line-clamp-2">
                  {b.description}
                </p>
              </div>

              <div className="pt-3 border-t border-black/5 text-[10px] text-black/40 font-mono mt-3">
                ID: {b.id}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Add Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-[24px] border border-black/10 bg-white p-4 sm:p-7 shadow-2xl text-left max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/10 pb-3 mb-5">
              <h3 className="font-bold text-base text-black">Add New Category</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1.5 text-black/60 hover:bg-[#F0EEED] transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Footwear & Shoes"
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs text-black font-medium focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Description of the category..."
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs text-black font-medium focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-black/10 py-2 px-4 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-black py-2 px-5 text-xs font-bold text-white hover:bg-black/85 disabled:opacity-50 active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  {saving && <RefreshCw className="size-3 animate-spin" />}
                  <span>Save Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

