import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envFile = path.join(rootDir, '.env.local');

const content = fs.readFileSync(envFile, 'utf8');
for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq > 0) {
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[k]) {
      process.env[k] = v;
    }
  }
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function verify() {
  console.log('🔍 Running Database Integrity & Verification Suite...\n');

  // 1. Record counts
  const userCount = await prisma.user.count();
  const addressCount = await prisma.address.count();
  const brandCount = await prisma.brand.count();
  const categoryCount = await prisma.category.count();
  const productCount = await prisma.product.count();
  const variantCount = await prisma.productVariant.count();
  const pageCount = await prisma.cmsPage.count();
  const blogCount = await prisma.blogPost.count();
  const orderCount = await prisma.order.count();
  const orderItemCount = await prisma.orderItem.count();

  console.log('Record Counts:');
  console.log('  Users:', userCount, '(expected: 2)');
  console.log('  Addresses:', addressCount, '(expected: 1)');
  console.log('  Brands:', brandCount, '(expected: 6)');
  console.log('  Categories:', categoryCount, '(expected: 8)');
  console.log('  Products:', productCount, '(expected: 14)');
  console.log('  Product Variants:', variantCount, '(expected: 28)');
  console.log('  CMS Pages:', pageCount, '(expected: 3)');
  console.log('  Blog Posts:', blogCount, '(expected: 3)');
  console.log('  Orders:', orderCount, '(expected: 1)');
  console.log('  Order Items:', orderItemCount, '(expected: 1)');

  const assert = (condition, msg) => {
    if (!condition) throw new Error(`Assertion failed: ${msg}`);
    console.log(`  ✓ ${msg}`);
  };

  console.log('\nValidating assertions:');
  assert(userCount === 2, 'User count is 2');
  assert(addressCount === 1, 'Address count is 1');
  assert(brandCount === 6, 'Brand count is 6');
  assert(categoryCount === 8, 'Category count is 8');
  assert(productCount === 14, 'Product count is 14');
  assert(variantCount === 28, 'ProductVariant count is 28');
  assert(pageCount === 3, 'CMS Page count is 3');
  assert(blogCount === 3, 'Blog Post count is 3');
  assert(orderCount === 1, 'Order count is 1');
  assert(orderItemCount === 1, 'OrderItem count is 1');

  // 2. Relationship verification: Category hierarchy
  console.log('\nValidating Category Hierarchy:');
  const parentCat = await prisma.category.findUnique({
    where: { id: 'cat-1' },
    include: { children: true },
  });
  assert(parentCat !== null, 'Found parent category cat-1');
  assert(parentCat.children.length === 3, `cat-1 has 3 subcategories (found: ${parentCat?.children.length})`);

  // 3. Relationship verification: Product -> Brand & Categories & Variants
  console.log('\nValidating Product Relationships:');
  const sampleProd = await prisma.product.findUnique({
    where: { id: 'prod-1' },
    include: {
      brand: true,
      categories: true,
      variants: true,
    },
  });
  assert(sampleProd !== null, 'Found product prod-1');
  assert(sampleProd.brand !== null && sampleProd.brand.name.length > 0, `prod-1 linked to brand ${sampleProd.brand?.name}`);
  assert(sampleProd.categories.length >= 2, `prod-1 linked to ${sampleProd.categories.length} categories`);
  assert(sampleProd.variants.length === 2, `prod-1 has 2 variants`);

  // 4. Relationship verification: Order -> Items -> Product/Variant
  console.log('\nValidating Order & OrderItem Relationships:');
  const sampleOrder = await prisma.order.findFirst({
    include: {
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
      user: true,
    },
  });
  assert(sampleOrder !== null, 'Found sample order');
  assert(sampleOrder.items.length === 1, 'Order has 1 line item');
  assert(sampleOrder.items[0].product.id === 'prod-1', 'Order item references valid product prod-1');
  assert(sampleOrder.items[0].variant.id === 'var-1-1', 'Order item references valid variant var-1-1');

  // 5. Constraints verification: Unique Constraints
  console.log('\nValidating Unique Constraints:');
  let duplicateThrew = false;
  try {
    await prisma.brand.create({
      data: {
        id: 'dup-brand',
        name: 'Duplicate Slug Brand',
        slug: 'volt-audio', // Already exists
        description: 'Test',
      },
    });
  } catch (err) {
    duplicateThrew = true;
  }
  assert(duplicateThrew, 'Unique constraint on Brand.slug properly enforced by database');

  console.log('\n🎉 ALL DATABASE INTEGRITY CHECKS PASSED!');
}

verify()
  .catch((e) => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
