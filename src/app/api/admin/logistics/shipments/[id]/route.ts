import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import type { ShipmentStatus } from "@prisma/client"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [{ id }, { awbNumber: id }, { orderId: id }],
      },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    })

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 })
    }

    return NextResponse.json({ shipment })
  } catch (error) {
    console.error("Failed to fetch shipment:", error)
    return NextResponse.json(
      { error: "Failed to fetch shipment", details: String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      status,
      radarStatus,
      delayReason,
      estimatedDeliveryDate,
      carrier,
      checkpointRemark,
      checkpointLocation,
    } = body

    const existing = await prisma.shipment.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 })
    }

    // Append new checkpoint if provided
    let updatedCheckpoints = (existing.checkpoints as Array<Record<string, unknown>>) || []
    if (checkpointLocation || checkpointRemark) {
      updatedCheckpoints = [
        ...updatedCheckpoints,
        {
          status: status || existing.status,
          location: checkpointLocation || existing.lastCheckpoint || "Transit Hub",
          timestamp: new Date().toISOString(),
          remarks: checkpointRemark || `Status updated to ${radarStatus || status}`,
        },
      ]
    }

    const shipment = await prisma.shipment.update({
      where: { id },
      data: {
        ...(status && { status: status as ShipmentStatus }),
        ...(radarStatus && { radarStatus }),
        ...(delayReason !== undefined && { delayReason }),
        ...(estimatedDeliveryDate && {
          estimatedDeliveryDate: new Date(estimatedDeliveryDate),
        }),
        ...(carrier && { carrier }),
        ...(checkpointLocation && { lastCheckpoint: checkpointLocation }),
        ...(updatedCheckpoints && { checkpoints: updatedCheckpoints }),
        ...(radarStatus === "DELIVERED" && { actualDeliveryDate: new Date() }),
      },
    })

    // If marked delivered or cancelled, sync back to order
    if (status === "DELIVERED" || radarStatus === "DELIVERED") {
      await prisma.order.update({
        where: { id: existing.orderId },
        data: { status: "DELIVERED", completedAt: new Date() },
      })
    } else if (radarStatus === "RTO" || status === "RTO") {
      await prisma.order.update({
        where: { id: existing.orderId },
        data: { status: "REFUNDED" },
      })
    }

    return NextResponse.json({ shipment, success: true })
  } catch (error) {
    console.error("Failed to update shipment:", error)
    return NextResponse.json(
      { error: "Failed to update shipment", details: String(error) },
      { status: 500 }
    )
  }
}

