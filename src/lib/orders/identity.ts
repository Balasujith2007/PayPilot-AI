export function resolveCustomerIdentity(request: Request): {
  userId?: string
  email?: string
} | null {
  const headers = request.headers
  const headerUserId = headers.get("x-user-id")?.trim() || null
  const headerEmail = headers.get("x-user-email")?.trim().toLowerCase() || null

  const authHeader = headers.get("authorization")?.trim() || null
  let bearerUserId: string | null = null
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    bearerUserId = authHeader.slice(7).trim() || null
  }

  const url = new URL(request.url)
  const queryUserId = url.searchParams.get("userId")?.trim() || null
  const queryEmail = url.searchParams.get("email")?.trim().toLowerCase() || null

  const resolvedUserId = headerUserId || bearerUserId || queryUserId
  const resolvedEmail = headerEmail || queryEmail

  if (!resolvedUserId && !resolvedEmail) {
    return null
  }

  return {
    userId: resolvedUserId ?? undefined,
    email: resolvedEmail ?? undefined,
  }
}

