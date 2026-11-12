# Task 22 Phase 3 & 4 - Migration Plan

## Schema vs JSON Data Analysis

### Products JSON Structure
- **categories**: Array with nested hierarchy (parentId)
- **products**: Array with variants, categoryIds, brandId, tags
- **brands**: Array of brand objects
- **Fields**: id, name, slug, description, status, categoryIds, tags, variants, featured, rating, reviewCount, brandId, body, images, createdAt, updatedAt

### Prisma Schema Coverage
✅ **Category** - Covers all JSON fields + proper relations
✅ **Product** - Covers all JSON fields + proper relations
✅ **ProductVariant** - Covers all JSON variant fields
✅ **Brand** - Covers all JSON brand fields
✅ **Indexes**: slug, status, brandId, featured, productId, sku

### Pages JSON Structure
- **pages**: Array with id, title, slug, excerpt, body, publishedAt, updatedAt

### Prisma Schema Coverage
✅ **CmsPage** - Covers all JSON fields + index on slug

### Blog JSON Structure
- **posts**: Array with id, title, slug, excerpt, body, author, tags, coverImage, publishedAt, updatedAt

### Prisma Schema Coverage
✅ **BlogPost** - Covers all JSON fields + indexes on slug, publishedAt

### Orders JSON Structure
- Single order with: id, orderNumber, items, status, paymentStatus, subtotal, tax, shipping, total, currency, shippingAddress, customerEmail, customerName, paymentMethod, paymentReference, paypalOrderId, completedAt, createdAt, updatedAt

### Prisma Schema Coverage
✅ **Order** - Covers all JSON fields + userId, billingAddress
✅ **OrderItem** - Covers all line item fields
✅ **Indexes**: orderNumber, userId, customerEmail, paymentReference, paypalOrderId, status, createdAt
✅ **Enums**: OrderStatus, PaymentStatus, PaymentMethod

### Additional Prisma Models (Not in JSON)
- **User** - For future authentication (demo-only for now)
- **Address** - For user addresses
- **CartProposal** - For AI cart proposals (Task 19)
- **PaypalCheckout** - For PayPal checkout records (Task 20)

## Expected Database Tables

### Core Tables
1. **User** - User accounts (demo authentication)
2. **Address** - User addresses
3. **Brand** - Product brands
4. **Category** - Product categories with hierarchy
5. **Product** - Products
6. **ProductVariant** - Product variants
7. **CmsPage** - CMS pages
8. **BlogPost** - Blog posts

### Order Tables
9. **Order** - Orders
10. **OrderItem** - Order line items

### AI & Payment Tables
11. **CartProposal** - AI cart proposals (Task 19)
12. **PaypalCheckout** - PayPal checkout records (Task 20)

## Migration Strategy

### Phase 4A: Run Initial Migration
```bash
npx prisma migrate dev --name init
```
This will create all tables in Neon PostgreSQL.

### Phase 4B: Data Import Script
Create `prisma/seed.ts` to import JSON data:
1. **Categories** - Import from products.json
2. **Brands** - Import from products.json
3. **Products** - Import from products.json with variants
4. **Pages** - Import from pages.json
5. **BlogPosts** - Import from blog.json
6. **Orders** - Import from orders.json

### Import Rules
- **Preserve existing IDs** - Use the id from JSON, not auto-generated
- **Prevent duplicates** - Check if record exists before insert
- **Handle relations** - Use existing foreign keys (brandId, categoryIds)
- **Upsert strategy** - Update if exists, or skip if no changes
- **Validation** - Count records before and after import

### Backup Status
✅ **Backups Created:**
- `src/data/products.json.backup`
- `src/data/pages.json.backup`
- `src/data/blog.json.backup`
- `src/data/orders.json.backup`

## Record Counts to Import
- **Categories**: 7 (including subcategories)
- **Brands**: 6
- **Products**: 14
- **Product Variants**: ~33
- **Pages**: 3
- **Blog Posts**: 3
- **Orders**: 1

## Risks & Mitigations

### Risk 1: Foreign Key Constraints
**Mitigation**: Import in dependency order (Brands → Categories → Products → Variants)

### Risk 2: Unique Constraint Violations
**Mitigation**: Use Prisma `upsert` to handle existing records gracefully

### Risk 3: Data Type Mismatches
**Mitigation**: JSON fields are compatible with Prisma schema (String, Int, Json, DateTime)

### Risk 4: Missing Foreign Keys
**Mitigation**: JSON categoryIds/brandId are verified to exist in source data

## Post-Migration Verification
1. Verify table creation in Neon dashboard
2. Record counts match JSON source
3. Run read-only queries to verify data integrity
4. Test repository layer still works with JSON (fallback)

## Approval Required

Do you approve this migration plan?
- Run `npx prisma migrate dev --name init` to create tables
- Create and run seed script to import JSON data
- Update repository exports to use Prisma after verification

**Original JSON files will NOT be deleted or modified.**
