// Minimal ESM resolver hooks so Node can load the project's TypeScript
// modules directly (native type stripping) without a bundler or extra deps.
//
// Handles the three things plain Node cannot: the "@/" path alias from
// tsconfig.json, extensionless relative imports, and bare JSON imports (which
// ESM otherwise only allows with an `import ... with { type: "json" }`).
import { existsSync, readFileSync, statSync } from "node:fs"
import { join as joinPath, resolve as resolvePath } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

// .tsx is intentionally excluded — Node strips types but cannot transform JSX,
// and none of the modules under test are React components.
const EXTENSIONS = [".ts", ".mjs", ".js", ".json"]
let projectRoot = process.cwd()

export async function initialize(data) {
  if (data && typeof data.root === "string") projectRoot = data.root
}

function isFile(filePath) {
  return existsSync(filePath) && statSync(filePath).isFile()
}

function toResolution(filePath) {
  return {
    url: pathToFileURL(filePath).href,
    shortCircuit: true,
    format: filePath.endsWith(".json") ? "json" : undefined,
  }
}

/** Resolve `target` as a file, then as `<target>/index.*`. */
function fromTarget(target) {
  for (const extension of ["", ...EXTENSIONS]) {
    const candidate = target + extension
    if (isFile(candidate)) return candidate
  }
  for (const extension of EXTENSIONS) {
    const candidate = joinPath(target, `index${extension}`)
    if (isFile(candidate)) return candidate
  }
  return null
}

export async function resolve(specifier, context, next) {
  let target = null

  const isBare =
    !specifier.startsWith(".") &&
    !specifier.startsWith("/") &&
    !specifier.startsWith("@/") &&
    !specifier.startsWith("node:")

  if (specifier.startsWith("@/")) {
    target = resolvePath(projectRoot, "src", specifier.slice(2))
  } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const resolved = fileURLToPath(new URL(specifier, context.parentURL))
    // Only rewrite the extension when there isn't already one.
    if (!/\.[a-z]+$/i.test(resolved)) target = resolved
  }

  if (target) {
    const filePath = fromTarget(target)
    if (filePath) return toResolution(filePath)
  }

  if (isBare) {
    // Some packages publish extensionless subpaths that Node's ESM resolver
    // refuses outside a bundler (for example "next/server"). Try the normal
    // resolution first and only probe node_modules when it fails.
    try {
      return await next(specifier, context)
    } catch (error) {
      const probe = resolvePath(projectRoot, "node_modules", specifier)
      const filePath = isFile(probe) ? probe : fromTarget(probe)
      if (filePath) return toResolution(filePath)
      throw error
    }
  }

  return next(specifier, context)
}

export async function load(url, context, next) {
  // JSON modules are served as JS so no import attribute is required.
  if (url.endsWith(".json")) {
    const raw = readFileSync(new URL(url), "utf8").replace(/^\uFEFF/, "")
    return {
      format: "module",
      shortCircuit: true,
      source: `export default ${JSON.stringify(JSON.parse(raw))}`,
    }
  }
  return next(url, context)
}
