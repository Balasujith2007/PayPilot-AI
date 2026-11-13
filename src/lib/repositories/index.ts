// Database-backed Prisma repositories with seamless JSON fallback.
// This ensures products, images, categories, and inventory edited or uploaded
// in the admin panel are live and immediately visible across the shopping store.

export { prismaProductRepository as productRepository } from "./prisma-product-repository"
export { prismaCategoryRepository as categoryRepository } from "./prisma-category-repository"
export { prismaBrandRepository as brandRepository } from "./prisma-brand-repository"
export { jsonProductRepository } from "./json-product-repository"
export { jsonCategoryRepository } from "./json-category-repository"
export { jsonBrandRepository } from "./json-brand-repository"
export { jsonPageRepository as pageRepository } from "./json-page-repository"
export { jsonBlogRepository as blogRepository } from "./json-blog-repository"
export { prismaOrderRepository as orderRepository, PrismaOrderRepository } from "./prisma-order-repository"
export { jsonOrderRepository, JsonOrderRepository } from "./json-order-repository"
