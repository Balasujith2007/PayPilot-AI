import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import type { ApiResponse } from "@/types"
import type { ProductComparison } from "@/lib/comparison"
import { compareProducts } from "@/lib/comparison"
import { loadComparableProducts, parseProductIdsParam } from "@/lib/comparison/service"
import { compareProductsSchema } from "@/lib/validators"

type CompareResponse = ApiResponse<ProductComparison>

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, string[]>
) {
  return NextResponse.json<CompareResponse>(
    { error: { code, message, details } },
    { status }
  )
}

async function handleCompare(input: unknown) {
  const parsed = compareProductsSchema.safeParse(input)
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error)
    const details: Record<string, string[]> = { ...flat.fieldErrors }
    if (flat.formErrors.length > 0) details.request = flat.formErrors
    return errorResponse(
      400,
      "INVALID_REQUEST",
      parsed.error.issues[0]?.message ?? "Invalid request",
      details
    )
  }

  const { productIds } = parsed.data
  const { products, notFoundIds } = await loadComparableProducts(productIds)
  if (notFoundIds.length > 0) {
    return errorResponse(
      404,
      "PRODUCT_NOT_FOUND",
      `Unknown product ID${notFoundIds.length > 1 ? "s" : ""}: ${notFoundIds.join(", ")}`,
      { productIds: notFoundIds }
    )
  }

  return NextResponse.json<CompareResponse>({ data: compareProducts(products) })
}

/** GET /api/products/compare?ids=prod-1,prod-2 */
export async function GET(request: NextRequest) {
  const productIds = parseProductIdsParam(request.nextUrl.searchParams.getAll("ids"))
  return handleCompare({ productIds })
}

/** POST /api/products/compare  { "productIds": ["prod-1", "prod-2"] } */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON")
  }
  return handleCompare(body)
}
