// Display formatting for the v3 UI. Amounts arrive already converted to the user's display currency
// (see /api/profile), so this just renders them with the right symbol + grouping.

const SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED ", SGD: "S$", AUD: "A$", CAD: "C$", JPY: "¥",
};

export function currencySymbol(code?: string) {
  const c = (code || "INR").toUpperCase();
  return SYMBOLS[c] || `${c} `;
}

// formatMoney(2000, "INR") → "₹2,000". Rounds to whole units (paise/cents add noise on a dashboard).
export function formatMoney(n: number, code = "INR") {
  const sym = currencySymbol(code);
  const v = Math.round(Number(n) || 0);
  return `${sym}${v.toLocaleString("en-IN")}`;
}
