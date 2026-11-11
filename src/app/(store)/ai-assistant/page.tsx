import type { Metadata } from "next"
import { ShoppingAssistant } from "@/components/ai-assistant/ShoppingAssistant"

export const metadata: Metadata = {
  title: "AI Shopping Assistant — PayPilot AI",
  description:
    "Ask PayPilot AI anything about products, prices, and recommendations. Your personal shopping concierge.",
  alternates: { canonical: "/ai-assistant" },
  openGraph: {
    title: "AI Shopping Assistant — PayPilot AI",
    description:
      "Ask PayPilot AI anything about products, prices, and recommendations. Your personal shopping concierge.",
    type: "website",
  },
}

export default function AiAssistantPage() {
  return <ShoppingAssistant />
}

