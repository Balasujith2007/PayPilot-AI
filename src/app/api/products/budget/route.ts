import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import type { ApiResponse } from "@/types"
import type { BudgetRecommendationResult } from "@/lib/budget"
import { getBudgetRecommendations } from "@/lib/budget/service"
import { budgetRequestSchema } from "@/lib/validators"

type BudgetResponse = ApiResponse<BudgetRecommendationResult>

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, string[]>
) {
  return NextResponse.json<BudgetResponse>({ error: { code, message, details } }, { status })
}

async function handleBudget(input: unknown) {
  const parsed = budgetRequestSchema.safeParse(input)
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

  const lookup = await getBudgetRecommendations(parsed.data)
  if (!lookup.ok) {
    return errorResponse(400, lookup.code, lookup.message, {
      category: lookup.availableCategories,
    })
  }
  return NextResponse.json<BudgetResponse>({ data: lookup.result })
}

function numberParam(value: string | null) {
  if (value === null || value.trim() === "") return undefined
  return /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : value
}

function booleanParam(value: string | null) {
  if (value === null) return undefined
  return value === "true" ? true : value === "false" ? false : value
}

/** GET /api/products/budget?budget=5000&category=electronics&keywords=wireless,bluetooth&use=travel */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const keywords = params.getAll("keywords").join(",")
  return handleBudget({
    budget: numberParam(params.get("budget")),
    currency: params.get("currency") ?? undefined,
    category: params.get("category") ?? undefined,
    keywords: keywords || undefined,
    intendedUse: params.get("use") ?? params.get("intendedUse") ?? undefined,
    maxAlternatives: numberParam(params.get("maxAlternatives")),
    includeOutOfStock: booleanParam(params.get("includeOutOfStock")),
  })
}

/** POST /api/products/budget  { "budget": 5000, "keywords": ["wireless"], "intendedUse": "travel" } */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON")
  }
  return handleBudget(body)
}
