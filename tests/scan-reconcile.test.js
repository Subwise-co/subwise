import { describe, it, expect } from 'vitest'
import { reconcile } from '@/lib/scan-reconcile'

describe('reconcile — whole-account cancellation + dedupe', () => {
  it('cancels the active mandate matched by a named cancellation', () => {
    const rows = [
      { id: 'a', service_name: 'Facebook', kind: 'mandate', amount: 15000, is_active: true, status: 'confirmed' },
      { id: 'c', service_name: 'Facebook', kind: 'subscription', amount: 15000, is_active: false, cancelled: true, status: 'confirmed' },
    ]
    const { cancelIds } = reconcile(rows)
    expect(cancelIds).toContain('a')
  })

  it('applies a nameless cancellation to the active row of the same amount + drops the placeholder', () => {
    const rows = [
      { id: 'gc', service_name: 'Google Cloud Platform', kind: 'mandate', amount: 75000, is_active: true, status: 'confirmed' },
      { id: 'x', service_name: 'Cancelled mandate', kind: 'subscription', amount: 75000, is_active: false, cancelled: true, status: 'confirmed' },
    ]
    const { cancelIds, deleteIds } = reconcile(rows)
    expect(cancelIds).toContain('gc')
    expect(deleteIds).toContain('x')
  })

  it('collapses a bank-only mandate into the merchant row of the same amount', () => {
    const rows = [
      { id: 'fb', service_name: 'Facebook', kind: 'mandate', amount: 15000, is_active: true, status: 'confirmed' },
      { id: 'idfc', service_name: 'IDFC FIRST Bank', kind: 'mandate', amount: 15000, is_active: true, status: 'confirmed' },
    ]
    const { deleteIds } = reconcile(rows)
    expect(deleteIds).toContain('idfc')
    expect(deleteIds).not.toContain('fb')
  })

  it('cancels a mandate by reference when the cancel email names nothing else (Google Cloud case)', () => {
    const rows = [
      { id: 'gc', service_name: 'Google Cloud', kind: 'mandate', amount: 75000, payment_method: 'Debit card e-mandate · ref:YWl0O4Sdsv', is_active: true, status: 'confirmed' },
      { id: 'x', service_name: 'Cancelled mandate', kind: 'subscription', amount: null, payment_method: 'ref:YWl0O4Sdsv', is_active: false, cancelled: true, status: 'confirmed' },
    ];
    const { cancelIds, deleteIds } = reconcile(rows);
    expect(cancelIds).toContain('gc');
    expect(deleteIds).toContain('x');
  });

  it('3 mandates cancelled on the same card: only the ref-matched one is cancelled (IDFC card-6593 case)', () => {
    const rows = [
      { id: 'gcp', service_name: 'Google Cloud', kind: 'mandate', amount: 75000, payment_method: 'Debit card e-mandate (ending 6593) · ref:YWHxYSeJ0E', is_active: true, status: 'confirmed' },
      { id: 'fb', service_name: 'Facebook', kind: 'mandate', amount: 15000, payment_method: 'Debit card e-mandate (ending 6593) · ref:YWI0O4Sdsv', is_active: true, status: 'confirmed' },
      { id: 'spot', service_name: 'Spotify', kind: 'mandate', amount: 199, payment_method: 'UPI AutoPay (ending 6593) · ref:YW6vQ9P8dZ', is_active: true, status: 'confirmed' },
      // the founder cancelled only Google Cloud
      { id: 'cx', service_name: 'Cancelled mandate', kind: 'subscription', amount: null, payment_method: 'Debit Card ending 6593 · ref:YWHxYSeJ0E', is_active: false, cancelled: true, status: 'confirmed' },
    ]
    const { cancelIds, deleteIds } = reconcile(rows)
    expect(cancelIds).toEqual(['gcp'])
    expect(cancelIds).not.toContain('fb')
    expect(cancelIds).not.toContain('spot')
    expect(deleteIds).toContain('cx')
  })

  it('ref beats a same-card + same-amount ambiguity', () => {
    const rows = [
      { id: 'gcp', service_name: 'Google Cloud', kind: 'mandate', amount: 2500, payment_method: 'e-mandate (ending 6593) · ref:YWHxYSeJ0E', is_active: true, status: 'confirmed' },
      { id: 'fb', service_name: 'Facebook', kind: 'mandate', amount: 2500, payment_method: 'e-mandate (ending 6593) · ref:YWI0O4Sdsv', is_active: true, status: 'confirmed' },
      { id: 'cx', service_name: 'Cancelled mandate', kind: 'subscription', amount: null, payment_method: 'ending 6593 · ref:YWHxYSeJ0E', is_active: false, cancelled: true, status: 'confirmed' },
    ]
    const { cancelIds } = reconcile(rows)
    expect(cancelIds).toEqual(['gcp'])
  })

  it('a refless cancellation with an AMBIGUOUS amount (2 candidates) cancels nothing', () => {
    const rows = [
      { id: 'a', service_name: 'Fund A', kind: 'mandate', amount: 2500, is_active: true, status: 'confirmed' },
      { id: 'b', service_name: 'Fund B', kind: 'mandate', amount: 2500, is_active: true, status: 'confirmed' },
      { id: 'cx', service_name: 'Cancelled mandate', kind: 'subscription', amount: 2500, is_active: false, cancelled: true, status: 'confirmed' },
    ]
    const { cancelIds, deleteIds } = reconcile(rows)
    expect(cancelIds).toHaveLength(0)
    expect(deleteIds).not.toContain('cx') // left for the user to resolve
  })

  it('card-last4 disambiguates a refless amount tie', () => {
    const rows = [
      { id: 'a', service_name: 'Fund A', kind: 'mandate', amount: 2500, payment_method: 'UPI AutoPay', is_active: true, status: 'confirmed' },
      { id: 'b', service_name: 'Fund B', kind: 'mandate', amount: 2500, payment_method: 'Debit card (ending 6593)', is_active: true, status: 'confirmed' },
      { id: 'cx', service_name: 'Cancelled mandate', kind: 'subscription', amount: 2500, payment_method: 'Debit Card ending 6593', is_active: false, cancelled: true, status: 'confirmed' },
    ]
    const { cancelIds } = reconcile(rows)
    expect(cancelIds).toEqual(['b'])
  })

  it('leaves unrelated active rows alone', () => {
    const rows = [
      { id: 'n', service_name: 'Netflix', kind: 'subscription', amount: 649, is_active: true, status: 'confirmed' },
      { id: 's', service_name: 'Spotify', kind: 'subscription', amount: 119, is_active: true, status: 'confirmed' },
    ]
    const { cancelIds, deleteIds } = reconcile(rows)
    expect(cancelIds).toHaveLength(0)
    expect(deleteIds).toHaveLength(0)
  })
})
