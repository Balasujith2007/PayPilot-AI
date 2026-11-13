import { prisma } from "../src/lib/db/prisma"

const coupons = [
  {
    code: "FIRST500",
    title: "First Purchase Voucher",
    description: "₹500 flat discount for first-time shoppers on orders over ₹999",
    discountType: "fixed",
    discountValue: 50000, // ₹500
    minOrderValue: 99900, // ₹999
    firstPurchaseOnly: true,
    isActive: true,
  },
  {
    code: "PAYPILOT10",
    title: "Special 10% Off",
    description: "Get 10% discount on your entire order",
    discountType: "percentage",
    discountValue: 10,
    minOrderValue: 49900, // ₹499
    firstPurchaseOnly: false,
    isActive: true,
  },
  {
    code: "SAVE200",
    title: "₹200 Instant Saver",
    description: "₹200 discount on orders above ₹1,499",
    discountType: "fixed",
    discountValue: 20000, // ₹200
    minOrderValue: 149900, // ₹1,499
    firstPurchaseOnly: false,
    isActive: true,
  },
]

async function main() {
  console.log("Seeding coupons...")
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    })
    console.log(`✓ Seeded coupon ${c.code}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

