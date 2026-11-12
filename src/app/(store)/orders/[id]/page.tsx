import { redirect } from "next/navigation"

export default async function OrdersRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/account/orders/${encodeURIComponent(id)}`)
}

