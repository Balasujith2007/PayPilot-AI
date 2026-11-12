import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Icon className="h-16 w-16 text-muted-foreground/50" />
      <h2 className="mt-4 text-lg font-medium">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {actionLabel && (
        actionHref ? (
          <Button className="mt-8" asChild>
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : onAction ? (
          <Button className="mt-8" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null
      )}
    </div>
  )
}
