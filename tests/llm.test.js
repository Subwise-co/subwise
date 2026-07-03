import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the Gemini SDK; Groq is plain fetch (stubbed per test).
const geminiGen = vi.hoisted(() => vi.fn())
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: () => ({ generateContent: geminiGen }),
  })),
}))

import { generateText, providerOrder, parseRetryMs, clearCooldowns } from '@/lib/llm'

const KEYS = ['LLM_PROVIDER', 'GROQ_API_KEY', 'GROQ_API_KEYS', 'GEMINI_API_KEY', 'GROQ_MODEL', 'GEMINI_MODEL']

beforeEach(() => {
  vi.clearAllMocks()
  clearCooldowns()
  for (const k of KEYS) delete process.env[k]
})
afterEach(() => {
  vi.unstubAllGlobals()
  for (const k of KEYS) delete process.env[k]
})

const groqOk = (content) =>
  vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) }))
// "retry in 0s" → in-call back-off waits 0ms (keeps the test fast).
const groqFail = (status) =>
  vi.fn(async () => ({ ok: false, status, text: async () => 'Please retry in 0s' }))

describe('providerOrder', () => {
  it('defaults to groq-first, gemini fallback when both are configured', () => {
    process.env.GROQ_API_KEY = 'g'
    process.env.GEMINI_API_KEY = 'x'
    expect(providerOrder()).toEqual(['groq', 'gemini'])
  })

  it('honors LLM_PROVIDER=gemini', () => {
    process.env.GROQ_API_KEY = 'g'
    process.env.GEMINI_API_KEY = 'x'
    process.env.LLM_PROVIDER = 'gemini'
    expect(providerOrder()).toEqual(['gemini', 'groq'])
  })

  it('omits providers without a key', () => {
    process.env.GROQ_API_KEY = 'g'
    expect(providerOrder()).toEqual(['groq'])
  })
})

describe('generateText', () => {
  it('uses Groq when it succeeds', async () => {
    process.env.GROQ_API_KEY = 'g'
    process.env.GEMINI_API_KEY = 'x'
    vi.stubGlobal('fetch', groqOk('GROQ_OUT'))
    const meta = {}
    const out = await generateText('prompt', meta)
    expect(out).toBe('GROQ_OUT')
    expect(meta.provider).toContain('groq')
    expect(geminiGen).not.toHaveBeenCalled()
  })

  it('rotates to the next Groq key when one is rate-limited (multi-key)', async () => {
    process.env.GROQ_API_KEYS = 'k1,k2'
    let n = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        n += 1
        if (n === 1) return { ok: false, status: 429, text: async () => 'Please retry in 0s' }
        return { ok: true, json: async () => ({ choices: [{ message: { content: 'OK2' } }] }) }
      })
    )
    const meta = {}
    const out = await generateText('p', meta)
    expect(out).toBe('OK2')
    expect(meta.provider).toContain('groq')
    expect(n).toBe(2) // first key 429 → rotated to second key
  })

  it('falls back to Gemini when Groq is rate-limited', async () => {
    process.env.GROQ_API_KEY = 'g'
    process.env.GEMINI_API_KEY = 'x'
    vi.stubGlobal('fetch', groqFail(429))
    geminiGen.mockResolvedValue({ response: { text: () => 'GEMINI_OUT' } })
    const meta = {}
    const out = await generateText('prompt', meta)
    expect(out).toBe('GEMINI_OUT')
    expect(meta.provider).toContain('gemini')
  })

  it('throws when no provider is configured', async () => {
    await expect(generateText('prompt')).rejects.toThrow(/No LLM provider/)
  })

  it('annotates a total failure as rate-limited (no long wait with 0s hint)', async () => {
    process.env.GROQ_API_KEY = 'g' // groq only, so no gemini fallback
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, text: async () => 'Please retry in 0s' })))
    await expect(generateText('p')).rejects.toMatchObject({ rateLimited: true })
  })
})

describe('parseRetryMs', () => {
  it('parses Groq "retry in Xs"', () => {
    expect(parseRetryMs({ message: 'Groq 429: Please retry in 24.5s' })).toBe(24500)
  })
  it('parses Gemini retryDelay', () => {
    expect(parseRetryMs({ message: '"retryDelay":"12s"' })).toBe(12000)
  })
  it('returns null when absent', () => {
    expect(parseRetryMs({ message: 'some other error' })).toBeNull()
  })
})
