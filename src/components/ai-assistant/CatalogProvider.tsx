"use client"

import React, { createContext, useContext, useMemo } from "react"
import type { CatalogProduct } from "@/types/ai-assistant"

interface CatalogContextType {
  products: CatalogProduct[]
  getById: (id: string) => CatalogProduct | undefined
}

const CatalogContext = createContext<CatalogContextType | null>(null)

export function CatalogProvider({
  products,
  children,
}: {
  products: CatalogProduct[]
  children: React.ReactNode
}) {
  const value = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]))
    return {
      products,
      getById: (id: string) => productMap.get(id),
    }
  }, [products])

  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  )
}

export function useCatalog(): CatalogContextType {
  const context = useContext(CatalogContext)
  if (!context) {
    throw new Error("useCatalog must be used within a CatalogProvider")
  }
  return context
}

