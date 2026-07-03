import { describe, it, expect } from 'vitest'
import {
  normalizeEmail,
  isValidEmail,
  passwordError,
  validateCredentials,
  MIN_PASSWORD_LENGTH,
} from '../lib/auth.js'

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com')
  })
  it('handles nullish', () => {
    expect(normalizeEmail(undefined)).toBe('')
    expect(normalizeEmail(null)).toBe('')
  })
})

describe('isValidEmail', () => {
  it('accepts normal addresses', () => {
    expect(isValidEmail('jayant@gmail.com')).toBe(true)
    expect(isValidEmail('A.B+tag@sub.domain.co')).toBe(true)
  })
  it('rejects malformed addresses', () => {
    for (const bad of ['', 'nope', 'a@b', 'a@b.', '@b.com', 'a b@c.com', 'a@@b.com']) {
      expect(isValidEmail(bad)).toBe(false)
    }
  })
})

describe('passwordError', () => {
  it('rejects short passwords', () => {
    expect(passwordError('short')).toMatch(/at least/)
    expect(passwordError('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/at least/)
  })
  it('accepts a valid password', () => {
    expect(passwordError('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull()
  })
  it('rejects overly long passwords', () => {
    expect(passwordError('a'.repeat(201))).toMatch(/too long/)
  })
})

describe('validateCredentials', () => {
  it('returns normalized email on success', () => {
    expect(validateCredentials({ email: ' Me@Mail.com ', password: 'password1' })).toEqual({
      ok: true,
      email: 'me@mail.com',
    })
  })
  it('fails on bad email', () => {
    const r = validateCredentials({ email: 'bad', password: 'password1' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/valid email/)
  })
  it('fails on short password', () => {
    const r = validateCredentials({ email: 'me@mail.com', password: '123' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/at least/)
  })
  it('fails on empty input', () => {
    expect(validateCredentials().ok).toBe(false)
    expect(validateCredentials({}).ok).toBe(false)
  })
})
