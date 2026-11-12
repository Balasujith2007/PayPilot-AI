import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      isServiceable,
      codAvailable,
      expressAvailable,
      preferredPartner,
      standardDays,
      expressDays,
    } = body

    const zone = await prisma.deliveryZone.update({
      where: { id },
      data: {
        ...(isServiceable !== undefined && { isServiceable }),
        ...(codAvailable !== undefined && { codAvailable }),
        ...(expressAvailable !== undefined && { expressAvailable }),
        ...(preferredPartner !== undefined && { preferredPartner }),
        ...(standardDays !== undefined && { standardDays }),
        ...(expressDays !== undefined && { expressDays }),
      },
    })

    return NextResponse.json({ zone, success: true })
  } catch (error) {
    console.error("Failed to update delivery zone:", error)
    return NextResponse.json(
      { error: "Failed to update delivery zone", details: String(error) },
      { status: 500 }
    )
  }
}

