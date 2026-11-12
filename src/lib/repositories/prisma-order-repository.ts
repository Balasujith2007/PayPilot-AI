import type {
  Order,
  OrderStatus,
  OrderRepository,
  PaginationParams,
  PaginatedResult,
} from "@/types"
import { prisma } from "@/lib/db/prisma"
import { jsonOrderRepository } from "./json-order-repository"
import { Prisma } from "@prisma/client"

// Helper to convert Prisma record to domain Order
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPrismaOrder(o: any): Order {
  const statusMap: Record<string, OrderStatus> = {
    PENDING: "pending",
    PROCESSING: "processing",
    SHIPPED: "shipped",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
    REFUNDED: "refunded",
  }

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    userId: o.userId || undefined,
    customerEmail: o.customerEmail,
    customerName: o.customerName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (o.items || []).map((it: any) => ({
      id: it.id,
      orderId: it.orderId,
      productId: it.productId,
      variantId: it.variantId,
      name: it.name,
      variantName: it.variantName,
      sku: it.sku,
      image: it.image || { url: "", alt: it.name },
      price: it.price,
      quantity: it.quantity,
      total: it.total,
    })),
    subtotal: o.subtotal,
    tax: o.tax,
    shipping: o.shipping,
    total: o.total,
    currency: o.currency || "INR",
    status: statusMap[o.status] || (o.status?.toLowerCase() as OrderStatus) || "pending",
    paymentStatus: o.paymentStatus?.toLowerCase() || "pending",
    paymentMethod: o.paymentMethod || undefined,
    shippingAddress: o.shippingAddress,
    billingAddress: o.billingAddress || undefined,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
    updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt),
    carrier: o.carrier || undefined,
    trackingNumber: o.trackingNumber || undefined,
  }
}

export class PrismaOrderRepository implements OrderRepository {
  async list(
    userId?: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Order>> {
    try {
      const page = Math.max(1, pagination?.page ?? 1)
      const limit = Math.max(1, Math.min(100, pagination?.limit ?? 10))
      const skip = (page - 1) * limit

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {}
      if (userId) {
        const target = userId.trim()
        where.OR = [
          { userId: target },
          { customerEmail: { equals: target, mode: "insensitive" } },
        ]
      }

      const [dbOrders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: { items: true },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.order.count({ where }),
      ])

      if (dbOrders.length > 0) {
        const items = dbOrders.map(mapPrismaOrder)
        const totalPages = Math.max(1, Math.ceil(total / limit))
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

      return await jsonOrderRepository.list(userId, pagination)
    } catch (e) {
      console.warn("Prisma order list failed, fallback to json:", e)
      return await jsonOrderRepository.list(userId, pagination)
    }
  }

  async getById(id: string): Promise<Order | null> {
    if (!id) return null
    try {
      const order = await prisma.order.findFirst({
        where: {
          OR: [{ id }, { orderNumber: id }],
        },
        include: { items: true },
      })

      if (order) {
        return mapPrismaOrder(order)
      }

      return await jsonOrderRepository.getById(id)
    } catch (e) {
      console.warn("Prisma order getById failed, fallback to json:", e)
      return await jsonOrderRepository.getById(id)
    }
  }

  async create(order: Order): Promise<Order> {
    // 1. Always save in json repository for local mirror
    try {
      await jsonOrderRepository.create(order)
    } catch (e) {
      console.warn("jsonOrderRepository.create failed:", e)
    }

    // 2. Persist in Neon PostgreSQL
    try {
      const statusUpper = (order.status || "pending").toUpperCase() as
        | "PENDING"
        | "PROCESSING"
        | "SHIPPED"
        | "DELIVERED"
        | "CANCELLED"
        | "REFUNDED"

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createData: any = {
        id: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId || null,
        status: statusUpper,
        paymentStatus: (order.paymentStatus || "pending").toUpperCase(),
        subtotal: order.subtotal,
        tax: order.tax,
        shipping: order.shipping,
        total: order.total,
        currency: order.currency || "INR",
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        shippingAddress: order.shippingAddress as unknown as Prisma.InputJsonValue,
        billingAddress: order.billingAddress
          ? (order.billingAddress as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        carrier: order.carrier || null,
        trackingNumber: order.trackingNumber || null,
        items: {
          create: order.items.map((it) => ({
            id: it.id,
            productId: it.productId,
            variantId: it.variantId,
            name: it.name,
            variantName: it.variantName,
            sku: it.sku,
            image: it.image as unknown as Prisma.InputJsonValue,
            price: it.price,
            quantity: it.quantity,
            total: it.total,
          })),
        },
      }

      const created = await prisma.order.create({
        data: createData,
        include: { items: true },
      })

      return mapPrismaOrder(created)
    } catch (e) {
      console.warn("Prisma order create failed, falling back to JSON:", e)
      return order
    }
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const updatedLocal = await jsonOrderRepository.updateStatus(id, status)

    try {
      const statusUpper = status.toUpperCase() as
        | "PENDING"
        | "PROCESSING"
        | "SHIPPED"
        | "DELIVERED"
        | "CANCELLED"
        | "REFUNDED"

      const updated = await prisma.order.update({
        where: { id },
        data: { status: statusUpper },
        include: { items: true },
      })

      return mapPrismaOrder(updated)
    } catch (e) {
      console.warn("Prisma order updateStatus failed, using local result:", e)
      return updatedLocal
    }
  }
}

export const prismaOrderRepository = new PrismaOrderRepository()
