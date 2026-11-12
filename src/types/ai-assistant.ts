import type { ProductImage, ProductOption, VariantInventory } from "@/types"

export type ChatRole = "user" | "assistant"

export interface RecommendedProduct {
  productId: string
  reason?: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
  isMock?: boolean
  status?: "sending" | "sent" | "error"
  products?: RecommendedProduct[]
}

export interface AssistantRequest {
  message: string
  conversationId?: string
}

export interface AssistantResponse {
  conversationId: string
  reply: string
  recommendedProducts: RecommendedProduct[]
  isMock?: boolean
}

export interface CatalogVariant {
  id: string
  name: string
  price: number
  currency: string
  inventory: VariantInventory
  options: ProductOption[]
}

export interface CatalogProduct {
  id: string
  name: string
  slug: string
  image?: ProductImage
  rating: number
  reviewCount: number
  tags: string[]
  brandName?: string
  categoryNames: string[]
  variants: CatalogVariant[]
}

