import type { Brand } from "@/types"
import { prisma } from "@/lib/db/prisma"
import { jsonBrandRepository } from "./json-brand-repository"

export const prismaBrandRepository = {
  async list(): Promise<Brand[]> {
    try {
      const brands = await prisma.brand.findMany({
        orderBy: { name: "asc" },
      })
      if (brands.length > 0) {
        return brands.map((b) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          description: b.description || "",
        }))
      }
      return await jsonBrandRepository.list()
    } catch {
      return await jsonBrandRepository.list()
    }
  },

  async getBySlug(slug: string): Promise<Brand | null> {
    try {
      const brand = await prisma.brand.findUnique({
        where: { slug },
      })
      if (brand) {
        return {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          description: brand.description || "",
        }
      }
      return await jsonBrandRepository.getBySlug(slug)
    } catch {
      return await jsonBrandRepository.getBySlug(slug)
    }
  },

  async getById(id: string): Promise<Brand | null> {
    try {
      const brand = await prisma.brand.findUnique({
        where: { id },
      })
      if (brand) {
        return {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          description: brand.description || "",
        }
      }
      return await jsonBrandRepository.getById(id)
    } catch {
      return await jsonBrandRepository.getById(id)
    }
  },
}

