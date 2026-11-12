/**
 * Task 19 — secure approval lifecycle for AI-generated cart proposals.
 *
 * Public surface of the module:
 * - `types`     — lifecycle states, audit record and decision result shapes;
 * - `store`     — the in-memory registry and its atomic state transitions;
 * - `lifecycle` — approve/reject orchestration, catalog revalidation and the
 *                  HTTP mapping the API routes consume.
 *
 * See the module doc comment in `store.ts` for the persistence limitations.
 */
export * from "./types"
export * from "./store"
export * from "./lifecycle"
