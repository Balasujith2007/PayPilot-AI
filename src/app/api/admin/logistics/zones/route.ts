import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncLogisticsData } from "@/lib/db/sync-logistics"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const state = searchParams.get("state")
    const isServiceable = searchParams.get("isServiceable")
    const search = searchParams.get("search")?.trim().toLowerCase()

    const count = await prisma.deliveryZone.count()
    if (count === 0) {
      await syncLogisticsData()
    }

    const where: Record<string, unknown> = {}
    if (state && state !== "ALL") {
      where.state = state
    }
    if (isServiceable !== null && isServiceable !== undefined && isServiceable !== "ALL") {
      where.isServiceable = isServiceable === "true"
    }
    if (search) {
      where.OR = [
        { pincode: { contains: search, mode: "insensitive" } },
        { areaName: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
      ]
    }

    const zones = await prisma.deliveryZone.findMany({
      where,
      orderBy: [{ state: "asc" }, { city: "asc" }],
    })

    const allZones = await prisma.deliveryZone.findMany()
    const serviceableCount = allZones.filter((z) => z.isServiceable).length
    const codCount = allZones.filter((z) => z.codAvailable && z.isServiceable).length
    const expressCount = allZones.filter((z) => z.expressAvailable && z.isServiceable).length

    return NextResponse.json({
      zones,
      metrics: {
        totalPincodes: allZones.length,
        serviceableCount,
        unserviceableCount: allZones.length - serviceableCount,
        codAvailableCount: codCount,
        expressAvailableCount: expressCount,
      },
    })
  } catch (error) {
    console.error("Failed to fetch delivery zones:", error)
    return NextResponse.json(
      { error: "Failed to fetch delivery zones", details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      pincode,
      areaName,
      city,
      state,
      zoneType = "TIER_1",
      isServiceable = true,
      codAvailable = true,
      expressAvailable = true,
      standardDays = 3,
      expressDays = 1,
      preferredPartner = "Blue Dart Express",
    } = body

    if (!pincode || !city || !state) {
      return NextResponse.json(
        { error: "pincode, city and state are required" },
        { status: 400 }
      )
    }

    const zone = await prisma.deliveryZone.upsert({
      where: { pincode },
      update: {
        areaName: areaName || city,
        city,
        state,
        zoneType,
        isServiceable,
        codAvailable,
        expressAvailable,
        standardDays,
        expressDays,
        preferredPartner,
      },
      create: {
        pincode,
        areaName: areaName || city,
        city,
        state,
        zoneType,
        isServiceable,
        codAvailable,
        expressAvailable,
        standardDays,
        expressDays,
        preferredPartner,
      },
    })

    return NextResponse.json({ zone, success: true }, { status: 201 })
  } catch (error) {
    console.error("Failed to save delivery zone:", error)
    return NextResponse.json(
      { error: "Failed to save delivery zone", details: String(error) },
      { status: 500 }
    )
  }
}

