import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatPhone, sendRaw, sendText } from '@/lib/whatsapp'

describe('formatPhone', () => {
  it('produces E.164-without-plus form (91 + last 10 digits)', () => {
    expect(formatPhone('9876543210')).toBe('919876543210')
    expect(formatPhone('+91 98765 43210')).toBe('919876543210')
    expect(formatPhone('098765-43210')).toBe('919876543210')
  })
})

describe('transport provider dispatch', () => {
  const ENV = ['WHATSAPP_PROVIDER', 'WHATSAPP_WORKER_URL', 'WHATSAPP_WORKER_SECRET', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN']
  beforeEach(() => {
    vi.restoreAllMocks()
    for (const k of ENV) delete process.env[k]
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    for (const k of ENV) delete process.env[k]
  })

  it('console provider (default) does not hit the network', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const out = await sendRaw('919876543210', 'hi')
    expect(out).toEqual({ ok: true, mock: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('webjs provider POSTs to the worker /enqueue with the bearer secret', async () => {
    process.env.WHATSAPP_PROVIDER = 'webjs'
    process.env.WHATSAPP_WORKER_URL = 'https://worker.example.com/'
    process.env.WHATSAPP_WORKER_SECRET = 's3cret'
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ queued: true }) }))
    vi.stubGlobal('fetch', fetchSpy)

    await sendText('9876543210', 'hello')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://worker.example.com/enqueue') // trailing slash normalized
    expect(opts.headers.Authorization).toBe('Bearer s3cret')
    expect(JSON.parse(opts.body)).toEqual({ to: '919876543210', body: 'hello' })
  })

  it('webjs provider throws if the worker URL is missing', async () => {
    process.env.WHATSAPP_PROVIDER = 'webjs'
    await expect(sendRaw('919876543210', 'x')).rejects.toThrow(/WORKER_URL/)
  })

  it('meta provider posts to the graph API', async () => {
    process.env.WHATSAPP_PROVIDER = 'meta'
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123'
    process.env.WHATSAPP_ACCESS_TOKEN = 'tok'
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchSpy)
    await sendRaw('919876543210', 'hi')
    expect(fetchSpy.mock.calls[0][0]).toContain('graph.facebook.com')
    expect(fetchSpy.mock.calls[0][0]).toContain('/123/messages')
  })
})
