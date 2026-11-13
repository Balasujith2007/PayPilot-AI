import type { Category, CategoryRepository } from "@/types"
import { prisma } from "@/lib/db/prisma"
import { jsonCategoryRepository } from "./json-category-repository"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCategory(c: any): Category {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description || "",
    image: c.image ?? undefined,
    parentId: c.parentId ?? undefined,
    order: c.order ?? 0,
  }
}

export const prismaCategoryRepository: CategoryRepository & {
  getChildren(parentId: string): Promise<Category[]>
  getTopLevel(): Promise<Category[]>
  getAncestors(categoryId: string): Promise<Category[]>
} = {
  async list(): Promise<Category[]> {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { order: "asc" },
      })
      if (categories.length > 0) {
        return categories.map(mapCategory)
      }
      return await jsonCategoryRepository.list()
    } catch {
      return await jsonCategoryRepository.list()
    }
  },

  async getBySlug(slug: string): Promise<Category | null> {
    try {
      const category = await prisma.category.findUnique({
        where: { slug },
      })
      if (category) return mapCategory(category)
      return await jsonCategoryRepository.getBySlug(slug)
    } catch {
      return await jsonCategoryRepository.getBySlug(slug)
    }
  },

  async getById(id: string): Promise<Category | null> {
    try {
      const category = await prisma.category.findUnique({
        where: { id },
      })
      if (category) return mapCategory(category)
      return await jsonCategoryRepository.getById(id)
    } catch {
      return await jsonCategoryRepository.getById(id)
    }
  },

  async getChildren(parentId: string): Promise<Category[]> {
    try {
      const children = await prisma.category.findMany({
        where: { parentId },
        orderBy: { order: "asc" },
      })
      if (children.length > 0) return children.map(mapCategory)
      return await jsonCategoryRepository.getChildren(parentId)
    } catch {
      return await jsonCategoryRepository.getChildren(parentId)
    }
  },

  async getTopLevel(): Promise<Category[]> {
    try {
      const topLevel = await prisma.category.findMany({
        where: { parentId: null },
        orderBy: { order: "asc" },
      })
      if (topLevel.length > 0) return topLevel.map(mapCategory)
      return await jsonCategoryRepository.getTopLevel()
    } catch {
      return await jsonCategoryRepository.getTopLevel()
    }
  },

  async getAncestors(categoryId: string): Promise<Category[]> {
    try {
      const all = await this.list()
      const chain: Category[] = []
      let current = all.find((c) => c.id === categoryId)
      while (current) {
        chain.unshift(current)
        current = current.parentId
          ? all.find((c) => c.id === current!.parentId)
          : undefined
      }
      return chain
    } catch {
      return await jsonCategoryRepository.getAncestors(categoryId)
    }
  },
}

