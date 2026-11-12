import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { syncBillingAndInvoices, getHsnCodeForProduct } from "@/lib/db/sync-billing"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim().toLowerCase()
    const status = searchParams.get("status")

    // Check count and sync if empty
    const count = await prisma.invoice.count()
    if (count === 0) {
      await syncBillingAndInvoices()
    }

    const where: Record<string, unknown> = {}
    if (status && status !== "ALL") {
      where.status = status
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { placeOfSupply: { contains: search, mode: "insensitive" } },
      ]
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    })

    // Compute financial aggregates
    let grossInvoiced = 0
    let totalTaxCollected = 0
    let totalCgst = 0
    let totalSgst = 0
    let totalIgst = 0
    let totalDiscountGiven = 0

    for (const inv of invoices) {
      grossInvoiced += inv.total
      totalTaxCollected += inv.cgstTotal + inv.sgstTotal + inv.igstTotal
      totalCgst += inv.cgstTotal
      totalSgst += inv.sgstTotal
      totalIgst += inv.igstTotal
      totalDiscountGiven += inv.discountTotal
    }

    return NextResponse.json({
      invoices,
      metrics: {
        grossInvoiced, // paise
        totalTaxCollected, // paise
        totalCgst,
        totalSgst,
        totalIgst,
        totalDiscountGiven,
        totalInvoices: invoices.length,
      },
    })
  } catch (error) {
    console.error("Failed to fetch invoices:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoices", details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, invoice: true },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.invoice) {
      return NextResponse.json({ invoice: order.invoice, message: "Invoice already exists" })
    }

    const shipping = typeof order.shippingAddress === "object" && order.shippingAddress !== null
      ? (order.shippingAddress as Record<string, unknown>)
      : {}
    const placeOfSupply = String(shipping.state || "Maharashtra")
    const isInterState = placeOfSupply.toLowerCase() !== "karnataka"

    const hsnMap: Record<string, {
      hsnCode: string
      categoryName: string
      rate: number
      taxableAmount: number
      cgstAmount: number
      sgstAmount: number
      igstAmount: number
    }> = {}

    let subtotalPaise = 0

    for (const item of order.items) {
      const itemTotalPaise = item.total || (item.price * item.quantity)
      subtotalPaise += itemTotalPaise

      const { hsnCode, rate, categoryName } = getHsnCodeForProduct(item.name)
      if (!hsnMap[hsnCode]) {
        hsnMap[hsnCode] = {
          hsnCode,
          categoryName,
          rate,
          taxableAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
        }
      }
      hsnMap[hsnCode].taxableAmount += itemTotalPaise
    }

    if (subtotalPaise === 0) {
      subtotalPaise = order.subtotal || order.total || 99900
    }

    let cgstTotal = 0
    let sgstTotal = 0
    let igstTotal = 0

    Object.values(hsnMap).forEach((hsn) => {
      if (isInterState) {
        hsn.igstAmount = Math.round((hsn.taxableAmount * hsn.rate) / 100)
        igstTotal += hsn.igstAmount
      } else {
        const halfRate = hsn.rate / 2
        hsn.cgstAmount = Math.round((hsn.taxableAmount * halfRate) / 100)
        hsn.sgstAmount = Math.round((hsn.taxableAmount * halfRate) / 100)
        cgstTotal += hsn.cgstAmount
        sgstTotal += hsn.sgstAmount
      }
    })

    const invoiceCount = await prisma.invoice.count()
    const invoiceNumber = `INV-2026-${1001 + invoiceCount}`
    const grandTotal = Math.max(0, subtotalPaise + cgstTotal + sgstTotal + igstTotal)

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerGstin: null,
        storeGstin: "29AABCU9603R1Z7",
        supplyState: "Karnataka",
        placeOfSupply,
        isInterState,
        hsnSummary: Object.values(hsnMap),
        subtotal: subtotalPaise,
        cgstTotal,
        sgstTotal,
        igstTotal,
        discountTotal: 0,
        total: grandTotal,
        currency: "INR",
        status: "PAID",
        digitalSignature: "Digitally Signed by PayPilot Technologies India Pvt Ltd (Authorized Signatory)",
        issuedAt: new Date(),
        paidAt: new Date(),
      },
    })

    return NextResponse.json({ invoice, success: true }, { status: 201 })
  } catch (error) {
    console.error("Failed to generate invoice:", error)
    return NextResponse.json(
      { error: "Failed to generate invoice", details: String(error) },
      { status: 500 }
    )
  }
}

