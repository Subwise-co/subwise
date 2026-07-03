// Minimal .env.local loader (no dotenv dependency). Used by integration tests and scripts.
// Populates process.env without overriding values already set in the real environment.
import fs from 'node:fs'
import path from 'node:path'

export function loadEnvLocal(file = path.resolve(process.cwd(), '.env.local')) {
  if (!fs.existsSync(file)) return
  const text = fs.readFileSync(file, 'utf8')
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

// Auto-run when used as a Vitest setupFile.
loadEnvLocal()
