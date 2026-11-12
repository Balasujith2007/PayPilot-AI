import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole, AddressType, ProductStatus, OrderStatus, PaymentStatus, PaymentMethod } from "@prisma/client";

// Ensure .env.local is loaded
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const envFile = path.join(rootDir, ".env.local");

if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  }
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Neither DIRECT_URL nor DATABASE_URL is set in environment.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting idempotent database seed against Neon PostgreSQL...\n");

  // ---------------------------------------------------------------------------
  // 1. Seed Demo Users & Addresses
  // ---------------------------------------------------------------------------
  console.log("Seeding Users & Addresses...");
  await prisma.user.upsert({
    where: { id: "user-1" },
    update: {
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      role: UserRole.ADMIN,
    },
    create: {
      id: "user-1",
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      role: UserRole.ADMIN,
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
    },
  });

  const demoUser = await prisma.user.upsert({
    where: { id: "user-2" },
    update: {
      email: "demo@example.com",
      firstName: "Jane",
      lastName: "Smith",
      role: UserRole.CUSTOMER,
    },
    create: {
      id: "user-2",
      email: "demo@example.com",
      firstName: "Jane",
      lastName: "Smith",
      role: UserRole.CUSTOMER,
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
    },
  });

  await prisma.address.upsert({
    where: { id: "addr-demo-1" },
    update: {
      userId: demoUser.id,
      type: AddressType.SHIPPING,
      firstName: "Jane",
      lastName: "Smith",
      line1: "123 Main Street",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
      isDefault: true,
    },
    create: {
      id: "addr-demo-1",
      userId: demoUser.id,
      type: AddressType.SHIPPING,
      firstName: "Jane",
      lastName: "Smith",
      line1: "123 Main Street",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
      isDefault: true,
    },
  });
  console.log("  ✓ Seeded 2 users, 1 address");

  // ---------------------------------------------------------------------------
  // 2. Seed Brands from src/data/products.json
  // ---------------------------------------------------------------------------
  console.log("Seeding Brands...");
  const productsData = JSON.parse(
    fs.readFileSync(path.join(rootDir, "src", "data", "products.json"), "utf8")
  );

  for (const b of productsData.brands || []) {
    await prisma.brand.upsert({
      where: { id: b.id },
      update: {
        name: b.name,
        slug: b.slug,
        description: b.description,
      },
      create: {
        id: b.id,
        name: b.name,
        slug: b.slug,
        description: b.description,
      },
    });
  }
  console.log(`  ✓ Seeded ${productsData.brands?.length || 0} brands`);

  // ---------------------------------------------------------------------------
  // 3. Seed Categories (Hierarchy-aware)
  // ---------------------------------------------------------------------------
  console.log("Seeding Categories...");
  interface RawCategory {
    id: string;
    name: string;
    slug: string;
    description: string;
    image?: Record<string, unknown> | null;
    order?: number;
    parentId?: string | null;
  }

  const categories: RawCategory[] = productsData.categories || [];
  const topLevelCategories = categories.filter((c) => !c.parentId);
  const childCategories = categories.filter((c) => Boolean(c.parentId));

  for (const c of topLevelCategories) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: c.image ?? null,
        order: c.order ?? 0,
        parentId: null,
      },
      create: {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: c.image ?? null,
        order: c.order ?? 0,
        parentId: null,
      },
    });
  }

  for (const c of childCategories) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: c.image ?? null,
        order: c.order ?? 0,
        parentId: c.parentId,
      },
      create: {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: c.image ?? null,
        order: c.order ?? 0,
        parentId: c.parentId,
      },
    });
  }
  console.log(`  ✓ Seeded ${categories.length} categories`);

  // ---------------------------------------------------------------------------
  // 4. Seed Products & Variants & Categories Relations
  // ---------------------------------------------------------------------------
  console.log("Seeding Products and Variants...");
  let variantCount = 0;

  for (const p of productsData.products || []) {
    const statusMap: Record<string, ProductStatus> = {
      draft: ProductStatus.DRAFT,
      active: ProductStatus.ACTIVE,
      archived: ProductStatus.ARCHIVED,
    };
    const status = statusMap[p.status?.toLowerCase()] || ProductStatus.ACTIVE;

    const product = await prisma.product.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        body: p.body ?? null,
        images: p.images ?? [],
        status,
        brandId: p.brandId,
        tags: p.tags ?? [],
        rating: p.rating ?? 0,
        reviewCount: p.reviewCount ?? 0,
        featured: Boolean(p.featured),
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        categories: {
          set: (p.categoryIds || []).map((id: string) => ({ id })),
        },
      },
      create: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        body: p.body ?? null,
        images: p.images ?? [],
        status,
        brandId: p.brandId,
        tags: p.tags ?? [],
        rating: p.rating ?? 0,
        reviewCount: p.reviewCount ?? 0,
        featured: Boolean(p.featured),
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        categories: {
          connect: (p.categoryIds || []).map((id: string) => ({ id })),
        },
      },
    });

    for (const v of p.variants || []) {
      await prisma.productVariant.upsert({
        where: { id: v.id },
        update: {
          productId: product.id,
          sku: v.sku,
          name: v.name,
          price: v.price,
          compareAtPrice: v.compareAtPrice ?? null,
          currency: v.currency ?? "USD",
          quantity: v.inventory?.quantity ?? 0,
          trackInventory: v.inventory?.trackInventory ?? true,
          allowBackorder: v.inventory?.allowBackorder ?? false,
          options: v.options ?? [],
          images: v.images ?? [],
          weight: v.weight ?? null,
          length: v.length ?? null,
          width: v.width ?? null,
          height: v.height ?? null,
          createdAt: v.createdAt ? new Date(v.createdAt) : product.createdAt,
          updatedAt: v.updatedAt ? new Date(v.updatedAt) : product.updatedAt,
        },
        create: {
          id: v.id,
          productId: product.id,
          sku: v.sku,
          name: v.name,
          price: v.price,
          compareAtPrice: v.compareAtPrice ?? null,
          currency: v.currency ?? "USD",
          quantity: v.inventory?.quantity ?? 0,
          trackInventory: v.inventory?.trackInventory ?? true,
          allowBackorder: v.inventory?.allowBackorder ?? false,
          options: v.options ?? [],
          images: v.images ?? [],
          weight: v.weight ?? null,
          length: v.length ?? null,
          width: v.width ?? null,
          height: v.height ?? null,
          createdAt: v.createdAt ? new Date(v.createdAt) : product.createdAt,
          updatedAt: v.updatedAt ? new Date(v.updatedAt) : product.updatedAt,
        },
      });
      variantCount++;
    }
  }
  console.log(`  ✓ Seeded ${productsData.products?.length || 0} products, ${variantCount} variants`);

  // ---------------------------------------------------------------------------
  // 5. Seed CMS Pages
  // ---------------------------------------------------------------------------
  console.log("Seeding CMS Pages...");
  const pagesData = JSON.parse(
    fs.readFileSync(path.join(rootDir, "src", "data", "pages.json"), "utf8")
  );

  for (const page of pagesData.pages || []) {
    await prisma.cmsPage.upsert({
      where: { id: page.id },
      update: {
        title: page.title,
        slug: page.slug,
        excerpt: page.excerpt ?? null,
        body: page.body,
        publishedAt: new Date(page.publishedAt),
        updatedAt: page.updatedAt ? new Date(page.updatedAt) : null,
      },
      create: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        excerpt: page.excerpt ?? null,
        body: page.body,
        publishedAt: new Date(page.publishedAt),
        updatedAt: page.updatedAt ? new Date(page.updatedAt) : null,
      },
    });
  }
  console.log(`  ✓ Seeded ${pagesData.pages?.length || 0} CMS pages`);

  // ---------------------------------------------------------------------------
  // 6. Seed Blog Posts
  // ---------------------------------------------------------------------------
  console.log("Seeding Blog Posts...");
  const blogData = JSON.parse(
    fs.readFileSync(path.join(rootDir, "src", "data", "blog.json"), "utf8")
  );

  for (const post of blogData.posts || []) {
    await prisma.blogPost.upsert({
      where: { id: post.id },
      update: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        body: post.body,
        author: post.author,
        tags: post.tags ?? [],
        coverImage: post.coverImage ?? null,
        publishedAt: new Date(post.publishedAt),
        updatedAt: post.updatedAt ? new Date(post.updatedAt) : null,
      },
      create: {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        body: post.body,
        author: post.author,
        tags: post.tags ?? [],
        coverImage: post.coverImage ?? null,
        publishedAt: new Date(post.publishedAt),
        updatedAt: post.updatedAt ? new Date(post.updatedAt) : null,
      },
    });
  }
  console.log(`  ✓ Seeded ${blogData.posts?.length || 0} blog posts`);

  // ---------------------------------------------------------------------------
  // 7. Seed Orders & OrderItems from src/data/orders.json
  // ---------------------------------------------------------------------------
  console.log("Seeding Orders & Order Items...");
  const ordersFile = path.join(rootDir, "src", "data", "orders.json");
  if (fs.existsSync(ordersFile)) {
    const ordersData = JSON.parse(fs.readFileSync(ordersFile, "utf8"));
    const orders = Array.isArray(ordersData) ? ordersData : [];

    const orderStatusMap: Record<string, OrderStatus> = {
      pending: OrderStatus.PENDING,
      processing: OrderStatus.PROCESSING,
      shipped: OrderStatus.SHIPPED,
      delivered: OrderStatus.DELIVERED,
      cancelled: OrderStatus.CANCELLED,
      refunded: OrderStatus.REFUNDED,
    };

    const paymentStatusMap: Record<string, PaymentStatus> = {
      pending: PaymentStatus.PENDING,
      authorized: PaymentStatus.AUTHORIZED,
      captured: PaymentStatus.CAPTURED,
      failed: PaymentStatus.FAILED,
      refunded: PaymentStatus.REFUNDED,
    };

    const paymentMethodMap: Record<string, PaymentMethod> = {
      card: PaymentMethod.CARD,
      paypal: PaymentMethod.PAYPAL,
      bank_transfer: PaymentMethod.BANK_TRANSFER,
      wallet: PaymentMethod.WALLET,
      other: PaymentMethod.OTHER,
    };

    for (const ord of orders) {
      const status = orderStatusMap[ord.status?.toLowerCase()] || OrderStatus.PENDING;
      const paymentStatus = paymentStatusMap[ord.paymentStatus?.toLowerCase()] || PaymentStatus.PENDING;
      const paymentMethod = ord.paymentMethod ? paymentMethodMap[ord.paymentMethod.toLowerCase()] || PaymentMethod.OTHER : null;

      // Verify userId exists if provided
      let validUserId: string | null = null;
      if (ord.userId) {
        const u = await prisma.user.findUnique({ where: { id: ord.userId } });
        if (u) validUserId = u.id;
      }

      await prisma.order.upsert({
        where: { id: ord.id },
        update: {
          orderNumber: ord.orderNumber,
          userId: validUserId,
          status,
          paymentStatus,
          paymentMethod,
          paymentReference: ord.paymentReference ?? null,
          paypalOrderId: ord.paypalOrderId ?? null,
          subtotal: ord.subtotal,
          tax: ord.tax,
          shipping: ord.shipping,
          total: ord.total,
          currency: ord.currency ?? "USD",
          customerEmail: ord.customerEmail ?? "",
          customerName: ord.customerName ?? "",
          shippingAddress: ord.shippingAddress ?? {},
          billingAddress: ord.billingAddress ?? null,
          completedAt: ord.completedAt ? new Date(ord.completedAt) : null,
          createdAt: ord.createdAt ? new Date(ord.createdAt) : new Date(),
          updatedAt: ord.updatedAt ? new Date(ord.updatedAt) : new Date(),
        },
        create: {
          id: ord.id,
          orderNumber: ord.orderNumber,
          userId: validUserId,
          status,
          paymentStatus,
          paymentMethod,
          paymentReference: ord.paymentReference ?? null,
          paypalOrderId: ord.paypalOrderId ?? null,
          subtotal: ord.subtotal,
          tax: ord.tax,
          shipping: ord.shipping,
          total: ord.total,
          currency: ord.currency ?? "USD",
          customerEmail: ord.customerEmail ?? "",
          customerName: ord.customerName ?? "",
          shippingAddress: ord.shippingAddress ?? {},
          billingAddress: ord.billingAddress ?? null,
          completedAt: ord.completedAt ? new Date(ord.completedAt) : null,
          createdAt: ord.createdAt ? new Date(ord.createdAt) : new Date(),
          updatedAt: ord.updatedAt ? new Date(ord.updatedAt) : new Date(),
        },
      });

      // Upsert order items
      for (const it of ord.items || []) {
        const itemId = it.id || `item-${ord.id}-${it.variantId}`;
        await prisma.orderItem.upsert({
          where: { id: itemId },
          update: {
            orderId: ord.id,
            productId: it.productId,
            variantId: it.variantId,
            name: it.name,
            variantName: it.variantName || "",
            sku: it.sku || "",
            image: it.image || {},
            price: it.price,
            quantity: it.quantity,
            total: it.total,
          },
          create: {
            id: itemId,
            orderId: ord.id,
            productId: it.productId,
            variantId: it.variantId,
            name: it.name,
            variantName: it.variantName || "",
            sku: it.sku || "",
            image: it.image || {},
            price: it.price,
            quantity: it.quantity,
            total: it.total,
            createdAt: ord.createdAt ? new Date(ord.createdAt) : new Date(),
          },
        });
      }
    }
    console.log(`  ✓ Seeded ${orders.length} orders`);
  }

  console.log("\n✅ Database seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
