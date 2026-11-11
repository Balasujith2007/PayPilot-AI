import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/** True after hydration — use before reading localStorage-persisted stores. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
