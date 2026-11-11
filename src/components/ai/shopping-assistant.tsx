"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Loader2, RefreshCw, Send, Sparkles, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"

import { CartProposalCard, type CartProposalState } from "@/components/ai/cart-proposal-card"
import { BudgetResults, ComparisonResults, SearchResults } from "@/components/ai/tool-artifacts"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { proposalDiffersFrom, toCartItemInput } from "@/lib/ai/cart-approval"
import { cn } from "@/lib/utils"
import { AGENT_MAX_MESSAGES, AGENT_MAX_MESSAGE_LENGTH } from "@/lib/validators"
import { useCartStore } from "@/store/cart"
import type { AgentChatArtifacts, AgentToolCallSummary, CartProposal } from "@/types"

/** In-session conversation. History lives in this component only — nothing is persisted. */
interface UserTurn {
  id: string
  role: "user"
  content: string
}

interface AssistantTurn {
  id: string
  role: "assistant"
  content: string
  toolCalls: AgentToolCallSummary[]
  artifacts: AgentChatArtifacts
}

type ChatTurn = UserTurn | AssistantTurn

/** Shopper-facing label for a tool the agent ran. */
const TOOL_LABELS: Record<string, string> = {
  search_products: "Searched the catalog",
  compare_products: "Compared products",
  check_budget: "Checked your budget",
  propose_cart_action: "Prepared a cart proposal",
}

interface Decision {
  state: CartProposalState
  busy: boolean
  error: string | null
}

let turnSequence = 0
function nextTurnId(): string {
  turnSequence += 1
  return `turn-${turnSequence}`
}

function messageForStatus(status: number, fallback?: string): string {
  if (fallback) return fallback
  if (status === 429) return "The assistant is busy right now. Please try again shortly."
  return "The assistant could not answer that. Please try again."
}

/**
 * PayPilot AI shopping assistant.
 *
 * The panel only ever talks to the project's own API routes; the Gemini key
 * stays on the server. Every product, price and total it shows comes from the
 * server-built `artifacts` payload — the assistant's prose is never parsed for
 * numbers. A cart proposal is rendered as a suggestion: the Zustand cart is
 * touched exclusively by the Add to Cart handler, after the server has
 * revalidated the proposal.
 */
export function ShoppingAssistant() {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Revalidated proposals that replaced an earlier one, keyed by turn id. */
  const [proposals, setProposals] = useState<Record<string, CartProposal>>({})
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})

  const inFlight = useRef<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const addItem = useCartStore((s) => s.addItem)

  const setDecision = useCallback((turnId: string, value: Decision) => {
    setDecisions((current) => ({ ...current, [turnId]: value }))
  }, [])

  const requestAssistant = useCallback(async (history: ChatTurn[]) => {
    setPending(true)
    setError(null)

    try {
      const messages = history
        .slice(-AGENT_MAX_MESSAGES)
        .map((turn) => ({ role: turn.role, content: turn.content }))

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      })
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: {
              reply: string
              toolCalls: AgentToolCallSummary[]
              artifacts: AgentChatArtifacts
            }
            error?: { message?: string }
          }
        | null

      if (!response.ok || !payload?.data) {
        setError(messageForStatus(response.status, payload?.error?.message))
        return
      }

      const answer: AssistantTurn = {
        id: nextTurnId(),
        role: "assistant",
        content: payload.data.reply,
        toolCalls: payload.data.toolCalls ?? [],
        artifacts: payload.data.artifacts ?? {},
      }
      setTurns((current) => [...current, answer])
    } catch {
      setError("Could not reach the assistant. Check your connection and try again.")
    } finally {
      setPending(false)
    }
  }, [])

  const submit = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault()
      const text = draft.trim()
      if (!text || pending) return

      const userTurn: UserTurn = { id: nextTurnId(), role: "user", content: text }
      const history: ChatTurn[] = [...turns, userTurn]
      setTurns(history)
      setDraft("")
      void requestAssistant(history)
    },
    [draft, pending, requestAssistant, turns]
  )

  const retry = useCallback(() => {
    // The failed turn was never appended, so the history still ends with the
    // shopper's last message — resending it is the whole retry.
    if (pending || turns.length === 0) return
    void requestAssistant(turns)
  }, [pending, requestAssistant, turns])

  const approveProposal = useCallback(
    async (turnId: string, displayed: CartProposal) => {
      // Synchronous guard: a double click cannot submit twice, even before the
      // disabled state has rendered.
      if (inFlight.current.has(turnId)) return
      inFlight.current.add(turnId)
      setDecision(turnId, { state: "pending", busy: true, error: null })

      try {
        const response = await fetch("/api/agent/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: displayed.items.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              quantity: line.quantity,
            })),
          }),
        })
        const payload = (await response.json().catch(() => null)) as
          | { data?: CartProposal; error?: { message?: string } }
          | null

        if (!response.ok || !payload?.data) {
          setDecision(turnId, {
            state: "pending",
            busy: false,
            error:
              payload?.error?.message ?? "This proposal could not be verified. Please try again.",
          })
          return
        }

        const fresh = payload.data

        // The catalog moved on since the card was drawn. Show the shopper the
        // new numbers and ask again instead of applying a stale proposal.
        if (proposalDiffersFrom(displayed, fresh)) {
          setProposals((current) => ({ ...current, [turnId]: fresh }))
          setDecision(turnId, {
            state: "pending",
            busy: false,
            error: "Prices or availability changed. Review the updated proposal and confirm again.",
          })
          return
        }

        // The first and only place an AI suggestion may change the cart.
        for (const line of fresh.items) {
          addItem(toCartItemInput(line))
        }
        setDecision(turnId, { state: "applied", busy: false, error: null })
        toast.success(
          fresh.summary.itemCount === 1
            ? "1 item added to your cart"
            : `${fresh.summary.itemCount} items added to your cart`
        )
      } catch {
        setDecision(turnId, {
          state: "pending",
          busy: false,
          error: "Could not reach the server. Your cart was not changed.",
        })
      } finally {
        inFlight.current.delete(turnId)
      }
    },
    [addItem, setDecision]
  )

  const cancelProposal = useCallback(
    (turnId: string) => {
      // Declining is purely local: the cart and the server are left untouched.
      setDecision(turnId, { state: "cancelled", busy: false, error: null })
    },
    [setDecision]
  )

  // Keep the newest message in view.
  useEffect(() => {
    if (!open) return
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [open, turns, pending, error])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const canSend = draft.trim().length > 0 && !pending

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="assistant-launcher"
          aria-label="Open the PayPilot AI shopping assistant"
          className="fixed top-1/2 right-0 z-40 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-lg border border-r-0 bg-white px-2 py-3 shadow-md transition-colors hover:bg-neutral-50"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-[10px] font-medium tracking-wide [writing-mode:vertical-rl]">
            AI Assistant
          </span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="PayPilot AI shopping assistant"
          data-testid="shopping-assistant"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false)
          }}
          className="fixed inset-0 z-[60] flex flex-col bg-white sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[640px] sm:max-h-[calc(100dvh-3rem)] sm:w-[420px] sm:overflow-hidden sm:rounded-xl sm:border sm:shadow-2xl"
        >
          <header className="flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-start gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">PayPilot AI</p>
                <p className="text-xs text-muted-foreground">Shopping assistant</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close the shopping assistant"
              data-testid="assistant-close"
              className="-mt-1 -mr-1 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {turns.length === 0 && !pending && (
              <div className="rounded-lg bg-neutral-50 px-3 py-3 text-sm text-muted-foreground">
                <p>Hi! Ask me to find a product, compare a few options, or check a budget.</p>
                <p className="mt-1.5 text-xs">
                  I can also prepare a cart for you — nothing is ever added or paid for without your
                  approval.
                </p>
              </div>
            )}

            <ol className="space-y-4">
              {turns.map((turn) =>
                turn.role === "user" ? (
                  <li key={turn.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-foreground px-3.5 py-2 text-sm whitespace-pre-wrap text-background">
                      {turn.content}
                    </p>
                  </li>
                ) : (
                  <li key={turn.id} className="space-y-2">
                    {turn.toolCalls.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5" data-testid={`tool-status-${turn.id}`}>
                        {turn.toolCalls.map((call, index) => (
                          <li
                            key={`${call.name}-${index}`}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                              call.ok
                                ? "bg-neutral-50 text-muted-foreground"
                                : "bg-destructive/5 text-destructive"
                            )}
                          >
                            {call.ok ? (
                              <Check className="h-3 w-3 shrink-0" />
                            ) : (
                              <TriangleAlert className="h-3 w-3 shrink-0" />
                            )}
                            {TOOL_LABELS[call.name] ?? call.name.replace(/_/g, " ")}
                          </li>
                        ))}
                      </ul>
                    )}

                    {turn.content.trim().length > 0 && (
                      <p className="text-sm whitespace-pre-wrap">{turn.content}</p>
                    )}

                    {turn.artifacts.search && <SearchResults result={turn.artifacts.search} />}
                    {turn.artifacts.comparison && (
                      <ComparisonResults comparison={turn.artifacts.comparison} />
                    )}
                    {turn.artifacts.budget && <BudgetResults budget={turn.artifacts.budget} />}
                    {turn.artifacts.cartProposal && (
                      <CartProposalCard
                        proposal={proposals[turn.id] ?? turn.artifacts.cartProposal}
                        state={decisions[turn.id]?.state ?? "pending"}
                        busy={decisions[turn.id]?.busy ?? false}
                        error={decisions[turn.id]?.error ?? null}
                        onApprove={() =>
                          void approveProposal(
                            turn.id,
                            proposals[turn.id] ?? turn.artifacts.cartProposal!
                          )
                        }
                        onCancel={() => cancelProposal(turn.id)}
                      />
                    )}
                  </li>
                )
              )}
            </ol>

            {pending && (
              <p
                className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
                data-testid="assistant-loading"
                aria-live="polite"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </p>
            )}

            {error && !pending && (
              <div
                role="alert"
                data-testid="assistant-error"
                className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5"
              >
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
                {turns.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={retry}
                    className="mt-2"
                    data-testid="assistant-retry"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try again
                  </Button>
                )}
              </div>
            )}
          </div>

          <form onSubmit={submit} className="shrink-0 border-t px-4 py-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    submit()
                  }
                }}
                maxLength={AGENT_MAX_MESSAGE_LENGTH}
                rows={1}
                disabled={pending}
                placeholder="Ask about a product, a comparison or your budget…"
                aria-label="Message the shopping assistant"
                data-testid="assistant-input"
                className="max-h-32 min-h-10 flex-1 resize-none py-2.5"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!canSend}
                aria-label="Send message"
                data-testid="assistant-send"
                className="shrink-0"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Prices and stock come from the store. The assistant can never place an order or take a
              payment.
            </p>
          </form>
        </section>
      )}
    </>
  )
}
