import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { invoiceNumber: id }, { orderId: id }],
      },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error("Failed to fetch invoice:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoice", details: String(error) },
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
    const { status, customerGstin } = body

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(customerGstin !== undefined && { customerGstin }),
      },
    })

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error("Failed to update invoice:", error)
    return NextResponse.json(
      { error: "Failed to update invoice", details: String(error) },
      { status: 500 }
    )
  }
}

