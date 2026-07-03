// LIVE scan accuracy eval across the scenario fixtures (real Groq calls). Skipped unless RUN_LIVE_SCAN=1.
// Run:  RUN_LIVE_SCAN=1 npx vitest run tests/scan-eval.live.test.js
import { describe, it, expect } from 'vitest'
import { loadEnvLocal } from './setup/loadEnv.js'
import { SCENARIOS } from './fixtures/scan-scenarios.js'
import { parseSubscriptions } from '@/lib/parser'

loadEnvLocal()
const LIVE = process.env.RUN_LIVE_SCAN === '1'

function gotKind(rows) {
  if (!rows.length) return null
  const r = rows[0]
  return r.cancelled ? 'cancelled' : r.kind
}

describe.skipIf(!LIVE)('live scan accuracy across scenarios', () => {
  it('classifies the payment-email landscape correctly', async () => {
    const results = []
    for (const s of SCENARIOS) {
      let rows = []
      try {
        rows = await parseSubscriptions([s.email])
      } catch (e) {
        rows = []
      }
      const got = gotKind(rows)
      const name = rows[0]?.service_name || ''
      let pass
      const okKinds = s.expect.kinds || (s.expect.kind ? [s.expect.kind] : [])
      if (s.expect.kind === null && !s.expect.kinds) pass = rows.length === 0
      else if (okKinds.includes('cancelled')) pass = rows.some((r) => r.cancelled)
      else pass = rows.some((r) => (r.cancelled ? false : okKinds.includes(r.kind))) &&
                  (!s.expect.match || name.toLowerCase().includes(s.expect.match.toLowerCase()))
      const want = s.expect.kinds ? s.expect.kinds.join('|') : (s.expect.kind ?? 'ignore')
      results.push({ id: s.id, want, got: got ?? 'ignore', name, pass })
    }
    const passed = results.filter((r) => r.pass).length
    // eslint-disable-next-line no-console
    console.table(results)
    // eslint-disable-next-line no-console
    console.log(`\nACCURACY: ${passed}/${results.length} = ${Math.round((passed / results.length) * 100)}%`)
    console.log('MISSES:', results.filter((r) => !r.pass).map((r) => r.id).join(', '))
    expect(passed / results.length).toBeGreaterThanOrEqual(0.8)
  }, 180000)
})
