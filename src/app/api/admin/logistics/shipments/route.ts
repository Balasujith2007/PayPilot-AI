import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncLogisticsData } from "@/lib/db/sync-logistics"
import type { ShipmentStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const radarStatus = searchParams.get("radarStatus")
    const carrier = searchParams.get("carrier")
    const search = searchParams.get("search")?.trim().toLowerCase()

    const [shipmentCount, partnerCount, zoneCount] = await Promise.all([
      prisma.shipment.count(),
      prisma.logisticsPartner.count(),
      prisma.deliveryZone.count(),
    ])
    if (shipmentCount === 0 || partnerCount === 0 || zoneCount === 0) {
      await syncLogisticsData()
    }

    const where: Record<string, unknown> = {}
    if (radarStatus && radarStatus !== "ALL") {
      where.radarStatus = radarStatus
    }
    if (carrier && carrier !== "ALL") {
      where.carrier = carrier
    }
    if (search) {
      where.OR = [
        { awbNumber: { contains: search, mode: "insensitive" } },
        { orderNumber: { contains: search, mode: "insensitive" } },
        { destinationCity: { contains: search, mode: "insensitive" } },
        { destinationPincode: { contains: search, mode: "insensitive" } },
      ]
    }

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Compute Radar KPIs
    let onScheduleCount = 0
    let delayedCount = 0
    let attemptedCount = 0
    let rtoCount = 0
    let deliveredCount = 0

    const allShipments = await prisma.shipment.findMany({
      select: { radarStatus: true },
    })

    for (const s of allShipments) {
      if (s.radarStatus === "ON_SCHEDULE") onScheduleCount++
      else if (s.radarStatus === "DELAYED") delayedCount++
      else if (s.radarStatus === "ATTEMPTED") attemptedCount++
      else if (s.radarStatus === "RTO") rtoCount++
      else if (s.radarStatus === "DELIVERED") deliveredCount++
    }

    return NextResponse.json({
      shipments,
      radar: {
        total: allShipments.length,
        inTransit: onScheduleCount + delayedCount + attemptedCount,
        onSchedule: onScheduleCount,
        delayed: delayedCount,
        attempted: attemptedCount,
        rto: rtoCount,
        delivered: deliveredCount,
      },
    })
  } catch (error) {
    console.error("Failed to fetch shipments:", error)
    return NextResponse.json(
      { error: "Failed to fetch shipments", details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      orderId,
      carrier,
      awbNumber,
      serviceType = "STANDARD",
      estimatedDays = 3,
    } = body

    if (!orderId || !carrier) {
      return NextResponse.json({ error: "orderId and carrier are required" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shipment: true },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const prefix = carrier.includes("Blue") ? "BD" : carrier.includes("Delhivery") ? "DLV" : carrier.includes("Shadowfax") ? "SFX" : "DTDC"
    const assignedAwb =
      awbNumber ||
      `${prefix}${new Date().getFullYear()}${order.orderNumber.replace(/[^0-9]/g, "").padStart(6, "0")}`

    const shipping = typeof order.shippingAddress === "object" && order.shippingAddress !== null
      ? (order.shippingAddress as Record<string, unknown>)
      : {}

    const edd = new Date(Date.now() + estimatedDays * 24 * 3600 * 1000)

    const checkpoints = [
      {
        status: "MANIFESTED",
        location: "Bengaluru Central Sort Center",
        timestamp: new Date().toISOString(),
        remarks: `Shipment allocated to ${carrier}. AWB: ${assignedAwb}`,
      },
    ]

    const shipment = await prisma.shipment.upsert({
      where: { orderId: order.id },
      update: {
        carrier,
        awbNumber: assignedAwb,
        serviceType,
        estimatedDeliveryDate: edd,
        status: "MANIFESTED",
        radarStatus: "ON_SCHEDULE",
      },
      create: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        carrier,
        awbNumber: assignedAwb,
        status: "MANIFESTED",
        radarStatus: "ON_SCHEDULE",
        originCity: "Bengaluru",
        destinationCity: String(shipping.city || "Mumbai"),
        destinationPincode: String(shipping.postalCode || "400001"),
        state: String(shipping.state || "Maharashtra"),
        weightGrams: 500,
        shippingCharge: order.total > 99900 ? 0 : 9900,
        serviceType,
        estimatedDeliveryDate: edd,
        lastCheckpoint: "Bengaluru Central Sort Center",
        checkpoints,
      },
    })

    // Synchronize to order as well
    await prisma.order.update({
      where: { id: order.id },
      data: {
        carrier,
        trackingNumber: assignedAwb,
        status: order.status === "PENDING" ? "PROCESSING" : order.status,
      },
    })

    return NextResponse.json({ shipment, success: true }, { status: 201 })
  } catch (error) {
    console.error("Failed to allocate courier shipment:", error)
    return NextResponse.json(
      { error: "Failed to allocate courier shipment", details: String(error) },
      { status: 500 }
    )
  }
}

