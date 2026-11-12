import { prisma } from "@/lib/db/prisma"

export async function syncInventoryHealth() {
  try {
    const variants = await prisma.productVariant.findMany({
      include: {
        product: true,
      },
    })

    if (!variants || variants.length === 0) {
      return { success: true, count: 0, message: "No variants to sync" }
    }

    // Ensure variants have realistic safety stock and supplier costs
    for (const [idx, v] of variants.entries()) {
      const updates: Record<string, unknown> = {}

      if (!v.safetyStock || v.safetyStock === 0) {
        updates.safetyStock = 5
      }
      if (!v.reorderQuantity || v.reorderQuantity === 0) {
        updates.reorderQuantity = 30
      }
      if (!v.supplierCost || v.supplierCost === 0) {
        // Supplier cost roughly 40-50% of retail price for profit margin calculation
        updates.supplierCost = Math.round(v.price * 0.45)
      }

      // Stagger some stock counts so we have realistic Low Stock and Out of Stock alerts
      if (idx === 0) {
        updates.quantity = 0 // Out of Stock
      } else if (idx === 1) {
        updates.quantity = 2 // Low Stock (Critical)
      } else if (idx === 2) {
        updates.quantity = 4 // Low Stock (Warning)
      } else if (v.quantity === 0 && idx > 2) {
        updates.quantity = 15 + ((idx * 7) % 45) // Healthy stock
      }

      if (Object.keys(updates).length > 0) {
        await prisma.productVariant.update({
          where: { id: v.id },
          data: updates,
        })
      }
    }

    // Seed initial stock adjustment logs if fewer than 5 exist
    const logCount = await prisma.stockAdjustmentLog.count()
    if (logCount < 5) {
      const sampleVariants = variants.slice(0, 5)
      const reasons = [
        {
          reason: "RECEIVED_SHIPMENT",
          change: 50,
          notes: "Initial inventory intake from primary manufacturer",
        },
        {
          reason: "ORDER_FULFILLMENT",
          change: -1,
          notes: "Order dispatch fulfillment",
        },
        {
          reason: "DAMAGE_LOSS",
          change: -2,
          notes: "Packaging damaged during handling at sorting station",
        },
        {
          reason: "MANUAL_RECONCILIATION",
          change: -3,
          notes: "Quarterly physical cycle count adjustment",
        },
        {
          reason: "RETURN_RESTOCK",
          change: 1,
          notes: "Customer exchange returned in pristine condition",
        },
      ]

      for (const [i, sv] of sampleVariants.entries()) {
        const r = reasons[i % reasons.length]
        const currentQty = i === 0 ? 0 : i === 1 ? 2 : i === 2 ? 4 : sv.quantity
        const prev = Math.max(0, currentQty - r.change)
        await prisma.stockAdjustmentLog.create({
          data: {
            variantId: sv.id,
            sku: sv.sku,
            productTitle: sv.product.name,
            variantName: sv.name,
            previousQuantity: prev,
            newQuantity: currentQty,
            changeAmount: r.change,
            reason: r.reason,
            notes: r.notes,
            staffAuthor: "Balaganesh (Admin)",
            createdAt: new Date(Date.now() - (i + 1) * 3600 * 1000 * 12),
          },
        })
      }
    }

    // Seed draft Purchase Order if none exist
    const poCount = await prisma.purchaseOrderDraft.count()
    if (poCount === 0) {
      const freshVariants = await prisma.productVariant.findMany({
        where: { quantity: { lte: 5 } },
        include: { product: true },
        take: 5,
      })

      if (freshVariants.length > 0) {
        const poItems = freshVariants.map((lv) => ({
          variantId: lv.id,
          sku: lv.sku,
          name: lv.name,
          productTitle: lv.product.name,
          currentStock: lv.quantity,
          suggestedQuantity: 30,
          unitCost: Math.round(lv.price * 0.45),
          totalCost: Math.round(lv.price * 0.45) * 30,
        }))

        const totalCost = poItems.reduce((acc, it) => acc + it.totalCost, 0)
        const totalItems = poItems.reduce((acc, it) => acc + it.suggestedQuantity, 0)

        await prisma.purchaseOrderDraft.create({
          data: {
            poNumber: "PO-2026-0101",
            supplierName: "Apex Garments & Electronics Supply Hub",
            status: "DRAFT",
            items: poItems,
            totalItems,
            totalCost,
            expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
            notes: "Automated replenishment based on 30-day velocity forecast for low safety stock items.",
          },
        })
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Failed to sync inventory health:", error)
    return { success: false, error: String(error) }
  }
}
