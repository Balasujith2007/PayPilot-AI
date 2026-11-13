import { prisma } from "@/lib/db/prisma"

export async function syncLogisticsData() {
  try {
    // 1. Seed or Sync Logistics Partners
    const partnerCount = await prisma.logisticsPartner.count()
    if (partnerCount === 0) {
      const defaultPartners = [
        {
          name: "Blue Dart Express",
          code: "BLUEDART",
          trackingUrlTemplate: "https://www.bluedart.com/tracking?awb=",
          activeShipments: 14,
          deliveredShipments: 842,
          successRate: 99.2,
          avgDeliveryDays: 2.1,
          rating: 4.9,
          isActive: true,
        },
        {
          name: "Delhivery Logistics",
          code: "DELHIVERY",
          trackingUrlTemplate: "https://www.delhivery.com/track/package/",
          activeShipments: 22,
          deliveredShipments: 1240,
          successRate: 98.4,
          avgDeliveryDays: 2.5,
          rating: 4.8,
          isActive: true,
        },
        {
          name: "Shadowfax Express",
          code: "SHADOWFAX",
          trackingUrlTemplate: "https://tracker.shadowfax.in/#/track?order_id=",
          activeShipments: 8,
          deliveredShipments: 410,
          successRate: 97.8,
          avgDeliveryDays: 1.8,
          rating: 4.7,
          isActive: true,
        },
        {
          name: "DTDC Express",
          code: "DTDC",
          trackingUrlTemplate: "https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCNNo=",
          activeShipments: 6,
          deliveredShipments: 320,
          successRate: 96.5,
          avgDeliveryDays: 3.2,
          rating: 4.6,
          isActive: true,
        },
        {
          name: "India Post Speed Post",
          code: "INDIAPOST",
          trackingUrlTemplate: "https://www.indiapost.gov.in/_layouts/15/dpt.cpt.tracking/trackconsignment.aspx?consId=",
          activeShipments: 3,
          deliveredShipments: 215,
          successRate: 95.1,
          avgDeliveryDays: 4.2,
          rating: 4.4,
          isActive: true,
        },
      ]

      for (const p of defaultPartners) {
        await prisma.logisticsPartner.upsert({
          where: { code: p.code },
          update: p,
          create: p,
        })
      }
    }

    // 2. Seed or Sync Shipping Rules
    const ruleCount = await prisma.shippingRule.count()
    if (ruleCount === 0) {
      const defaultRules = [
        {
          name: "Standard Ground & Air Delivery",
          code: "STANDARD",
          description: "Free delivery on all orders above ₹999; ₹99 flat fee otherwise.",
          baseFee: 9900, // ₹99
          freeThreshold: 99900, // ₹999
          estimatedDaysMin: 3,
          estimatedDaysMax: 5,
          isActive: true,
        },
        {
          name: "Express Air Priority",
          code: "EXPRESS",
          description: "Guaranteed express air courier with top-priority sorting and dispatch.",
          baseFee: 19900, // ₹199
          freeThreshold: null,
          estimatedDaysMin: 1,
          estimatedDaysMax: 2,
          isActive: true,
        },
        {
          name: "Metro Same-Day Rush",
          code: "SAME_DAY",
          description: "Same-day doorstep delivery within 12 hours across eligible metro clusters.",
          baseFee: 29900, // ₹299
          freeThreshold: null,
          estimatedDaysMin: 0,
          estimatedDaysMax: 1,
          isActive: true,
        },
      ]

      for (const r of defaultRules) {
        await prisma.shippingRule.upsert({
          where: { code: r.code },
          update: r,
          create: r,
        })
      }
    }

    // 3. Seed or Sync Delivery Zones & Pincodes
    const zoneCount = await prisma.deliveryZone.count()
    if (zoneCount === 0) {
      const defaultZones = [
        {
          pincode: "560001",
          areaName: "MG Road / Brigade Road",
          city: "Bengaluru",
          state: "Karnataka",
          zoneType: "METRO",
          isServiceable: true,
          codAvailable: true,
          expressAvailable: true,
          standardDays: 2,
          expressDays: 1,
          preferredPartner: "Blue Dart Express",
        },
        {
          pincode: "560103",
          areaName: "Bellandur / Outer Ring Road",
          city: "Bengaluru",
          state: "Karnataka",
          zoneType: "METRO",
          isServiceable: true,
          codAvailable: true,
          expressAvailable: true,
          standardDays: 2,
          expressDays: 1,
          preferredPartner: "Shadowfax Express",
        },
        {
          pincode: "400001",
          areaName: "Fort / South Mumbai",
          city: "Mumbai",
          state: "Maharashtra",
          zoneType: "METRO",
          isServiceable: true,
          codAvailable: true,
          expressAvailable: true,
          standardDays: 3,
          expressDays: 1,
          preferredPartner: "Blue Dart Express",
        },
        {
          pincode: "400050",
          areaName: "Bandra West",
          city: "Mumbai",
          state: "Maharashtra",
          zoneType: "METRO",
          isServiceable: true,
          codAvailable: true,
          expressAvailable: true,
          standardDays: 3,
          expressDays: 1,
          preferredPartner: "Delhivery Logistics",
        },
        {
          pincode: "110001",
          areaName: "Connaught Place",
          city: "New Delhi",
          state: "Delhi",
          zoneType: "METRO",
          isServiceable: true,
          codAvailable: true,
          expressAvailable: true,
          standardDays: 3,
          expressDays: 1,
          preferredPartner: "Blue Dart Express",
        },
        {
          pincode: "600001",
          areaName: "George Town / Parry's",
          city: "Chennai",
          state: "Tamil Nadu",
          zoneType: "METRO",
          isServiceable: true,
          codAvailable: true,
          expressAvailable: true,
          standardDays: 3,
          expressDays: 1,
          preferredPartner: "Delhivery Logistics",
        },
        {
          pincode: "500001",
          areaName: "Abids / Koti",
          city: "Hyderabad",
          state: "Telangana",
          zoneType: "METRO",
          isServiceable: true,
          codAvailable: true,
          expressAvailable: true,
          standardDays: 3,
          expressDays: 1,
          preferredPartner: "Blue Dart Express",
        },
        {
          pincode: "700001",
          areaName: "BBD Bagh / Dalhousie",
          city: "Kolkata",
          state: "West Bengal",
          zoneType: "METRO",
          isServiceable: true,
          codAvailable: true,
          expressAvailable: true,
          standardDays: 4,
          expressDays: 2,
          preferredPartner: "DTDC Express",
        },
        {
          pincode: "411001",
          areaName: "Pune Station / Camp",
          city: "Pune",
          state: "Maharashtra",
          zoneType: "TIER_1",
          isServiceable: true,
          codAvailable: true,
          expressAvailable: true,
          standardDays: 3,
          expressDays: 1,
          preferredPartner: "Delhivery Logistics",
        },
        {
          pincode: "682001",
          areaName: "Fort Kochi / Mattancherry",
          city: "Kochi",
          state: "Kerala",
          zoneType: "TIER_2",
          isServiceable: true,
          codAvailable: true,
          expressAvailable: false,
          standardDays: 4,
          expressDays: 2,
          preferredPartner: "DTDC Express",
        },
        {
          pincode: "190001",
          areaName: "Lal Chowk",
          city: "Srinagar",
          state: "Jammu & Kashmir",
          zoneType: "REMOTE",
          isServiceable: true,
          codAvailable: false,
          expressAvailable: false,
          standardDays: 6,
          expressDays: 4,
          preferredPartner: "India Post Speed Post",
        },
        {
          pincode: "795001",
          areaName: "Imphal West",
          city: "Imphal",
          state: "Manipur",
          zoneType: "REMOTE",
          isServiceable: false,
          codAvailable: false,
          expressAvailable: false,
          standardDays: 7,
          expressDays: 5,
          preferredPartner: "India Post Speed Post",
        },
      ]

      for (const z of defaultZones) {
        await prisma.deliveryZone.upsert({
          where: { pincode: z.pincode },
          update: z,
          create: z,
        })
      }
    }

    // 4. Sync Shipments for DB Orders
    const orders = await prisma.order.findMany({
      include: {
        shipment: true,
        items: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const partnerNames = [
      "Blue Dart Express",
      "Delhivery Logistics",
      "Shadowfax Express",
      "DTDC Express",
    ]

    for (const [idx, order] of orders.entries()) {
      if (!order.shipment) {
        const carrier =
          order.carrier ||
          partnerNames[idx % partnerNames.length]

        const prefix = carrier.includes("Blue") ? "BD" : carrier.includes("Delhivery") ? "DLV" : carrier.includes("Shadowfax") ? "SFX" : "DTDC"
        const awbNumber = order.trackingNumber || `${prefix}${new Date(order.createdAt).getFullYear()}${order.orderNumber.replace(/[^0-9]/g, "").padStart(6, "0")}`

        // Shipping destination details from order shipping address
        const shipping = typeof order.shippingAddress === "object" && order.shippingAddress !== null
          ? (order.shippingAddress as Record<string, unknown>)
          : {}

        const destinationCity = String(shipping.city || "Mumbai")
        const destinationPincode = String(shipping.postalCode || "400001")
        const state = String(shipping.state || "Maharashtra")

        // Map lifecycle status to shipment status & radar status
        let shipmentStatus: "MANIFESTED" | "PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "ATTEMPTED_FAILED" | "RTO" | "DELAYED" = "IN_TRANSIT"
        let radarStatus = "ON_SCHEDULE"
        let delayReason: string | null = null

        if (order.status === "DELIVERED") {
          shipmentStatus = "DELIVERED"
          radarStatus = "DELIVERED"
        } else if (order.status === "REFUNDED" || order.status === "CANCELLED") {
          shipmentStatus = "RTO"
          radarStatus = "RTO"
          delayReason = "Customer cancellation / RTO initiated"
        } else if (order.status === "PENDING") {
          shipmentStatus = "MANIFESTED"
          radarStatus = "ON_SCHEDULE"
        } else if (idx === 1) {
          // One delayed shipment for realistic radar demonstration
          shipmentStatus = "DELAYED"
          radarStatus = "DELAYED"
          delayReason = "Heavy Rain / Highway NH-48 Transit Blockage"
        } else if (idx === 2) {
          // Attempted delivery
          shipmentStatus = "ATTEMPTED_FAILED"
          radarStatus = "ATTEMPTED"
          delayReason = "Consignee premises closed at time of attempt"
        } else {
          shipmentStatus = "IN_TRANSIT"
          radarStatus = "ON_SCHEDULE"
        }

        // Estimated delivery date: 3 days from created date
        const edd = new Date(new Date(order.createdAt).getTime() + 3 * 24 * 3600 * 1000)
        const actualDeliveryDate = order.status === "DELIVERED" ? new Date(new Date(order.createdAt).getTime() + 2 * 24 * 3600 * 1000) : null

        // Checkpoints array
        const checkpoints = [
          {
            status: "MANIFESTED",
            location: "Bengaluru Central Sort Center",
            timestamp: new Date(order.createdAt).toISOString(),
            remarks: "Shipping label printed and manifested by staff",
          },
          {
            status: "PICKED_UP",
            location: "Bengaluru Hub",
            timestamp: new Date(new Date(order.createdAt).getTime() + 4 * 3600 * 1000).toISOString(),
            remarks: `Handed over to ${carrier} pickup fleet`,
          },
        ]

        if (shipmentStatus !== "MANIFESTED") {
          checkpoints.push({
            status: "IN_TRANSIT",
            location: "En-route Hub (Pune Distribution Center)",
            timestamp: new Date(new Date(order.createdAt).getTime() + 18 * 3600 * 1000).toISOString(),
            remarks: "Departed sorting facility in sealed container",
          })
        }

        if (shipmentStatus === "DELIVERED") {
          checkpoints.push({
            status: "DELIVERED",
            location: `${destinationCity} Delivery Hub`,
            timestamp: edd.toISOString(),
            remarks: "Delivered to consignee and signed",
          })
        } else if (shipmentStatus === "DELAYED") {
          checkpoints.push({
            status: "DELAYED",
            location: "Kohlapur Transit Bypass",
            timestamp: new Date().toISOString(),
            remarks: "Severe Rain / Highway NH-48 Transit Blockage. Delayed by 24h.",
          })
        } else if (shipmentStatus === "ATTEMPTED_FAILED") {
          checkpoints.push({
            status: "ATTEMPTED_FAILED",
            location: `${destinationCity} Local Hub`,
            timestamp: new Date().toISOString(),
            remarks: "Attempted delivery; gate closed. Next attempt scheduled for tomorrow.",
          })
        }

        await prisma.shipment.create({
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            carrier,
            awbNumber,
            status: shipmentStatus,
            radarStatus,
            originCity: "Bengaluru",
            destinationCity,
            destinationPincode,
            state,
            weightGrams: 450 + (idx * 150),
            shippingCharge: order.total > 99900 ? 0 : 9900,
            serviceType: "STANDARD",
            estimatedDeliveryDate: edd,
            actualDeliveryDate,
            delayReason,
            lastCheckpoint: checkpoints[checkpoints.length - 1].location,
            checkpoints,
          },
        })
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Failed to sync logistics data:", error)
    return { success: false, error: String(error) }
  }
}

