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

      // Sync to Neon PostgreSQL if DATABASE_URL is configured
      if (process.env.DATABASE_URL) {
        try {
          const { prisma } = await import("@/lib/db/prisma")
          
          // Verify user exists if userId was provided to prevent FK violation
          let validUserId: string | null = null
          if (newOrder.userId) {
            const userExists = await prisma.user.findUnique({ where: { id: newOrder.userId } }).catch(() => null)
            if (userExists) validUserId = userExists.id
          }

          const statusMap: Record<string, "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED"> = {
            pending: "PENDING",
            processing: "PROCESSING",
            shipped: "SHIPPED",
            delivered: "DELIVERED",
            cancelled: "CANCELLED",
            refunded: "REFUNDED",
          }

          const paymentStatusMap: Record<string, "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED"> = {
            pending: "PENDING",
            authorized: "AUTHORIZED",
            captured: "CAPTURED",
            failed: "FAILED",
            refunded: "REFUNDED",
          }

          const paymentMethodMap: Record<string, "CARD" | "PAYPAL" | "BANK_TRANSFER" | "WALLET" | "OTHER"> = {
            card: "CARD",
            paypal: "PAYPAL",
            bank_transfer: "BANK_TRANSFER",
            wallet: "WALLET",
            other: "OTHER",
          }

          const dbStatus = statusMap[newOrder.status?.toLowerCase()] || "PENDING"
          const dbPaymentStatus = paymentStatusMap[newOrder.paymentStatus?.toLowerCase()] || "PENDING"
          const dbPaymentMethod = newOrder.paymentMethod ? (paymentMethodMap[newOrder.paymentMethod.toLowerCase()] || "OTHER") : null

          const toJson = (val: unknown) => JSON.parse(JSON.stringify(val ?? {}))
          const shippingAddressJson = toJson(newOrder.shippingAddress)
          const billingAddressJson = newOrder.billingAddress ? toJson(newOrder.billingAddress) : null

          // Check if an order already exists in Neon by ID, orderNumber, or paymentReference
          const existingDbOrder = await prisma.order
            .findFirst({
              where: {
                OR: [
                  { id: newOrder.id },
                  { orderNumber: newOrder.orderNumber },
                  ...(newOrder.paymentReference ? [{ paymentReference: newOrder.paymentReference }] : []),
                  ...(newOrder.paypalOrderId ? [{ paypalOrderId: newOrder.paypalOrderId }] : []),
                ],
              },
            })
            .catch(() => null)

          const targetId = existingDbOrder ? existingDbOrder.id : newOrder.id

          await prisma.order.upsert({
            where: { id: targetId },
            update: {
              orderNumber: newOrder.orderNumber,
              userId: validUserId,
              status: dbStatus,
              paymentStatus: dbPaymentStatus,
              paymentMethod: dbPaymentMethod,
              paymentReference: newOrder.paymentReference ?? null,
              paypalOrderId: newOrder.paypalOrderId ?? null,
              subtotal: newOrder.subtotal,
              tax: newOrder.tax,
              shipping: newOrder.shipping,
              total: newOrder.total,
              currency: newOrder.currency ?? "USD",
              customerEmail: newOrder.customerEmail ?? "",
              customerName: newOrder.customerName ?? "",
              shippingAddress: shippingAddressJson,
              billingAddress: billingAddressJson,
              completedAt: newOrder.completedAt ? new Date(newOrder.completedAt) : null,
              updatedAt: new Date(),
            },
            create: {
              id: targetId,
              orderNumber: newOrder.orderNumber,
              userId: validUserId,
              status: dbStatus,
              paymentStatus: dbPaymentStatus,
              paymentMethod: dbPaymentMethod,
              paymentReference: newOrder.paymentReference ?? null,
              paypalOrderId: newOrder.paypalOrderId ?? null,
              subtotal: newOrder.subtotal,
              tax: newOrder.tax,
              shipping: newOrder.shipping,
              total: newOrder.total,
              currency: newOrder.currency ?? "USD",
              customerEmail: newOrder.customerEmail ?? "",
              customerName: newOrder.customerName ?? "",
              shippingAddress: shippingAddressJson,
              billingAddress: billingAddressJson,
              completedAt: newOrder.completedAt ? new Date(newOrder.completedAt) : null,
              createdAt: newOrder.createdAt ? new Date(newOrder.createdAt) : new Date(),
              updatedAt: newOrder.updatedAt ? new Date(newOrder.updatedAt) : new Date(),
            },
          })

          // Upsert items (only if the product and variant exist in DB to satisfy foreign keys)
          for (const it of newOrder.items || []) {
            const variantExists = await prisma.productVariant
              .findUnique({ where: { id: it.variantId } })
              .catch(() => null)
            if (!variantExists) continue

            const itemId = it.id || `item_${targetId}_${it.variantId}`
            const itemImageJson = toJson(it.image)
            await prisma.orderItem.upsert({
              where: { id: itemId },
              update: {
                orderId: targetId,
                productId: it.productId,
                variantId: it.variantId,
                name: it.name,
                variantName: it.variantName || "",
                sku: it.sku || "",
                image: itemImageJson,
                price: it.price,
                quantity: it.quantity,
                total: it.total,
              },
              create: {
                id: itemId,
                orderId: targetId,
                productId: it.productId,
                variantId: it.variantId,
                name: it.name,
                variantName: it.variantName || "",
                sku: it.sku || "",
                image: itemImageJson,
                price: it.price,
                quantity: it.quantity,
                total: it.total,
              },
            }).catch(() => {})
          }
        } catch (dbErr) {
          console.warn("Could not sync order to Neon DB:", dbErr)
        }
      }

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

