// Representative payment-email scenarios spanning the Indian + global landscape — built so we test the
// scanner for ANY user, not just one inbox. Used by scripts/eval-scan.mjs (live LLM) and
// tests/parser-scenarios.test.js (deterministic). `expect.kind`: subscription | mandate | trial |
// one_time | cancelled | null (must be IGNORED). `match` = substring expected in the service_name.
const D = "2026-06-20"; // a recent email date

export const SCENARIOS = [
  // ── OTT / streaming subscriptions ──
  { id: "netflix", expect: { kind: "subscription", match: "Netflix" }, email: { subject: "Your Netflix receipt", sender: "info@account.netflix.com", date: D, body: "Your Netflix membership. Plan: Premium. Amount charged: ₹649.00. Next billing date: 5 Jul 2026." } },
  { id: "spotify", expect: { kind: "subscription", match: "Spotify" }, email: { subject: "Your Spotify Premium receipt", sender: "no-reply@spotify.com", date: D, body: "Payment received. Spotify Premium Individual ₹119.00 / month. Next charge 12 Jul 2026." } },
  { id: "prime", expect: { kind: "subscription", match: "Prime" }, email: { subject: "Your Amazon Prime membership", sender: "no-reply@amazon.in", date: D, body: "Your Prime membership has renewed. ₹1499.00 charged for 12 months. Renews 20 Jun 2027." } },
  { id: "chatgpt", expect: { kind: "subscription", currency: "USD" }, email: { subject: "Your receipt from OpenAI", sender: "billing@openai.com", date: D, body: "ChatGPT Plus subscription. Amount: $20.00. Billing period monthly. Next charge July 10, 2026." } },
  { id: "figma", expect: { kind: "subscription", match: "Figma" }, email: { subject: "Figma invoice", sender: "receipts@figma.com", date: D, body: "Figma Professional annual plan. $144.00 paid. Renews June 20, 2027." } },

  // ── SIPs (by fund name, not broker) ──
  { id: "hdfc-sip", expect: { kind: "subscription", match: "HDFC" }, email: { subject: "SIP instalment processed - Groww", sender: "no-reply@groww.in", date: D, body: "Your SIP for HDFC Silver ETF FoF Direct Growth has been processed. Amount ₹2500. Units allotted. Next instalment 16 Jul 2026." } },
  { id: "icici-sip", expect: { kind: "subscription", match: "ICICI" }, email: { subject: "Your SIP is successful", sender: "transactions@kuvera.in", date: D, body: "SIP in ICICI Prudential Multi Asset Fund Direct Growth: ₹2500 invested. Next SIP date 16 Jul 2026." } },

  // ── e-mandates / autopay across forms ──
  { id: "upi-autopay", expect: { kind: "mandate", match: "Swiggy" }, email: { subject: "UPI AutoPay set up", sender: "noreply@phonepe.com", date: D, body: "You have authorised a UPI AutoPay mandate to Swiggy. Up to ₹500 will be debited as presented. UMN: ABCD1234efgh5678." } },
  { id: "hdfc-emandate", expect: { kind: "mandate", match: "Facebook" }, email: { subject: "E-mandate registered", sender: "alerts@hdfcbank.net", date: D, body: "Dear Customer, your e-mandate on Debit Card ending 4321 is active. Merchant: Facebook. Amount up to ₹15000. Frequency: As Presented. SI ID: HDFC9911XYZ." } },
  // A FIXED standing-instruction (no "up to" cap) is an exact recurring charge → subscription (or mandate).
  { id: "card-si", expect: { kinds: ["subscription", "mandate"], match: "Netflix" }, email: { subject: "Standing instruction set up", sender: "cards@axisbank.com", date: D, body: "A standing instruction on your card ending 7788 for Netflix has been registered. Amount ₹649 recurring monthly." } },

  // ── loan EMI + insurance + utilities (all in scope per the product vision) ──
  { id: "loan-emi", expect: { kinds: ["subscription", "mandate"], match: "Bajaj" }, email: { subject: "Your EMI is due", sender: "noreply@bajajfinserv.in", date: D, body: "Your loan EMI of ₹4999 for your Bajaj Finserv personal loan will be auto-debited on 5 Jul 2026 via NACH." } },
  { id: "lic-insurance", expect: { kind: "subscription", match: "LIC" }, email: { subject: "Premium due reminder", sender: "noreply@licindia.in", date: D, body: "Your LIC Jeevan Anand policy premium of ₹12500 is due on 15 Jul 2026. Please pay to keep your policy active." } },
  { id: "health-insurance", expect: { kind: "subscription", match: "Star Health" }, email: { subject: "Renew your health insurance", sender: "care@starhealth.in", date: D, body: "Your Star Health family floater premium ₹18500/year is due for renewal on 1 Aug 2026." } },
  { id: "broadband", expect: { kinds: ["subscription", "mandate"], match: "ACT" }, email: { subject: "Your ACT Fibernet bill", sender: "billing@actcorp.in", date: D, body: "Your ACT Fibernet broadband bill ₹999 for the month is due on 7 Jul 2026. Recurring monthly." } },

  // ── telecom: recharge (one-time) vs autopay (mandate) ──
  { id: "airtel-recharge", expect: { kind: "one_time", match: "Airtel" }, email: { subject: "Recharge successful", sender: "no-reply@airtel.in", date: D, body: "Your Airtel prepaid recharge of ₹299 was successful on 20 Jun 2026. Validity 28 days. Thank you." } },
  { id: "jio-recharge", expect: { kind: "one_time", match: "Jio" }, email: { subject: "Payment received", sender: "no-reply@jio.com", date: D, body: "We received your payment of ₹239 for your Jio prepaid plan on 18 Jun 2026." } },
  // A recharge that LOOKS monthly (the real-world miss): the validity window makes the model say "monthly
  // subscription". The deterministic recharge guard must still land it as one_time.
  { id: "airtel-recharge-validity", expect: { kind: "one_time", match: "Airtel" }, email: { subject: "Airtel recharge successful", sender: "no-reply@airtel.in", date: D, body: "Your Airtel prepaid recharge of ₹300 is successful. Plan validity 28 days with unlimited calls + 1.5GB/day. Enjoy!" } },
  // Telecom AUTOPAY is a genuine mandate — the recharge guard must NOT flip this one.
  { id: "airtel-autopay", expect: { kind: "mandate", match: "Airtel" }, email: { subject: "AutoPay set up", sender: "no-reply@airtel.in", date: D, body: "Your Airtel postpaid AutoPay (UPI mandate) is active. Up to ₹999 will be auto-debited monthly. UMN: AIRTL9988xx." } },

  // ── trials ──
  { id: "audible-trial", expect: { kind: "trial", match: "Audible" }, email: { subject: "Your Audible free trial has started", sender: "no-reply@audible.in", date: D, body: "Welcome! Your 30-day free trial of Audible has begun. No charge until your trial ends on 20 Jul 2026." } },
  { id: "udemy-paid", expect: { kind: "subscription", match: "Udemy" }, email: { subject: "Your paid subscription to Personal Plan", sender: "no-reply@udemy.com", date: D, body: "Your paid subscription to Udemy Personal Plan started today. Amount ₹4500 for 12 months. Next charge 16 Apr 2027." } },

  // ── one-time purchases ──
  { id: "amazon-order", expect: { kind: "one_time", match: "Amazon" }, email: { subject: "Your Amazon.in order", sender: "auto-confirm@amazon.in", date: D, body: "Your order of a Logitech mouse has shipped. Order total: ₹1299. Paid on 14 Jun 2026." } },
  { id: "flight", expect: { kind: "one_time", match: "" }, email: { subject: "Booking confirmed - MakeMyTrip", sender: "trips@makemytrip.com", date: D, body: "Your flight DEL-BLR is booked. Total fare ₹6450 paid on 10 Jun 2026." } },
  { id: "laptop", expect: { kind: "one_time", match: "" }, email: { subject: "Order confirmation", sender: "store@apple.com", date: D, body: "Thank you for your purchase. MacBook Air M3 — ₹114900 paid 5 Jun 2026." } },

  // ── cancellations ──
  { id: "cancel-ref", expect: { kind: "cancelled" }, email: { subject: "Mandate cancellation success", sender: "alerts@idfcfirstbank.com", date: D, body: "Dear Customer, your e-mandate SiHubId HDFC9911XYZ on your Debit Card ending 4321 is cancelled as per your request." } },
  { id: "cancel-named", expect: { kind: "cancelled", match: "Notion" }, email: { subject: "Your Notion subscription was cancelled", sender: "team@makenotion.com", date: D, body: "We're sorry to see you go. Your Notion Plus subscription has been cancelled and will not renew." } },

  // ── NOISE — must be ignored ──
  { id: "newsletter", expect: { kind: null }, email: { subject: "The product playbook", sender: "lenny@substack.com", date: D, body: "This week: how to find product-market fit. Plus a deep dive on pricing. Read online." } },
  { id: "winback", expect: { kind: null }, email: { subject: "Come back to Premium for ₹119", sender: "no-reply@spotify.com", date: D, body: "We miss you! Restart Spotify Premium for just ₹119 for your first month. Offer ends soon." } },
  { id: "pmsby", expect: { kind: null }, email: { subject: "PMSBY auto-renewal", sender: "alerts@sbi.co.in", date: D, body: "Please maintain a minimum balance of ₹20 in your account for PMSBY (Pradhan Mantri Suraksha Bima Yojana) auto-renewal." } },
  { id: "person-transfer", expect: { kind: null }, email: { subject: "NEFT transfer successful", sender: "alerts@icicibank.com", date: D, body: "₹17000 has been transferred via NEFT to Rahul Sharma from your account on 19 Jun 2026." } },
  { id: "otp", expect: { kind: null }, email: { subject: "Your OTP is 449122", sender: "noreply@hdfcbank.net", date: D, body: "Use OTP 449122 to log in. Do not share it with anyone." } },
  { id: "shipping", expect: { kind: null }, email: { subject: "Your order is out for delivery", sender: "ship@flipkart.com", date: D, body: "Your package will be delivered today. No action needed." } },
  { id: "brand-mention", expect: { kind: null }, email: { subject: "10 tools we love", sender: "digest@somenewsletter.com", date: D, body: "Our favourite tools this month include Netflix, Notion and Figma. Here's why." } },
];
