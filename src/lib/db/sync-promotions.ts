import { prisma } from "@/lib/db/prisma"

export async function syncPromotionsData() {
  try {
    // 1. Seed or Sync Flash Sales
    const flashCount = await prisma.flashSale.count()
    if (flashCount === 0) {
      const defaultFlashSales = [
        {
          title: "Diwali Festive Mega Flash Sale",
          slug: "diwali-festive-mega-sale",
          description: "Exclusive festive storewide discount of 25% across all apparel, accessories, and electronics.",
          discountType: "percentage",
          discountValue: 25,
          appliesTo: "STOREWIDE",
          targetCategorySlug: null,
          targetBrandSlug: null,
          bannerBadge: "DIWALI SPECIAL",
          bannerHeadline: "Diwali Festive Flash Sale: 25% OFF Storewide",
          accentColor: "#E11D48", // rose/red
          startsAt: new Date(Date.now() - 24 * 3600 * 1000), // started yesterday
          endsAt: new Date(Date.now() + 6 * 24 * 3600 * 1000), // ends in 6 days
          isActive: true,
        },
        {
          title: "Audio & Acoustics Rush Hour",
          slug: "audio-acoustics-rush-hour",
          description: "Flat 20% discount on all premium headphones, earbuds, and audio gear.",
          discountType: "percentage",
          discountValue: 20,
          appliesTo: "CATEGORY",
          targetCategorySlug: "electronics",
          targetBrandSlug: null,
          bannerBadge: "TECH FRENZY",
          bannerHeadline: "Premium Sound Flash Sale: 20% OFF Audio",
          accentColor: "#2563EB", // blue
          startsAt: new Date(Date.now() - 12 * 3600 * 1000),
          endsAt: new Date(Date.now() + 3 * 24 * 3600 * 1000),
          isActive: true,
        },
      ]

      for (const fs of defaultFlashSales) {
        await prisma.flashSale.upsert({
          where: { slug: fs.slug },
          update: fs,
          create: fs,
        })
      }
    }

    // 2. Seed or Sync Promotional Announcement Banners
    const bannerCount = await prisma.promotionalBanner.count()
    if (bannerCount === 0) {
      const defaultBanners = [
        {
          title: "Festive Flash Sale Live",
          message: "Diwali Special: Flat 25% OFF Storewide + Extra ₹500 OFF with code DIWALI2026",
          promoCode: "DIWALI2026",
          linkText: "Shop Festive Sale",
          linkUrl: "/shop",
          badgeText: "LIMITED TIME",
          backgroundColor: "#000000",
          textColor: "#FFFFFF",
          isActive: true,
          priority: 1,
          startsAt: new Date(Date.now() - 24 * 3600 * 1000),
          endsAt: new Date(Date.now() + 6 * 24 * 3600 * 1000),
        },
      ]

      for (const b of defaultBanners) {
        await prisma.promotionalBanner.create({
          data: b,
        })
      }
    }

    // 3. Ensure Targeted Coupons Exist
    const coupons = [
      {
        code: "DIWALI2026",
        title: "Diwali Festival Mega Voucher",
        description: "Flat ₹500 OFF on festive orders above ₹1,999",
        discountType: "fixed",
        discountValue: 50000, // ₹500
        minOrderValue: 199900, // ₹1,999
        maxDiscountAmount: null,
        firstPurchaseOnly: false,
        targetScenario: "FESTIVAL_SPECIAL",
        targetCategorySlug: null,
        targetBrandSlug: null,
        isActive: true,
        usageLimit: 2000,
        expiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      },
      {
        code: "TECH20",
        title: "Electronics Category Boost",
        description: "20% OFF on all electronics and audio up to ₹1,500",
        discountType: "percentage",
        discountValue: 20,
        minOrderValue: 99900, // ₹999
        maxDiscountAmount: 150000, // Max ₹1,500
        firstPurchaseOnly: false,
        targetScenario: "CATEGORY_SPECIFIC",
        targetCategorySlug: "electronics",
        targetBrandSlug: null,
        isActive: true,
        usageLimit: 500,
        expiresAt: new Date(Date.now() + 15 * 24 * 3600 * 1000),
      },
      {
        code: "FIRST500",
        title: "New Customer Welcome Voucher",
        description: "Flat ₹500 OFF on your first purchase above ₹999",
        discountType: "fixed",
        discountValue: 50000,
        minOrderValue: 99900,
        maxDiscountAmount: null,
        firstPurchaseOnly: true,
        targetScenario: "FIRST_PURCHASE",
        targetCategorySlug: null,
        targetBrandSlug: null,
        isActive: true,
        usageLimit: 5000,
      },
      {
        code: "PAYPILOT10",
        title: "Storewide 10% Discount",
        description: "10% OFF on any order across the entire catalog",
        discountType: "percentage",
        discountValue: 10,
        minOrderValue: 49900,
        maxDiscountAmount: 100000,
        firstPurchaseOnly: false,
        targetScenario: "GENERAL",
        targetCategorySlug: null,
        targetBrandSlug: null,
        isActive: true,
        usageLimit: 10000,
      },
    ]

    for (const c of coupons) {
      await prisma.coupon.upsert({
        where: { code: c.code },
        update: c,
        create: c,
      })
    }

    return { success: true }
  } catch (error) {
    console.error("Failed to sync promotions data:", error)
    return { success: false, error: String(error) }
  }
}

