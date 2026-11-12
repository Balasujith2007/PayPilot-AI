// PayPal Sandbox checkout.
//
// Split so the security boundary is obvious:
//   config.ts         — environment validation; owns the client secret
//   client.ts         — PayPal REST calls (OAuth + Orders v2)
//   checkout-store.ts — in-memory checkout registry (see its doc comment for
//                       the documented durability limitations)
//   checkout.ts       — catalog re-validation, order creation, verified capture
//
// Nothing in this folder is imported by the AI agent, and no agent tool can
// reach a payment endpoint. See src/lib/ai/tools for the agent's own surface.

export * from "./config"
export * from "./client"
export * from "./checkout-store"
export * from "./checkout"
