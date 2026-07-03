// Deterministic fixture data for tests/dashboard.test.js (pure-helper unit tests in lib/dashboard.js).
// NOT used by the app — test-only. "Today" is fixed so date math is stable.

export const MOCK_TODAY = new Date('2026-06-26T12:00:00')

// 7 active recurring subs (5 monthly + 2 annual) + a trial / one-time / cancelled / pending that must
// be excluded from the recurring rollups.
export const MOCK_SUBS = [
  // ── active monthly (baseline = 649 + 119 + 2000 + 149 + 75 = 2992/mo) ──
  { id: '1', service_name: 'Netflix', amount: 649, currency: 'INR', billing_cycle: 'monthly', kind: 'subscription', status: 'confirmed', is_active: true, next_charge_date: '2026-06-05', reminder_days: 3 },
  { id: '2', service_name: 'Spotify', amount: 119, currency: 'INR', billing_cycle: 'monthly', kind: 'subscription', status: 'confirmed', is_active: true, next_charge_date: '2026-06-02', reminder_days: 3 },
  { id: '3', service_name: 'HDFC Silver ETF FoF SIP', amount: 2000, currency: 'INR', billing_cycle: 'monthly', kind: 'subscription', status: 'confirmed', is_active: true, next_charge_date: '2026-06-10', reminder_days: 7 },
  { id: '4', service_name: 'YouTube Premium', amount: 149, currency: 'INR', billing_cycle: 'monthly', kind: 'subscription', status: 'confirmed', is_active: true, next_charge_date: '2026-06-25', reminder_days: 3 },
  { id: '5', service_name: 'iCloud+', amount: 75, currency: 'INR', billing_cycle: 'monthly', kind: 'subscription', status: 'confirmed', is_active: true, next_charge_date: '2026-06-20', reminder_days: 3 },
  // ── active annual (spike their renewal month) ──
  { id: '6', service_name: 'Udemy Personal Plan', amount: 4500, currency: 'INR', billing_cycle: 'annual', kind: 'subscription', status: 'confirmed', is_active: true, next_charge_date: '2026-08-15', reminder_days: 7 },
  { id: '7', service_name: 'Adobe Creative Cloud', amount: 4230, currency: 'INR', billing_cycle: 'annual', kind: 'subscription', status: 'confirmed', is_active: true, next_charge_date: '2026-09-20', reminder_days: 7 },
  // ── excluded from recurring rollups ──
  { id: '8', service_name: 'Claude Pro', amount: 1699, currency: 'INR', billing_cycle: 'monthly', kind: 'trial', is_trial: true, status: 'confirmed', is_active: true, trial_end_date: '2026-06-29', next_charge_date: '2026-06-29', reminder_days: 3 },
  { id: '9', service_name: 'KFC', amount: 480, currency: 'INR', billing_cycle: null, kind: 'one_time', status: 'confirmed', is_active: true, next_charge_date: '2026-06-18', reminder_days: 3 },
  { id: '10', service_name: 'Jira', amount: 650, currency: 'INR', billing_cycle: 'monthly', kind: 'subscription', status: 'confirmed', is_active: false, next_charge_date: '2026-06-12', reminder_days: 3 },
  { id: '11', service_name: 'Disney+ Hotstar', amount: 299, currency: 'INR', billing_cycle: 'monthly', kind: 'subscription', status: 'pending', is_active: true, next_charge_date: '2026-06-22', reminder_days: 3 },
]

// Past-month spend snapshots (April present at 2210, May present). March intentionally absent.
export const MOCK_SNAPSHOTS = [
  { month: '2026-04-01', monthly_total_inr: 2210, active_count: 6 },
  { month: '2026-05-01', monthly_total_inr: 2500, active_count: 7 },
]
