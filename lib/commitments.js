// Pure category metadata for v2 "recurring financial commitments". Subscriptions are one category among
// rent / utilities / EMIs / insurance / investments / custom. Used by the Add-Reminder form, the API
// validation, and the dashboard grouping. Icon names map to lucide-react components on the UI side.

export const CATEGORIES = [
  { key: 'subscription', label: 'Subscription', icon: 'Repeat', tint: 'tintBlue' },
  { key: 'rent', label: 'Rent', icon: 'Home', tint: 'tintGreen' },
  { key: 'utility', label: 'Utility', icon: 'Zap', tint: 'tintYellow' },
  { key: 'credit_card', label: 'Credit Card', icon: 'CreditCard', tint: 'tintPink' },
  { key: 'insurance', label: 'Insurance', icon: 'ShieldCheck', tint: 'tintGreen' },
  { key: 'investment', label: 'Investment / SIP', icon: 'TrendingUp', tint: 'tintBlue' },
  { key: 'loan', label: 'Loan / EMI', icon: 'Landmark', tint: 'tintYellow' },
  { key: 'custom', label: 'Custom', icon: 'Bell', tint: 'tintPink' },
]

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key)
export const DEFAULT_CATEGORY = 'subscription'

export function isValidCategory(key) {
  return CATEGORY_KEYS.includes(String(key))
}

export function normalizeCategory(key) {
  const k = String(key || '').toLowerCase().trim().replace(/[\s-]+/g, '_')
  return CATEGORY_KEYS.includes(k) ? k : DEFAULT_CATEGORY
}

export function categoryMeta(key) {
  return CATEGORIES.find((c) => c.key === normalizeCategory(key)) || CATEGORIES[0]
}

export function categoryLabel(key) {
  return categoryMeta(key).label
}

// The display name for a commitment: an explicit title, else the merchant/service name, else the category.
export function commitmentTitle(row) {
  return row?.title || row?.service_name || categoryLabel(row?.category)
}
