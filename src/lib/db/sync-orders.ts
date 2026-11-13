import { prisma } from "@/lib/db/prisma"
import type { Prisma, OrderStatus, PaymentStatus, PaymentMethod } from "@prisma/client"

export async function syncOrdersToDatabase() {
  try {
    const existingCount = await prisma.order.count()
    if (existingCount >= 10) {
      return { success: true, count: existingCount, message: "Orders already populated" }
    }

    // Fetch existing catalog products to attach genuine items
    const products = await prisma.product.findMany({
      include: { variants: true },
      take: 12,
    })

    if (products.length === 0) {
      return { success: false, error: "No products in database to create orders for" }
    }

    // Ensure demo customers exist in database
    let adminUser = await prisma.user.findUnique({ where: { email: "admin@example.com" } })
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          id: "user-admin-1",
          email: "admin@example.com",
          firstName: "Admin",
          lastName: "User",
          role: "ADMIN",
        },
      })
    }

    let customerUser = await prisma.user.findUnique({ where: { email: "demo@example.com" } })
    if (!customerUser) {
      customerUser = await prisma.user.create({
        data: {
          id: "user-customer-1",
          email: "demo@example.com",
          firstName: "Jane",
          lastName: "Smith",
          role: "CUSTOMER",
        },
      })
    }

    const indianCustomers = [
      { name: "Aarav Sharma", email: "aarav.sharma@gmail.com", city: "Mumbai", state: "Maharashtra", pincode: "400001", addr: "42 Marine Drive, Nariman Point" },
      { name: "Priya Nair", email: "priya.nair@outlook.com", city: "Bengaluru", state: "Karnataka", pincode: "560001", addr: "108 Brigade Road, Ashok Nagar" },
      { name: "Rohan Verma", email: "rohan.v@yahoo.co.in", city: "New Delhi", state: "Delhi", pincode: "110001", addr: "15 Connaught Place, Inner Circle" },
      { name: "Ananya Iyer", email: "ananya.iyer@gmail.com", city: "Chennai", state: "Tamil Nadu", pincode: "600002", addr: "88 Anna Salai, Thousand Lights" },
      { name: "Vikram Malhotra", email: "vikram.m@rediffmail.com", city: "Hyderabad", state: "Telangana", pincode: "500081", addr: "24 HITECH City Main Rd, Madhapur" },
      { name: "Neha Kulkarni", email: "neha.kulkarni@gmail.com", city: "Pune", state: "Maharashtra", pincode: "411004", addr: "73 FC Road, Shivajinagar" },
      { name: "Aditya Sen", email: "aditya.sen@gmail.com", city: "Kolkata", state: "West Bengal", pincode: "700016", addr: "12 Park Street, Camac St Area" },
      { name: "Kavita Reddy", email: "kavita.reddy@gmail.com", city: "Bengaluru", state: "Karnataka", pincode: "560034", addr: "55 100 Feet Rd, Koramangala 4th Block" },
      { name: "Jane Smith", email: "demo@example.com", city: "Bengaluru", state: "Karnataka", pincode: "560038", addr: "12 Indira Nagar 100ft Road" },
      { name: "Siddharth Jain", email: "sid.jain@gmail.com", city: "Ahmedabad", state: "Gujarat", pincode: "380015", addr: "301 SG Highway, Bodakdev" },
      { name: "Pooja Mehta", email: "pooja.mehta@gmail.com", city: "Mumbai", state: "Maharashtra", pincode: "400050", addr: "19 Hill Road, Bandra West" },
      { name: "Manish Tiwari", email: "manish.t@gmail.com", city: "Lucknow", state: "Uttar Pradesh", pincode: "226001", addr: "14 Hazratganj Market" },
      { name: "Divya Chawla", email: "divya.chawla@gmail.com", city: "Gurugram", state: "Haryana", pincode: "122002", addr: "804 DLF Cyber City, Phase 2" },
      { name: "Rajesh Kannan", email: "rajesh.k@gmail.com", city: "Coimbatore", state: "Tamil Nadu", pincode: "641002", addr: "22 DB Road, RS Puram" },
      { name: "Balaganesh", email: "balaganesh@paypilot-ai.com", city: "Bengaluru", state: "Karnataka", pincode: "560025", addr: "77 Richmond Road" },
    ]

    const carriers = [
      { name: "Blue Dart Express", prefix: "BLUEDART-" },
      { name: "Delhivery Logistics", prefix: "DELHIVERY-" },
      { name: "Shadowfax Prime", prefix: "SHADOW-" },
      { name: "DTDC Air", prefix: "DTDC-" },
    ]

    const statuses: OrderStatus[] = [
      "DELIVERED",
      "DELIVERED",
      "DELIVERED",
      "SHIPPED",
      "SHIPPED",
      "PROCESSING",
      "PROCESSING",
      "PENDING",
      "CANCELLED",
      "DELIVERED",
    ]

    const paymentMethods: { method: PaymentMethod; label: string; mode: string }[] = [
      { method: "WALLET", label: "UPI (PhonePe, GPay, Paytm)", mode: "UPI" },
      { method: "WALLET", label: "UPI (PhonePe, GPay, Paytm)", mode: "UPI" },
      { method: "WALLET", label: "UPI (PhonePe, GPay, Paytm)", mode: "UPI" },
      { method: "CARD", label: "Credit & Debit Cards (Visa, MC, RuPay)", mode: "CARD" },
      { method: "CARD", label: "Credit & Debit Cards (Visa, MC, RuPay)", mode: "CARD" },
      { method: "BANK_TRANSFER", label: "Net Banking (SBI, HDFC, ICICI)", mode: "NETBANKING" },
      { method: "OTHER", label: "Cash on Delivery (COD)", mode: "COD" },
    ]

    const couponCodes = ["DIWALI2026", "FIRST500", "TECH20", "PAYPILOT10", null, null]

    let inserted = 0
    const now = Date.now()

    // Generate 24 diverse, realistic orders across the past 28 days
    for (let i = 0; i < 24; i++) {
      const cust = indianCustomers[i % indianCustomers.length]
      const carrier = carriers[i % carriers.length]
      const status = statuses[i % statuses.length]
      const payInfo = paymentMethods[i % paymentMethods.length]
      const couponCode = couponCodes[i % couponCodes.length]

      // Time offset: from 28 days ago up to today
      const daysAgo = Math.max(0, Math.floor((23 - i) * 1.15))
      const hoursAgo = (i * 3) % 24
      const orderDate = new Date(now - (daysAgo * 24 + hoursAgo) * 3600 * 1000)

      // Select 1 to 3 items from products catalog
      const p1 = products[i % products.length]
      const p2 = products[(i + 3) % products.length]
      const numItems = (i % 3 === 0) ? 2 : 1
      const orderProducts = numItems === 2 ? [p1, p2] : [p1]

      let subtotal = 0
      const itemsData = orderProducts.map((prod, idx) => {
        const variant = prod.variants?.[0]
        const unitPrice = variant?.price || 249900 // in paise
        const qty = (i % 5 === 0 && idx === 0) ? 2 : 1
        const lineTotal = unitPrice * qty
        subtotal += lineTotal

        const imgList = Array.isArray(prod.images) ? (prod.images as Array<{ url?: string }>) : []
        const imgUrl = imgList[0]?.url || "/images/products/placeholder.svg"

        return {
          id: `item-${Date.now()}-${i}-${idx}`,
          productId: prod.id,
          variantId: variant?.id || `var-${prod.id}-1`,
          name: prod.name,
          variantName: variant?.name || "Standard",
          sku: variant?.sku || `SKU-${prod.id.slice(-4).toUpperCase()}`,
          image: { url: imgUrl, alt: prod.name },
          price: unitPrice,
          quantity: qty,
          total: lineTotal,
        }
      })

      // Discount calculation
      let discountAmount = 0
      if (couponCode === "DIWALI2026" && subtotal >= 199900) {
        discountAmount = 50000 // ₹500
      } else if (couponCode === "FIRST500" && subtotal >= 99900) {
        discountAmount = 50000 // ₹500
      } else if (couponCode === "TECH20") {
        discountAmount = Math.min(150000, Math.round(subtotal * 0.20))
      } else if (couponCode === "PAYPILOT10") {
        discountAmount = Math.min(100000, Math.round(subtotal * 0.10))
      }

      // Tax calculation (18% GST or 12%)
      const taxableSubtotal = Math.max(0, subtotal - discountAmount)
      const tax = Math.round(taxableSubtotal * 0.18)

      // Shipping charge (Free above ₹999 / 99900 paise, else ₹99)
      const shipping = taxableSubtotal >= 99900 ? 0 : 9900
      const total = taxableSubtotal + tax + shipping

      const paymentStatus: PaymentStatus =
        status === "CANCELLED"
          ? "REFUNDED"
          : status === "PENDING" && payInfo.mode === "COD"
          ? "PENDING"
          : "CAPTURED"

      const orderNumber = `PP-2026-${(1001 + i).toString()}`
      const orderId = `order-seed-${1001 + i}`

      const initialTimeline = [
        {
          id: `note-${orderId}-1`,
          author: "System Automated",
          text: `Order ${orderNumber} placed via ${payInfo.label}. Payment status: ${paymentStatus}.`,
          createdAt: orderDate.toISOString(),
          type: "system",
        },
        {
          id: `note-${orderId}-2`,
          author: "Balaganesh (Admin)",
          text: `Package verified and assigned to ${carrier.name} (AWB: ${carrier.prefix}984712${10 + i}).`,
          createdAt: new Date(orderDate.getTime() + 2 * 3600 * 1000).toISOString(),
          type: "staff",
        },
      ]

      const billingWithMeta = {
        firstName: cust.name.split(" ")[0],
        lastName: cust.name.split(" ")[1] || "",
        line1: cust.addr,
        city: cust.city,
        state: cust.state,
        postalCode: cust.pincode,
        country: "India",
        appliedCoupon: couponCode,
        discountAmount,
        paymentMode: payInfo.mode,
        paymentLabel: payInfo.label,
        _audit: {
          notes: initialTimeline,
          granularStatus: status.toLowerCase(),
          refundStatus: status === "CANCELLED" ? "SETTLED" : "NONE",
          returnReason: status === "CANCELLED" ? "Customer cancelled before dispatch" : null,
        },
      }

      const existingOrder = await prisma.order.findUnique({ where: { id: orderId } })
      if (!existingOrder) {
        await prisma.order.create({
          data: {
            id: orderId,
            orderNumber,
            userId: cust.email === "demo@example.com" ? customerUser.id : null,
            status,
            paymentStatus,
            paymentMethod: payInfo.method,
            paymentReference: `PAY-${payInfo.mode}-${Date.now().toString().slice(-6)}-${i}`,
            subtotal,
            tax,
            shipping,
            total,
            currency: "INR",
            customerEmail: cust.email,
            customerName: cust.name,
            shippingAddress: {
              firstName: cust.name.split(" ")[0],
              lastName: cust.name.split(" ")[1] || "",
              line1: cust.addr,
              city: cust.city,
              state: cust.state,
              postalCode: cust.pincode,
              country: "India",
            } as Prisma.InputJsonValue,
            billingAddress: billingWithMeta as Prisma.InputJsonValue,
            carrier: carrier.name,
            trackingNumber: `${carrier.prefix}984712${10 + i}`,
            completedAt: status === "DELIVERED" ? new Date(orderDate.getTime() + 48 * 3600 * 1000) : null,
            createdAt: orderDate,
            updatedAt: new Date(orderDate.getTime() + 4 * 3600 * 1000),
            items: {
              create: itemsData,
            },
          },
        })
        inserted++
      }
    }

    return {
      success: true,
      count: inserted,
      message: `Successfully seeded ${inserted} authentic orders in database`,
    }
  } catch (error) {
    console.error("syncOrdersToDatabase error:", error)
    return { success: false, error: String(error) }
  }
}
