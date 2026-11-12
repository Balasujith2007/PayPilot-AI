import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * Returns true once the component has mounted on the client.
 * Uses useSyncExternalStore to avoid hydration mismatch and cascading render warnings.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}

