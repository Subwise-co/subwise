import { describe, it, expect } from 'vitest'
import { currencySymbol, formatMoney, toInr, fromInr, currencyForCountry } from '@/lib/currency'

describe('currencySymbol', () => {
  it('maps known codes and falls back to the code', () => {
    expect(currencySymbol('INR')).toBe('₹')
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('CHF')).toBe('CHF ') // unmapped → code fallback
    expect(currencySymbol()).toBe('₹') // default INR
  })
})

describe('formatMoney', () => {
  it('formats in the item currency, not always ₹', () => {
    expect(formatMoney(23.6, 'USD')).toBe('$23.6')
    expect(formatMoney(499, 'INR')).toBe('₹499')
    expect(formatMoney(10, 'CHF')).toBe('10 CHF')
  })
  it('returns null when the amount is unknown', () => {
    expect(formatMoney(null, 'USD')).toBeNull()
    expect(formatMoney(undefined)).toBeNull()
  })
})

describe('toInr', () => {
  it('passes INR through and converts other currencies (default rates)', () => {
    expect(toInr(100, 'INR')).toBe(100)
    expect(toInr(20, 'USD')).toBe(20 * 94) // default static FX_USD_INR fallback
  })
  it('uses provided (live) rates when given', () => {
    expect(toInr(20, 'USD', { USD: 94.41, INR: 1 })).toBeCloseTo(20 * 94.41)
  })
  it('treats missing/zero amounts as 0', () => {
    expect(toInr(null, 'USD')).toBe(0)
    expect(toInr('abc', 'USD')).toBe(0)
  })
})

describe('fromInr (INR → display currency, inverse of toInr)', () => {
  it('passes INR through unchanged', () => {
    expect(fromInr(5000, 'INR')).toBe(5000)
  })
  it('converts INR into another currency using rates', () => {
    expect(fromInr(9400, 'USD', { USD: 94, INR: 1 })).toBeCloseTo(100)
  })
  it('round-trips with toInr', () => {
    const rates = { USD: 94, INR: 1 }
    expect(fromInr(toInr(50, 'USD', rates), 'USD', rates)).toBeCloseTo(50)
  })
  it('leaves an unknown currency unconverted', () => {
    expect(fromInr(1000, 'CHF', { USD: 94, INR: 1 })).toBe(1000)
  })
})

describe('currencyForCountry (location → display currency)', () => {
  it('maps supported countries', () => {
    expect(currencyForCountry('IN')).toBe('INR')
    expect(currencyForCountry('us')).toBe('USD') // case-insensitive
    expect(currencyForCountry('GB')).toBe('GBP')
    expect(currencyForCountry('DE')).toBe('EUR') // eurozone
  })
  it('returns null for unsupported / unknown countries (caller defaults to INR)', () => {
    expect(currencyForCountry('BR')).toBeNull()
    expect(currencyForCountry('')).toBeNull()
    expect(currencyForCountry(null)).toBeNull()
  })
})
