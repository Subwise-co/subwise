// REAL inbox fixtures — reconstructed from the founder's actual email screenshots (skills/images/), the
// ground-truth test set for the scan engine (see skills/scan_engine_plan.md §1). Unlike scan-scenarios.js
// (synthetic, one clean email per case), these capture the REAL failure modes: one commitment smeared across
// 2–3 emails, processors/clearing-houses naming the wrong party, postpaid receipts, auto-renew orders, and
// new noise types.
//
// Each entry carries:
//   email   — what the scanner receives (subject/sender/date/body), used by the LIVE eval
//             (tests/real-inbox-eval.live.test.js) which runs it through the real Groq parser.
//   verdict — the IDEAL model output for that email, used by the DETERMINISTIC test
//             (tests/parser-realinbox.test.js) to lock mapVerdict + refineWithGuards WITHOUT a live call.
//   expect  — { kind | kinds | null, status?, amount?, match? } the stored row we want.
//   cluster — (optional) groups emails that Session 2 clustering must collapse into ONE commitment.
//   liveOnly— (optional) skip in the deterministic test (the per-email verdict only resolves via the
//             full parseSubscriptions pass, e.g. a broker-only SIP "due" row that PLATFORM_ONLY drops).
//
// expect.kind === null  → the email must produce NO row (noise).
// For a cancellation, expect.kind === 'cancelled' (the row has kind 'subscription' + cancelled: true).

export const REAL_INBOX = [
  // ── Cluster A: the ₹2,500 SIP — 3 emails, 3 names, ONE monthly commitment (HDFC Silver ETF FoF) ──
  {
    id: 'sip-groww-due',
    cluster: 'sip-2500',
    liveOnly: true, // names only the broker → dropped as PLATFORM_ONLY until clustering supplies the fund
    expect: { kind: 'subscription', match: '' },
    email: {
      subject: 'SIP instalment due in 2 days',
      sender: 'no-reply@groww.in',
      date: '2026-06-14',
      body: 'Hi Jayant, your SIP instalment of ₹2,500 is due on 16 Jun 2026. Please keep your account funded so the auto-debit goes through.',
    },
    verdict: { category: 'active', service_name: 'Groww', amount: 2500, currency: 'INR', billing_cycle: 'monthly', next_charge_date: '2026-07-16', is_recurring_signal: 'due', merchant_aliases: ['Groww'] },
  },
  {
    id: 'sip-hdfc-nach-debit',
    cluster: 'sip-2500',
    // A SIP NACH debit is a FIXED amount (no "up to" cap) → fixed subscription, not a usage mandate; the
    // clearing-house name still downgrades it to pending until clustering supplies the fund.
    expect: { kind: 'subscription', status: 'pending', match: 'Clearing' },
    email: {
      subject: 'Account update for your HDFC Bank A/c',
      sender: 'nachautoemailer@hdfcbank.bank.in',
      date: '2026-06-16',
      body: 'Dear Customer, Rs.2500.00 has been debited from HDFC Bank Account Number XXXXXXXXXX4777 towards Indian Clearing Corporation Ltd/0120025682 with UMRN HDFC7020912251036911 on 16-Jun-2026.',
    },
    // The model can only see a clearing-house name here → the clearing-house guard downgrades it to pending;
    // account_last4 + UMRN are kept for Session-2 clustering onto the fund.
    verdict: { category: 'mandate', service_name: 'Indian Clearing Corporation Ltd', amount: 2500, currency: 'INR', account_last4: '4777', mandate_ref: 'HDFC7020912251036911', charge_date: '2026-06-16', is_recurring_signal: 'charged', merchant_aliases: ['HDFC Bank'] },
  },
  {
    id: 'sip-units-allocated',
    cluster: 'sip-2500',
    expect: { kind: 'subscription', match: 'HDFC' },
    email: {
      subject: 'SIP: Units allocated',
      sender: 'noreply@groww.in',
      date: '2026-06-17',
      body: "It's done! Mutual fund units have been allocated to your portfolio. SCHEME NAME: HDFC Silver ETF FoF Direct Growth. SIP AMOUNT: ₹2,499.88. UNITS ALLOCATED: 61.302.",
    },
    verdict: { category: 'active', service_name: 'HDFC Silver ETF FoF Direct Growth', amount: 2499.88, currency: 'INR', billing_cycle: 'monthly', next_charge_date: '2026-07-16', is_recurring_signal: 'receipt', merchant_aliases: ['Groww'] },
  },

  // ── Cluster B: Anthropic — 2 emails, ONE monthly subscription. Receipt alone reads one-time; the
  // "confirm your monthly payment" email is the one that proves recurring. Session 2 merges them. ──
  {
    id: 'anthropic-receipt',
    cluster: 'anthropic',
    expect: { kind: 'one_time', match: 'Anthropic' }, // standalone a bare receipt → one-time (honest)
    email: {
      subject: 'Your receipt from Anthropic, PBC #2412-1448-1547',
      sender: 'invoice+statements@mail.anthropic.com',
      date: '2026-06-20',
      body: 'Receipt from Anthropic, PBC. $23.60. Order placed on Jun 20. Ordered from Anthropic, PBC.',
    },
    verdict: { category: 'active', service_name: 'Anthropic', amount: 23.6, currency: 'USD', is_recurring_signal: 'receipt' },
  },
  {
    id: 'anthropic-confirm',
    cluster: 'anthropic',
    expect: { kind: 'subscription', status: 'confirmed', match: 'Anthropic' },
    email: {
      subject: 'Important: Confirm your $23.60 payment to Anthropic, PBC',
      sender: 'billing@mail.anthropic.com',
      date: '2026-06-20',
      body: 'Confirm your monthly payment to Anthropic, PBC using Visa Secure. Your bank requires this security measure for your card ending in 6593.',
    },
    verdict: { category: 'active', service_name: 'Anthropic', amount: 23.6, currency: 'USD', billing_cycle: 'monthly', card_last4: '6593', is_recurring_signal: 'renews', payment_method: 'Visa card' },
  },

  // ── Cluster C: the shared-card trap — card 6593 on THREE different merchants. Must stay 3 rows. ──
  {
    id: 'openai-topup',
    cluster: 'card-6593',
    expect: { kind: 'one_time', match: 'OpenAI' },
    email: {
      subject: 'Your OpenAI API account has been funded',
      sender: 'noreply@tm.openai.com',
      date: '2026-06-10',
      body: 'Hi Jayant, We charged $5.90 to your credit card ending in 6593 to fund your OpenAI API credit balance.',
    },
    verdict: { category: 'one_time', service_name: 'OpenAI', amount: 5.9, currency: 'USD', card_last4: '6593', charge_date: '2026-06-10', is_recurring_signal: 'charged' },
  },
  {
    id: 'gcp-mandate-create',
    cluster: 'card-6593',
    expect: { kind: 'mandate', match: 'Google' },
    email: {
      subject: 'E-mandate registered on your Debit Card',
      sender: 'noreply@idfcfirst.bank.in',
      date: '2026-06-12',
      body: 'Dear Customer, your e-mandate for Google Cloud is set up on Debit Card ending 6593. Amount up to ₹75000 as presented. SI ID: YWHxYSeJ0E.',
    },
    verdict: { category: 'mandate', service_name: 'Google Cloud', amount: 75000, currency: 'INR', card_last4: '6593', mandate_ref: 'YWHxYSeJ0E', payment_method: 'Debit card e-mandate', is_recurring_signal: 'renews' },
  },

  // ── The three same-card cancellations (all IDFC, card 6593, 29 Jun 00:14) — ref disambiguates them ──
  {
    id: 'cancel-facebook',
    cluster: 'gcp-cancel',
    expect: { kind: 'cancelled' },
    email: {
      subject: 'Mandate cancellation success',
      sender: 'noreply@idfcfirst.bank.in',
      date: '2026-06-29',
      body: 'Dear Customer, Your e-mandate SiHubId YWI0O4Sdsv your Debit Card ending 6593 is cancelled as per your request.',
    },
    verdict: { category: 'cancelled', service_name: null, amount: null, card_last4: '6593', mandate_ref: 'YWI0O4Sdsv' },
  },
  {
    id: 'cancel-google-cloud',
    cluster: 'gcp-cancel',
    expect: { kind: 'cancelled' },
    email: {
      subject: 'Mandate cancellation success',
      sender: 'noreply@idfcfirst.bank.in',
      date: '2026-06-29',
      body: 'Dear Customer, Your e-mandate SiHubId YWHxYSeJ0E your Debit Card ending 6593 is cancelled as per your request.',
    },
    // The SiHubId equals the Google Cloud creation SI-ID → Session-3 reconcile cancels ONLY that mandate.
    verdict: { category: 'cancelled', service_name: null, amount: null, card_last4: '6593', mandate_ref: 'YWHxYSeJ0E' },
  },
  {
    id: 'cancel-third',
    cluster: 'gcp-cancel',
    expect: { kind: 'cancelled' },
    email: {
      subject: 'Mandate cancellation success',
      sender: 'noreply@idfcfirst.bank.in',
      date: '2026-06-29',
      body: 'Dear Customer, Your e-mandate SiHubId YW6vQ9P8dZ your Debit Card ending 6593 is cancelled as per your request.',
    },
    verdict: { category: 'cancelled', service_name: null, amount: null, card_last4: '6593', mandate_ref: 'YW6vQ9P8dZ' },
  },

  // ── One-time vs recurring (the receipt/tense problem) ──
  {
    id: 'airtel-postpaid-receipt',
    expect: { kind: 'one_time', match: 'Airtel' },
    email: {
      subject: 'Payment receipt for your Airtel postpaid',
      sender: 'no-reply@airtel.in',
      date: '2026-06-18',
      body: 'Thank you. We have received your payment of ₹300 for your Airtel postpaid account. Payment receipt attached.',
    },
    // The model often reads "postpaid" as a monthly plan; the past-receipt guard lands it as one-time.
    verdict: { category: 'active', service_name: 'Airtel', amount: 300, currency: 'INR', billing_cycle: 'monthly', is_recurring_signal: 'receipt' },
  },
  {
    id: 'udemy-course',
    expect: { kind: 'one_time', match: 'Udemy' },
    email: {
      subject: 'Your Udemy receipt',
      sender: 'no-reply@udemy.com',
      date: '2026-06-15',
      body: 'Thank you for your purchase. The Complete 2026 Web Development Bootcamp. Total paid: ₹612.42 on 15 Jun 2026.',
    },
    verdict: { category: 'one_time', service_name: 'Udemy', amount: 612.42, currency: 'INR', charge_date: '2026-06-15', is_recurring_signal: 'receipt' },
  },
  {
    id: 'udemy-personal-plan',
    expect: { kind: 'subscription', match: 'Udemy' },
    email: {
      subject: 'Your paid subscription to Personal Plan',
      sender: 'no-reply@udemy.com',
      date: '2026-06-16',
      body: 'Your paid subscription to Udemy Personal Plan started today. Amount ₹4500 for 12 months. Next charge 16 Jun 2027.',
    },
    verdict: { category: 'active', service_name: 'Udemy Personal Plan', amount: 4500, currency: 'INR', billing_cycle: 'annual', next_charge_date: '2027-06-16', is_recurring_signal: 'renews' },
  },
  {
    id: 'eatclub',
    expect: { kind: 'one_time', match: 'Eatclub' },
    email: {
      subject: 'Your EatClub order',
      sender: 'orders@eatclub.in',
      date: '2026-06-19',
      body: 'Your order has been placed. Total paid ₹426 on 19 Jun 2026. Enjoy your meal!',
    },
    verdict: { category: 'one_time', service_name: 'Eatclub', amount: 426, currency: 'INR', charge_date: '2026-06-19', is_recurring_signal: 'receipt' },
  },
  {
    id: 'bigbasket-voucher',
    expect: { kind: 'one_time', amount: 50.4, match: 'bigbasket' },
    email: {
      subject: 'Your bigbasket order confirmation',
      sender: 'alerts@bigbasket.com',
      date: '2026-04-18',
      body: "Dear jayant, Thank you for your order at bigbasket. Sub Total: Rs. 150.40. eVoucher 'BBFREEDEAL4' redemption: Rs. -100.00. Total: Rs. 50.40.",
    },
    // Net amount after the voucher — not the ₹150.40 subtotal.
    verdict: { category: 'one_time', service_name: 'bigbasket', amount: 50.4, currency: 'INR', charge_date: '2026-04-18', is_recurring_signal: 'receipt' },
  },
  {
    id: 'kavalry-razorpay',
    expect: { kind: 'one_time', match: 'Kavalry' },
    email: {
      subject: 'Payment successful for KAVALRY TECHNOLOGIES PRIVATE LIMITED',
      sender: 'no-reply@razorpay.com',
      date: '2026-06-28',
      body: 'Order from KAVALRY TECHNOLOGIES PRIVATE LIMITED. ₹30.00. Total cost ₹30.00. Paid Successfully.',
    },
    // Razorpay is the processor (→ merchant_aliases), Kavalry is the merchant.
    verdict: { category: 'one_time', service_name: 'KAVALRY TECHNOLOGIES PRIVATE LIMITED', amount: 30, currency: 'INR', charge_date: '2026-06-28', merchant_aliases: ['Razorpay'], is_recurring_signal: 'receipt' },
  },
  {
    id: 'godaddy-autorenew',
    expect: { kind: 'subscription', status: 'confirmed', amount: 749, match: 'GoDaddy' },
    email: {
      subject: 'Jayant Bathla, your order confirmation is inside.',
      sender: 'donotreply@godaddy.com',
      date: '2026-06-16',
      body: 'Order Number: 4113420235. .IN (.CO.IN) Domain Registration — subwise.co.in. 1 Year. ₹499.00. Auto-renews on 15-06-2027 for ₹749.00. Subtotal ₹499.00, IGST ₹89.82, Total ₹588.82.',
    },
    // The order reads one-time; the auto-renew guard flips it to an annual subscription at the RENEWAL price.
    verdict: { category: 'one_time', service_name: 'GoDaddy', amount: 499, currency: 'INR', charge_date: '2026-06-16', renewal_amount: 749, next_charge_date: '2027-06-15', is_recurring_signal: 'autorenews' },
  },

  // ── Noise — must produce NO row ──
  // The model tends to MISLABEL these as trial/subscription (live-eval misses) — the verdicts below are the
  // model's real output, and the deterministic drop-guards must turn them into NO row.
  { id: 'zoho-trial-expired', expect: { kind: null }, email: { subject: 'Zoho Workplace - Trial Period Expired', sender: 'notification@zohostore.in', date: '2026-06-29', body: 'Your trial has expired. This is to inform you that the trial period for the Mail Premium Trial you have chosen has expired. You can continue enjoying the features by upgrading here.' }, verdict: { category: 'trial', service_name: 'Zoho Workplace', trial_end_date: '2026-06-25' } },
  { id: 'aws-free-plan', expect: { kind: null }, email: { subject: 'Welcome to AWS - Your account with Free plan is ready', sender: 'no-reply@amazonaws.com', date: '2026-05-28', body: 'Your account is now active and ready to use. Your free plan account includes USD $100 in AWS credits. No charges within free plan limits unless you explicitly upgrade to a paid plan.' }, verdict: { category: 'ignore', service_name: null } },
  { id: 'brave-signup', expect: { kind: null }, email: { subject: 'Welcome to Brave', sender: 'no-reply@brave.com', date: '2026-06-05', body: 'Thanks for signing up. Your Brave account is ready. Get started with private browsing.' }, verdict: { category: 'ignore', service_name: null } },
  { id: 'gcp-dunning', expect: { kind: null }, email: { subject: 'Action required: Your Google Cloud payment failed', sender: 'payments-noreply@google.com', date: '2026-06-22', body: 'We were unable to process your payment. Please update your payment method to avoid service interruption. Amount due ₹75000.' }, verdict: { category: 'active', service_name: 'Google Cloud', amount: 75000, currency: 'INR' } },
  { id: 'hdfc-failed-txn', expect: { kind: null }, email: { subject: 'Transaction declined', sender: 'alerts@hdfcbank.net', date: '2026-06-21', body: 'Your transaction of Rs.2500 was declined due to insufficient balance. No amount has been debited.' }, verdict: { category: 'ignore', service_name: null } },
  { id: 'loom-dunning', expect: { kind: null }, email: { subject: 'Your Loom payment needs attention', sender: 'billing@loom.com', date: '2026-06-20', body: 'We couldn’t charge your card for Loom. Please update your billing details to keep your plan active.' }, verdict: { category: 'ignore', service_name: null } },
  { id: 'lenny-newsletter', expect: { kind: null }, email: { subject: "Lenny's Newsletter: the product playbook", sender: 'lenny@substack.com', date: '2026-06-20', body: 'This week: how to find product-market fit, plus a deep dive on pricing. Tools we love include Notion and Figma.' }, verdict: { category: 'ignore', service_name: null } },
  { id: 'linkedin-marketing', expect: { kind: null }, email: { subject: 'Jayant, unlock LinkedIn Premium for free', sender: 'messages-noreply@linkedin.com', date: '2026-06-18', body: 'Try LinkedIn Premium free for 1 month. See who viewed your profile. Start your free trial offer today.' }, verdict: { category: 'trial', service_name: 'LinkedIn', trial_end_date: '2026-07-18' } },
  { id: 'workspace-trial-marketing', expect: { kind: null }, email: { subject: 'Start your Google Workspace free trial', sender: 'workspace-noreply@google.com', date: '2026-06-12', body: 'Get a custom email and more. Start your 14-day free trial — no charge today.' }, verdict: { category: 'trial', service_name: 'Google Workspace', trial_end_date: '2026-06-26' } },

  // ── Marketing / product-promo emails the model turns into fake subscriptions → must be IGNORED ──
  { id: 'atlassian-loom-promo', expect: { kind: null }, email: { subject: 'Extend Jira with Teamwork Collection', sender: 'info@e.atlassian.com', date: '2026-06-06', body: 'Add docs, async video, AI and more. Teamwork Collection. Take Jira further with Teamwork Collection. Extend Jira with Teamwork Collection — Loom Business + AI.' }, verdict: { category: 'active', service_name: 'Atlassian Loom Business + AI', amount: 24, currency: 'USD', billing_cycle: 'monthly' } },
  { id: 'claude-cowork-promo', expect: { kind: null }, email: { subject: 'Run multiple tasks at once with Cowork', sender: 'no-reply@email.claude.ai', date: '2026-06-28', body: 'Walk away from your computer. Come back to finished work. Run multiple tasks, set schedules, and let Claude work while you focus. Anthropic — Claude by Anthropic.' }, verdict: { category: 'trial', service_name: 'Anthropic', amount: 23.6, currency: 'USD', billing_cycle: 'monthly', trial_end_date: '2026-07-20' } },

  // ── A real STARTED trial with billing set up (Google Workspace) → keep as a trial, not a sub/cancelled ──
  {
    id: 'gw-trial',
    expect: { kind: 'trial' },
    email: { subject: 'Set up billing for Google Workspace Business Base for subwise.co.in', sender: 'workspace-noreply@google.com', date: '2026-06-27', body: 'You have until July 4, 2026 to finish setting up your Google Workspace Business Base. Add a form of payment to retain access. You won’t be charged until your free trial ends.' },
    verdict: { category: 'active', service_name: 'Google Workspace', amount: null, currency: 'INR', billing_cycle: 'monthly', next_charge_date: '2026-07-04' },
  },

  // ── A fixed card standing-instruction (no "up to" cap) → fixed subscription, exact amount, counted ──
  {
    id: 'netflix-card-si',
    expect: { kind: 'subscription', match: 'Netflix' },
    email: { subject: 'Standing instruction set up', sender: 'cards@axisbank.com', date: '2026-06-20', body: 'A standing instruction on your card ending 7788 for Netflix has been registered. Amount ₹649 recurring monthly.' },
    verdict: { category: 'mandate', service_name: 'Netflix', amount: 649, currency: 'INR', billing_cycle: 'monthly', card_last4: '7788' },
  },

  // ── Named cancellations (no ref needed — the merchant is named) ──
  {
    id: 'draftly-cancel',
    expect: { kind: 'cancelled', match: 'Draftly' },
    email: { subject: 'Your Draftly subscription has been cancelled', sender: 'team@draftly.so', date: '2026-06-25', body: "We're sorry to see you go. Your Draftly subscription has been cancelled and will not renew." },
    verdict: { category: 'cancelled', service_name: 'Draftly' },
  },
  {
    id: 'jira-deactivated',
    expect: { kind: 'cancelled', match: 'Jira' },
    email: { subject: 'Your Jira site has been deactivated', sender: 'noreply@atlassian.com', date: '2026-06-24', body: 'Your Jira site has been deactivated and your subscription will not renew.' },
    verdict: { category: 'cancelled', service_name: 'Jira' },
  },
]
