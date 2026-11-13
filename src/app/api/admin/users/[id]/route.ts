import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { role, firstName, lastName } = body

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(role && { role: role === "ADMIN" ? "ADMIN" : "CUSTOMER" }),
        ...(firstName && { firstName }),
        ...(lastName !== undefined && { lastName }),
      },
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (error) {
    console.error("Failed to update user:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update user in database" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "User deleted" })
  } catch (error) {
    console.error("Failed to delete user:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete user" },
      { status: 500 }
    )
  }
}

