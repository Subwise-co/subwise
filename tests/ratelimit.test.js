import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit, _reset } from '../lib/ratelimit.js'

describe('rateLimit', () => {
  beforeEach(() => _reset())

  it('allows up to the limit, then blocks', () => {
    const opts = { limit: 3, windowMs: 1000 }
    expect(rateLimit('a', opts).ok).toBe(true)
    expect(rateLimit('a', opts).ok).toBe(true)
    expect(rateLimit('a', opts).ok).toBe(true)
    const blocked = rateLimit('a', opts)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('tracks keys independently', () => {
    const opts = { limit: 1, windowMs: 1000 }
    expect(rateLimit('x', opts).ok).toBe(true)
    expect(rateLimit('y', opts).ok).toBe(true)
    expect(rateLimit('x', opts).ok).toBe(false)
  })

  it('reports decreasing remaining', () => {
    const opts = { limit: 2, windowMs: 1000 }
    expect(rateLimit('r', opts).remaining).toBe(1)
    expect(rateLimit('r', opts).remaining).toBe(0)
  })
})
