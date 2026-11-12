import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        addresses: true,
        orders: {
          select: {
            id: true,
            total: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const formattedUsers = users.map((u) => {
      const totalSpend = u.orders.reduce((sum, o) => sum + o.total, 0)
      return {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        addressCount: u.addresses.length,
        defaultAddress: u.addresses.find((a) => a.isDefault) || u.addresses[0] || null,
        orderCount: u.orders.length,
        totalSpend,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }
    })

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      total: formattedUsers.length,
    })
  } catch (error) {
    console.error("Failed to fetch users:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch users from database" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, firstName, lastName, role } = body

    if (!email || !firstName) {
      return NextResponse.json(
        { success: false, error: "Email and first name are required" },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: "User with this email already exists" },
        { status: 409 }
      )
    }

    const newUser = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        firstName,
        lastName: lastName || "",
        role: role === "ADMIN" ? "ADMIN" : "CUSTOMER",
      },
    })

    return NextResponse.json({ success: true, user: newUser })
  } catch (error) {
    console.error("Failed to create user:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create user in database" },
      { status: 500 }
    )
  }
}

