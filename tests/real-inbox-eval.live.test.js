// LIVE accuracy eval across the REAL-inbox fixtures (real Groq calls). Skipped unless RUN_LIVE_SCAN=1.
// Run:  RUN_LIVE_SCAN=1 npx vitest run tests/real-inbox-eval.live.test.js
//
// This runs each real email through the REAL parser (prompt + guards) one at a time and prints a got-vs-expected
// table. NOTE: cluster members (the SIP trio, the Anthropic pair) only fully resolve once Session-2 clustering
// lands — standalone they classify per-email (a broker-only "SIP due" is dropped; a bare receipt reads
// one-time). `liveOnly` entries are reported but NOT asserted. The founder reviews the table after a run.
import { describe, it, expect } from 'vitest'
import { loadEnvLocal } from './setup/loadEnv.js'
import { REAL_INBOX } from './fixtures/real-inbox.js'
import { parseSubscriptions } from '@/lib/parser'

loadEnvLocal()
const LIVE = process.env.RUN_LIVE_SCAN === '1'

function passes(entry, rows) {
  const e = entry.expect
  if (e.kind === null) return rows.length === 0
  const okKinds = e.kinds || (e.kind === 'cancelled' ? ['cancelled'] : e.kind ? [e.kind] : [])
  if (okKinds.includes('cancelled')) return rows.some((r) => r.cancelled)
  const name = rows[0]?.service_name || ''
  return (
    rows.some((r) => (r.cancelled ? false : okKinds.includes(r.kind))) &&
    (!e.match || name.toLowerCase().includes(e.match.toLowerCase()))
  )
}

describe.skipIf(!LIVE)('live scan accuracy across the REAL inbox', () => {
  it('classifies the founder real emails correctly', async () => {
    const results = []
    for (const entry of REAL_INBOX) {
      let rows = []
      try {
        rows = await parseSubscriptions([entry.email])
      } catch {
        rows = []
      }
      const got = rows.length ? (rows[0].cancelled ? 'cancelled' : rows[0].kind) : 'ignore'
      results.push({
        id: entry.id,
        want: entry.expect.kind ?? 'ignore',
        got,
        name: rows[0]?.service_name || '',
        asserted: !entry.liveOnly,
        pass: passes(entry, rows),
      })
    }
    // eslint-disable-next-line no-console
    console.table(results)
    const asserted = results.filter((r) => r.asserted)
    const passed = asserted.filter((r) => r.pass).length
    // eslint-disable-next-line no-console
    console.log(`\nREAL-INBOX ACCURACY (asserted): ${passed}/${asserted.length} = ${Math.round((passed / asserted.length) * 100)}%`)
    // eslint-disable-next-line no-console
    console.log('MISSES:', asserted.filter((r) => !r.pass).map((r) => r.id).join(', ') || 'none')
    expect(passed / asserted.length).toBeGreaterThanOrEqual(0.75)
  }, 240000)

  // Session-2 acceptance: feed ALL the real emails through ONE scan and confirm the clustering collapses the
  // multi-email commitments (SIP trio → 1 fund row; Anthropic pair → 1 sub) and keeps the card-6593 merchants
  // distinct. This is the test the per-email loop above cannot show.
  it('clusters the full inbox into the right commitments', async () => {
    const emails = REAL_INBOX.map((e) => e.email)
    let rows = []
    try {
      rows = await parseSubscriptions(emails)
    } catch {
      rows = []
    }
    const active = rows.filter((r) => !r.cancelled)
    const byName = (sub) => active.filter((r) => (r.service_name || '').toLowerCase().includes(sub))
    // eslint-disable-next-line no-console
    console.table(rows.map((r) => ({ name: r.service_name, kind: r.cancelled ? 'cancelled' : r.kind, amount: r.amount, cur: r.currency, card: r.card_last4 || '', acct: r.account_last4 || '' })))

    const sip = byName('silver etf')
    const anthropic = byName('anthropic')
    // eslint-disable-next-line no-console
    console.log('SIP rows:', sip.length, '| Anthropic rows:', anthropic.length, '| Google Cloud:', byName('google').length, '| OpenAI:', byName('openai').length)

    // This test asserts the CLUSTERING (counts collapse, shared-card merchants stay distinct). The exact
    // kind/label of a merged commitment depends on the model's per-email verdicts that run (e.g. whether it
    // surfaces the "confirm your monthly payment" email) — that resolution logic is locked deterministically
    // in tests/scan-cluster.test.js, not here.
    expect(sip).toHaveLength(1) // the SIP trio (due + NACH debit + units-allocated) collapsed to one fund row
    expect(anthropic).toHaveLength(1) // receipt + confirm → one
    // card 6593 is shared across GCP / Anthropic / OpenAI but they stay distinct merchants (match the
    // specific merchant, not a bare "google" which would also catch "Google Workspace")
    expect(byName('google cloud').length).toBe(1)
    expect(byName('openai').length).toBe(1)
  }, 240000)
})
