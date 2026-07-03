// Client-side scan driver. Starts a scan job then drives it batch-by-batch, emitting progress so both
// the dashboard re-scan button and the onboarding loader can show live counts. Shared so the two stay
// in lock-step. Returns when the job is done/idle (or after the safety cap).

// onProgress receives { total, cursor, found } after each batch.
// onBatch (optional) is called after each batch so the caller can refresh its data (e.g. reload subs).
export async function runScan({ onProgress, onBatch } = {}) {
  const start = await fetch('/api/scan', { method: 'POST' })
  const startData = await start.json().catch(() => ({}))
  if (!start.ok) return { ok: false, error: startData?.error || 'Could not start scan' }

  onProgress?.({ total: startData.total || 0, cursor: 0, found: 0 })

  for (let i = 0; i < 200; i++) {
    const res = await fetch('/api/scan/process', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    if (d.idle || d.status === 'done') {
      await onBatch?.()
      return { ok: true, total: d.total || startData.total || 0, found: d.found || 0 }
    }
    if (d.status === 'error') return { ok: false, error: d.error || 'Scan failed' }
    onProgress?.({ total: d.total || 0, cursor: d.cursor || 0, found: d.found || 0 })
    await onBatch?.()
    if (d.retryAfterMs) await new Promise((r) => setTimeout(r, Math.min(d.retryAfterMs, 20000)))
  }
  return { ok: true, capped: true }
}
