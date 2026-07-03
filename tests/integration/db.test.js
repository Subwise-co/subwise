// Integration tests against the LIVE Supabase project (service-role key).
// They validate the schema + the upsert/dedupe/cascade behaviors the API routes rely on.
// All rows use a unique, namespaced email and are cleaned up after each test.
//
// Run: npm run test:integration   (needs SUPABASE_* in .env.local)
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasEnv = Boolean(url && key)
const d = hasEnv ? describe : describe.skip

const db = hasEnv ? createClient(url, key, { auth: { persistSession: false } }) : null
const TEST_PREFIX = 'inttest+'

const today = () => new Date().toISOString().split('T')[0]
const futureDate = (days) => {
  const dt = new Date()
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().split('T')[0]
}

d('Supabase integration', () => {
  let email
  let profileId

  beforeEach(async () => {
    email = `${TEST_PREFIX}${randomUUID()}@subwise.test`
    const { data, error } = await db.from('profiles').insert({ email }).select().single()
    expect(error).toBeNull()
    profileId = data.id
  })

  afterEach(async () => {
    // Cascade removes this profile's subscriptions + alerts.
    if (email) await db.from('profiles').delete().eq('email', email)
  })

  afterAll(async () => {
    // Safety net: sweep any stray test rows from interrupted runs.
    if (hasEnv) await db.from('profiles').delete().like('email', `${TEST_PREFIX}%`)
  })

  it('auto-generates a UUID id and stores defaults on a new profile', async () => {
    const { data } = await db.from('profiles').select('*').eq('email', email).single()
    expect(data.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(data.whatsapp_opted_in).toBe(false)
  })

  it('upserts a profile by email (no duplicate) and updates the phone number', async () => {
    await db.from('profiles').upsert({ email, phone_number: '9876543210' }, { onConflict: 'email' })

    const { data, error } = await db.from('profiles').select('*').eq('email', email)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data[0].phone_number).toBe('9876543210')
    expect(data[0].id).toBe(profileId) // same row, not a new one
  })

  it('dedupes subscriptions via upsert on (user_id, service_name)', async () => {
    const base = { user_id: profileId, service_name: 'Netflix', source: 'gmail' }
    await db.from('subscriptions').upsert(
      { ...base, amount: 199, next_charge_date: futureDate(10) },
      { onConflict: 'user_id,service_name' }
    )
    await db.from('subscriptions').upsert(
      { ...base, amount: 499, next_charge_date: futureDate(20) },
      { onConflict: 'user_id,service_name' }
    )

    const { data } = await db.from('subscriptions').select('*').eq('user_id', profileId)
    expect(data).toHaveLength(1)
    expect(Number(data[0].amount)).toBe(499) // most recent wins
  })

  it('enforces one alert per subscription (unique subscription_id) on upsert', async () => {
    const { data: sub } = await db
      .from('subscriptions')
      .insert({ user_id: profileId, service_name: 'Spotify', source: 'manual' })
      .select()
      .single()

    const alert = {
      user_id: profileId,
      subscription_id: sub.id,
      alert_type: 'renewal_reminder',
      alert_days_before: 3,
    }
    const first = await db.from('alerts').upsert(alert, { onConflict: 'subscription_id' })
    expect(first.error).toBeNull()
    const second = await db
      .from('alerts')
      .upsert({ ...alert, alert_days_before: 7 }, { onConflict: 'subscription_id' })
    expect(second.error).toBeNull() // would error without the unique constraint

    const { data } = await db.from('alerts').select('*').eq('subscription_id', sub.id)
    expect(data).toHaveLength(1)
    expect(data[0].alert_days_before).toBe(7)
  })

  it('applies is_active=true default on a single-row upsert that omits it (scan route pattern)', async () => {
    await db.from('subscriptions').upsert(
      { user_id: profileId, service_name: 'Prime', amount: 1499, source: 'gmail' },
      { onConflict: 'user_id,service_name' }
    )
    const { data } = await db
      .from('subscriptions')
      .select('is_active, reminder_days, currency')
      .eq('user_id', profileId)
      .single()
    expect(data.is_active).toBe(true)
    expect(data.reminder_days).toBe(3)
    expect(data.currency).toBe('INR')
  })

  it('rejects an invalid source via the CHECK constraint', async () => {
    const { error } = await db
      .from('subscriptions')
      .insert({ user_id: profileId, service_name: 'Bad', source: 'sms' })
    expect(error).not.toBeNull()
  })

  it('cascade-deletes subscriptions and alerts when the profile is removed', async () => {
    const { data: sub } = await db
      .from('subscriptions')
      .insert({ user_id: profileId, service_name: 'Hotstar', source: 'manual' })
      .select()
      .single()
    await db.from('alerts').insert({
      user_id: profileId,
      subscription_id: sub.id,
      alert_type: 'renewal_reminder',
      alert_days_before: 3,
    })

    await db.from('profiles').delete().eq('id', profileId)

    const { data: subs } = await db.from('subscriptions').select('id').eq('user_id', profileId)
    const { data: alerts } = await db.from('alerts').select('id').eq('user_id', profileId)
    expect(subs).toHaveLength(0)
    expect(alerts).toHaveLength(0)

    email = null // already deleted; skip afterEach delete
  })

  it('returns active subscriptions ordered by amount desc (mirrors /api/profile)', async () => {
    // NOTE: set is_active explicitly on every row. PostgREST bulk-inserts with the UNION of
    // keys, so a column omitted from some rows is written as NULL (not the column default) —
    // which would wrongly exclude rows from the is_active filter. The app never bulk-inserts
    // heterogeneous rows (it upserts one at a time), so this is a test-only concern.
    await db.from('subscriptions').insert([
      { user_id: profileId, service_name: 'Cheap', amount: 99, source: 'manual', is_active: true },
      { user_id: profileId, service_name: 'Pricey', amount: 1200, source: 'manual', is_active: true },
      { user_id: profileId, service_name: 'Mid', amount: 499, source: 'manual', is_active: false },
    ])

    const { data } = await db
      .from('subscriptions')
      .select('*')
      .eq('user_id', profileId)
      .eq('is_active', true)
      .order('amount', { ascending: false })

    expect(data.map((s) => s.service_name)).toEqual(['Pricey', 'Cheap']) // inactive excluded
  })
})
