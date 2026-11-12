import { existsSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

import type {
  Order,
  OrderStatus,
  OrderRepository,
  PaginationParams,
  PaginatedResult,
} from "@/types"

const DEFAULT_ORDERS_FILE = path.join(process.cwd(), "src", "data", "orders.json")

export class JsonOrderRepository implements OrderRepository {
  private filePath: string
  private writeLock: Promise<void> = Promise.resolve()

  constructor(filePath = DEFAULT_ORDERS_FILE) {
    this.filePath = filePath
  }

  /**
   * Override storage path (useful for testing without mutating real catalog data).
   */
  setStoragePath(filePath: string): void {
    this.filePath = filePath
  }

  getStoragePath(): string {
    return this.filePath
  }

  private async readAll(): Promise<Order[]> {
    try {
      if (!existsSync(this.filePath)) {
        return []
      }
      const raw = await readFile(this.filePath, "utf-8")
      if (!raw.trim()) {
        return []
      }
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as Order[]) : []
    } catch {
      // In case of read/parse error, fail safely with empty list or propagate
      return []
    }
  }

  private async writeAll(orders: Order[]): Promise<void> {
    const dir = path.dirname(this.filePath)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    const tempFile = `${this.filePath}.${randomUUID()}.tmp`
    const data = JSON.stringify(orders, null, 2)

    await writeFile(tempFile, data, "utf-8")
    await rename(tempFile, this.filePath)
  }

  private async withLock<T>(action: () => Promise<T>): Promise<T> {
    const next = this.writeLock.then(action, action)
    this.writeLock = next.then(() => {}, () => {})
    return next
  }

  async list(
    userId?: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Order>> {
    const all = await this.readAll()

    let filtered = all
    if (userId) {
      const target = userId.trim().toLowerCase()
      filtered = all.filter(
        (o) =>
          (o.userId && o.userId.toLowerCase() === target) ||
          (o.customerEmail && o.customerEmail.toLowerCase() === target)
      )
    }

    // Sort descending by creation date (newest orders first)
    filtered.sort((a, b) => {
      const dateA = Date.parse(a.createdAt) || 0
      const dateB = Date.parse(b.createdAt) || 0
      return dateB - dateA
    })

    const page = Math.max(1, pagination?.page ?? 1)
    const limit = Math.max(1, Math.min(100, pagination?.limit ?? 10))
    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const startIndex = (page - 1) * limit
    const items = filtered.slice(startIndex, startIndex + limit)

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  }

  async getById(id: string): Promise<Order | null> {
    if (!id || typeof id !== "string") return null
    const all = await this.readAll()
    const needle = id.trim()

    const match = all.find(
      (o) =>
        o.id === needle ||
        o.orderNumber === needle ||
        (o.paymentReference && o.paymentReference === needle) ||
        (o.paypalOrderId && o.paypalOrderId === needle)
    )

    return match ? { ...match } : null
  }

  async create(
    orderInput:
      | Order
      | (Omit<Order, "id" | "createdAt" | "updatedAt"> & {
          id?: string
          createdAt?: string
          updatedAt?: string
        })
  ): Promise<Order> {
    return this.withLock(async () => {
      const all = await this.readAll()

      // Idempotency: prevent duplicate order creation
      if (orderInput.id) {
        const existingById = all.find((o) => o.id === orderInput.id)
        if (existingById) return { ...existingById }
      }

      if (orderInput.paymentReference) {
        const existingByRef = all.find(
          (o) => o.paymentReference && o.paymentReference === orderInput.paymentReference
        )
        if (existingByRef) return { ...existingByRef }
      }

      if (orderInput.paypalOrderId) {
        const existingByPaypal = all.find(
          (o) => o.paypalOrderId && o.paypalOrderId === orderInput.paypalOrderId
        )
        if (existingByPaypal) return { ...existingByPaypal }
      }

      const nowIso = new Date().toISOString()
      const id = orderInput.id || `ord_${randomUUID().replace(/-/g, "").slice(0, 16)}`
      const createdAt = orderInput.createdAt || nowIso
      const updatedAt = orderInput.updatedAt || createdAt
      const orderNumber =
        orderInput.orderNumber ||
        `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`

      const newOrder: Order = {
        ...orderInput,
        id,
        orderNumber,
        createdAt,
        updatedAt,
      }

      all.unshift(newOrder)
      await this.writeAll(all)

      return newOrder
    })
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    return this.withLock(async () => {
      const all = await this.readAll()
      const index = all.findIndex((o) => o.id === id || o.orderNumber === id)

      if (index === -1) {
        throw new Error(`Order with ID "${id}" not found.`)
      }

      const updated: Order = {
        ...all[index],
        status,
        updatedAt: new Date().toISOString(),
      }

      all[index] = updated
      await this.writeAll(all)

      return updated
    })
  }

  /**
   * Reset store (primarily for unit/integration tests).
   */
  async clearForTesting(): Promise<void> {
    return this.withLock(async () => {
      await this.writeAll([])
    })
  }
}

export const jsonOrderRepository = new JsonOrderRepository()

