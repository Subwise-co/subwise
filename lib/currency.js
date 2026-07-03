// Currency display + conversion to INR for the ghost-spend total.
// Per-item amounts are shown in their own currency; the banner needs one number, so non-INR amounts
// are converted to INR using a LIVE rate (cached) with a current static fallback.

const SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$', AUD: 'A$', CAD: 'C$', JPY: '¥' }

// Currencies we can both display (have a symbol) AND convert (have a rate).
const SUPPORTED = new Set(Object.keys(SYMBOLS))

// Country (ISO-3166 alpha-2) → currency, limited to supported currencies (others fall back to INR).
const COUNTRY_CURRENCY = {
  IN: 'INR', US: 'USD', GB: 'GBP', AE: 'AED', SG: 'SGD', AU: 'AUD', CA: 'CAD', JP: 'JPY',
  // Eurozone → EUR
  AT: 'EUR', BE: 'EUR', CY: 'EUR', EE: 'EUR', FI: 'EUR', FR: 'EUR', DE: 'EUR', GR: 'EUR', IE: 'EUR',
  IT: 'EUR', LV: 'EUR', LT: 'EUR', LU: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR', SK: 'EUR', SI: 'EUR', ES: 'EUR',
}

// Map a country code to a supported display currency, or null if we don't support it.
export function currencyForCountry(country) {
  const cur = COUNTRY_CURRENCY[(country || '').toUpperCase()]
  return cur && SUPPORTED.has(cur) ? cur : null
}

// Client-side fallback when there's no server geo (e.g. local dev): use the browser locale's explicit
// region (e.g. "en-IN" → IN, "en-US" → US). A bare language like "en" is ambiguous → null (caller
// defaults to INR, India-first). Returns a supported currency code or null.
export function detectCurrencyFromLocale() {
  try {
    if (typeof navigator === 'undefined') return null
    const lang = navigator.language || (navigator.languages && navigator.languages[0]) || ''
    const parts = lang.split('-')
    const region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : ''
    if (region.length !== 2) return null // no explicit country in the locale
    return currencyForCountry(region)
  } catch {
    return null
  }
}

// Current-ish static fallback (used if the live fetch fails). Env-overridable.
function staticRatesToInr() {
  return {
    INR: 1,
    USD: Number(process.env.FX_USD_INR) || 94,
    EUR: Number(process.env.FX_EUR_INR) || 108,
    GBP: Number(process.env.FX_GBP_INR) || 125,
    AED: Number(process.env.FX_AED_INR) || 26,
    SGD: Number(process.env.FX_SGD_INR) || 73,
    AUD: Number(process.env.FX_AUD_INR) || 61,
    CAD: Number(process.env.FX_CAD_INR) || 69,
    JPY: Number(process.env.FX_JPY_INR) || 0.6,
  }
}

export function currencySymbol(code) {
  const c = (code || 'INR').toUpperCase()
  return SYMBOLS[c] || `${c} `
}

// Format an amount in its own currency, e.g. formatMoney(23.6, 'USD') → "$23.6".
export function formatMoney(amount, code = 'INR') {
  if (amount === null || amount === undefined || amount === '') return null
  const c = (code || 'INR').toUpperCase()
  const sym = SYMBOLS[c]
  return sym ? `${sym}${amount}` : `${amount} ${c}`
}

// Convert to INR. `rates` (a {CODE: inrPerUnit} map, e.g. from fetchRatesToInr) is preferred;
// falls back to the static map. Unknown currencies pass through 1:1.
export function toInr(amount, code = 'INR', rates = null) {
  const n = parseFloat(amount)
  if (!n) return 0
  const map = rates && Object.keys(rates).length ? rates : staticRatesToInr()
  const rate = map[(code || 'INR').toUpperCase()] ?? 1
  return n * rate
}

// Convert an INR amount INTO `code` (the user's display currency). Inverse of toInr.
// Unknown currency → returned unchanged (no conversion).
export function fromInr(amountInr, code = 'INR', rates = null) {
  const n = parseFloat(amountInr)
  if (!n) return 0
  const c = (code || 'INR').toUpperCase()
  if (c === 'INR') return n
  const map = rates && Object.keys(rates).length ? rates : staticRatesToInr()
  const inrPerUnit = map[c]
  return inrPerUnit ? n / inrPerUnit : n
}

// --- Live rates (server-side; cached) ---
let cache = { rates: null, at: 0 }
const TTL_MS = 12 * 60 * 60 * 1000 // FX moves slowly; refresh twice a day

// Returns a {CODE: inrPerUnit} map from a free FX API; cached; static fallback on any failure.
export async function fetchRatesToInr() {
  if (cache.rates && Date.now() - cache.at < TTL_MS) return cache.rates
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    const j = await res.json()
    if (j?.result === 'success' && j.rates?.INR) {
      const r = j.rates
      const out = { INR: 1 }
      // rates are per-USD; X→INR = INR_per_USD / X_per_USD.
      for (const c of ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']) {
        if (r[c]) out[c] = r.INR / r[c]
      }
      cache = { rates: out, at: Date.now() }
      return out
    }
  } catch {
    /* fall through to static */
  }
  return staticRatesToInr()
}
