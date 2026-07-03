// Cancellation guides for the /guides pages (index + per-service articles). India-first.
//
// Two tiers:
//   'hard'  — mandate/auto-debit based (UPI AutoPay, NACH/e-NACH, card standing instruction) or services
//             that deliberately bury cancellation. Cancelling the app alone does NOT stop the money.
//   'easy'  — a straightforward Account → Subscription → Cancel flow.
//
// Steps are written at a stable level (menus change; the article footer says so). Every 'hard' guide
// links back to the mandate master guides so users kill the auto-debit at the source.

// Reusable one-liner reminding users the mandate is separate from the app subscription.
export const MANDATE_REMINDER =
  'Cancelling the app is only half the job in India — the UPI AutoPay / NACH / card mandate keeps ' +
  'debiting until you cancel it too. See the “UPI AutoPay mandate”, “Bank e-NACH auto-debit” and ' +
  '“Card auto-pay” guides.'

export const GUIDES = [
  // ─────────────────────────── HARD (mandate-based / deliberately hard) — 15 ───────────────────────────
  {
    slug: 'upi-autopay-mandate',
    name: 'UPI AutoPay mandate',
    tier: 'hard',
    tag: 'UPI mandate',
    summary:
      'The #1 reason a subscription keeps charging after you “cancelled” it. Remove the mandate in the UPI app that created it.',
    steps: [
      'Google Pay: tap your profile photo → Autopay (or “Manage UPI AutoPay”) → select the merchant → Cancel / Deactivate.',
      'PhonePe: profile icon → AutoPay → select the mandate → Cancel autopay.',
      'Paytm: profile / Balance & History → UPI Automatic Payments → select → Cancel.',
      'BHIM: Mandate → My Mandates → select → Revoke.',
      'Bank app / net banking: look for “UPI Mandates” or “e-Mandate” → select → Cancel.',
    ],
    note:
      'Always cancel from the SAME app that set up the mandate. After cancelling, the merchant can no longer auto-debit — but you still owe anything already due.',
  },
  {
    slug: 'bank-enach-auto-debit',
    name: 'Bank e-NACH / NACH auto-debit',
    tier: 'hard',
    tag: 'NACH mandate',
    summary:
      'SIPs, insurance, EMIs and many subscriptions debit through a NACH mandate registered with your bank — cancel it at the bank, not just the merchant.',
    steps: [
      'Net banking: log in → “Mandates” / “e-Mandate” / “NACH mandates” (often under Bill Pay) → select the biller → Cancel / Stop.',
      'Mobile banking app: Payments → Mandates → select → Cancel.',
      'No online option? Submit a mandate-cancellation request at your branch, or ask the merchant to stop it in writing.',
      'Do it 1–2 working days before the next debit date so it takes effect in time.',
    ],
    note:
      'Cancelling a NACH mandate for a loan or insurance stops the auto-debit but does NOT end the obligation — pay manually or you may default / lapse cover.',
  },
  {
    slug: 'card-auto-pay-standing-instruction',
    name: 'Card auto-pay (standing instruction)',
    tier: 'hard',
    tag: 'Card e-mandate',
    summary:
      'Recurring charges on a debit/credit card run on an RBI e-mandate (standing instruction). Cancel via your card issuer.',
    steps: [
      'Bank net banking / app: Cards → Manage → “Recurring / e-Mandate / Standing Instructions” → select the merchant → Cancel.',
      'Some banks: call or SMS the card helpline to stop a standing instruction.',
      'Also cancel inside the merchant’s account page so it can’t re-register the card.',
      'For overseas subscriptions, remove the card from the merchant entirely.',
    ],
    note:
      'Under RBI rules merchants must let you cancel. If a charge still lands after cancellation, raise a dispute / chargeback with your bank.',
  },
  {
    slug: 'mutual-fund-sip',
    name: 'Mutual Fund SIP',
    tier: 'hard',
    tag: 'Investment',
    summary:
      'Stopping a SIP has two parts: cancel the SIP instruction with your broker/AMC AND kill the auto-debit mandate.',
    steps: [
      'Groww: Investments → SIPs → select the SIP → Cancel SIP (or Pause).',
      'Zerodha Coin: SIPs → select → Stop/Delete SIP; cancel the mandate in Console if prompted.',
      'Kuvera / Paytm Money / AMC site: Systematic → select the SIP → Stop.',
      'Then cancel the linked NACH / UPI AutoPay mandate so no debit is even attempted.',
    ],
    note:
      'Stopping a SIP does NOT redeem your existing units — your money stays invested until you actually redeem it.',
  },
  {
    slug: 'google-one-workspace-cloud',
    name: 'Google (One / Workspace / Cloud)',
    tier: 'hard',
    tag: 'SaaS',
    summary: 'Google bills via card or UPI AutoPay; the subscription and the mandate are separate.',
    steps: [
      'Google One: one.google.com → Settings → Cancel membership (or Play Store → Subscriptions → Google One → Cancel).',
      'Google Workspace: admin.google.com → Billing → Subscriptions → cancel / downgrade the plan.',
      'Google Cloud: console.cloud.google.com → Billing → settle dues, then close the billing account / remove the payment method.',
      'Finally remove the Google UPI AutoPay or card mandate in your UPI app / bank.',
    ],
    note: 'For Workspace and Cloud, cancel before the next billing date and clear any outstanding usage charges first.',
  },
  {
    slug: 'amazon-prime',
    name: 'Amazon Prime',
    tier: 'hard',
    tag: 'Shopping / OTT',
    summary: 'End the membership and stop the UPI/card auto-renew — the two are separate.',
    steps: [
      'amazon.in → Accounts & Lists → Prime Membership → Manage → End Membership (turn off auto-renew).',
      'Joined in the app? Menu → Prime → Manage Membership → End membership.',
      'Cancel the Amazon UPI AutoPay / card mandate in your UPI app or bank.',
    ],
    note: 'You keep Prime benefits until the current paid period ends.',
  },
  {
    slug: 'adobe-creative-cloud',
    name: 'Adobe Creative Cloud',
    tier: 'hard',
    tag: 'SaaS',
    summary: 'Annual plans billed monthly carry an early-termination fee — cancel carefully.',
    steps: [
      'account.adobe.com → Plans → Manage plan → Cancel plan.',
      'Check the early-termination fee (up to ~50% of the remaining term on annual plans) before confirming.',
      'Consider downgrading to a cheaper plan instead of cancelling mid-term.',
      'Remove the card / UPI mandate after Adobe confirms cancellation.',
    ],
    note: 'Cancelling within 14 days of a new purchase is usually a full refund.',
  },
  {
    slug: 'linkedin-premium',
    name: 'LinkedIn Premium',
    tier: 'hard',
    tag: 'SaaS',
    summary: 'You must cancel from a desktop browser — the mobile app hides the option.',
    steps: [
      'On desktop: linkedin.com → your photo → “Access My Premium” / Settings → Subscriptions → Cancel subscription.',
      'Subscribed via the iOS/Android app instead? Cancel in Apple Subscriptions or Play Store → Subscriptions.',
      'Cancel any card / UPI mandate afterward.',
    ],
    note: 'Premium features continue until the billing period ends.',
  },
  {
    slug: 'cult-fit-cultpass',
    name: 'Cult.fit (Cultpass)',
    tier: 'hard',
    tag: 'Fitness',
    summary: 'Auto-renews, with cancellation buried deep in the app.',
    steps: [
      'cult.fit app → Profile → Membership / Manage plan → Cancel or turn off auto-renew.',
      'Bought via Play Store / App Store? Cancel there instead.',
      'Cancel the cult.fit UPI AutoPay / card mandate.',
      'For a pause or refund, contact cult.fit support in-app.',
    ],
  },
  {
    slug: 'times-prime',
    name: 'Times Prime',
    tier: 'hard',
    tag: 'Bundle',
    summary: 'A notorious auto-renewer — turn off renewal well before the date.',
    steps: [
      'timesprime.com or the Times Prime app → My Account → Membership → Manage → Turn off auto-renewal / Cancel.',
      'Bought via a Paytm/Google Pay offer? Cancel that UPI mandate in the respective app.',
      'Remove the Times Prime UPI / card mandate.',
    ],
    note: 'It renews automatically at full price — cancel a few days early to be safe.',
  },
  {
    slug: 'audible',
    name: 'Audible',
    tier: 'hard',
    tag: 'Audio',
    summary: 'Membership plus credits — cancel on the website, not the app.',
    steps: [
      'On desktop: audible.in → Account Details → Cancel membership (uses your Amazon login).',
      'Joined via iOS? Cancel in Apple → Settings → Subscriptions instead.',
      'Use up remaining credits first — they’re usually lost on cancellation.',
      'Cancel the card / UPI mandate.',
    ],
  },
  {
    slug: 'chatgpt-plus-openai',
    name: 'ChatGPT Plus (OpenAI)',
    tier: 'hard',
    tag: 'SaaS',
    summary: 'Billed on your card via Stripe.',
    steps: [
      'chatgpt.com → your name / profile → Settings → Subscription → Manage → Cancel subscription (opens the Stripe billing portal).',
      'Confirm the cancellation; access continues until the end of the period.',
      'Remove or cancel the card mandate if you don’t want the card kept on file.',
    ],
  },
  {
    slug: 'apple-subscriptions',
    name: 'Apple (Apple One / iCloud+ / App-Store subs)',
    tier: 'hard',
    tag: 'Platform',
    summary: 'Every Apple and App-Store-billed subscription lives in one place — including many you’d never guess.',
    steps: [
      'iPhone/iPad: Settings → tap your name → Subscriptions → select → Cancel Subscription.',
      'Mac: App Store → your name → Account Settings → manage Subscriptions.',
      'Web: appleid.apple.com or reportaproblem.apple.com → Subscriptions.',
      'iCloud+: Settings → your name → iCloud → Manage Account Storage → Change Storage Plan → Downgrade to Free.',
    ],
    note: 'Many “hard to cancel” India subs (dating apps, some OTTs) are actually billed by Apple — cancel them here.',
  },
  {
    slug: 'insurance-premium-auto-debit',
    name: 'Insurance premium auto-debit',
    tier: 'hard',
    tag: 'Finance',
    summary: 'You can stop the auto-debit, but stopping payments can lapse the policy — decide intentionally.',
    steps: [
      'To keep the policy but pay manually: cancel the NACH / UPI / card mandate (see the mandate guides) and pay each premium yourself before the due date.',
      'To discontinue the policy: contact the insurer (portal or branch); use the free-look period (usually 15–30 days) for a refund if the policy is recent.',
      'For ULIPs / tax-saver plans, check the lock-in and surrender rules first.',
    ],
    note: 'Simply stopping the debit without informing the insurer can lapse your cover. This is not financial advice — confirm with the insurer.',
  },
  {
    slug: 'dating-apps-tinder-bumble',
    name: 'Dating apps (Tinder / Bumble)',
    tier: 'hard',
    tag: 'Apps',
    summary: 'Almost always billed by Google Play or Apple — cancel there, not inside the app.',
    steps: [
      'Android: Play Store → profile → Payments & subscriptions → Subscriptions → Tinder/Bumble → Cancel.',
      'iPhone: Settings → your name → Subscriptions → select → Cancel.',
      'Bought on the web (tinder.com)? Settings → Manage Payment Account → Cancel.',
      'Deleting the app or your dating profile does NOT stop billing — cancel the subscription first.',
    ],
  },

  // ─────────────────────────────────── EASY (Account → Cancel) — 10 ───────────────────────────────────
  {
    slug: 'netflix',
    name: 'Netflix',
    tier: 'easy',
    tag: 'OTT',
    summary: 'A clean, self-serve cancel from your account page.',
    steps: [
      'netflix.com → Account → Membership → Cancel Membership.',
      'You keep access until the end of the current billing period.',
      'Billed via a Jio/Airtel bundle? Cancel through that provider instead.',
      'Cancel the UPI mandate if you set one up.',
    ],
  },
  {
    slug: 'spotify',
    name: 'Spotify',
    tier: 'easy',
    tag: 'Music',
    summary: 'Downgrade to Free in a couple of taps.',
    steps: [
      'spotify.com/account → Your plan → Change / Cancel plan → Cancel Premium.',
      'Your account reverts to Free at the end of the period.',
      'Cancel the UPI / card mandate.',
    ],
  },
  {
    slug: 'disney-plus-hotstar',
    name: 'Disney+ Hotstar',
    tier: 'easy',
    tag: 'OTT',
    summary: 'Manage the plan from your account.',
    steps: [
      'hotstar.com or the app → My Account / Profile → Subscription → Manage → Cancel.',
      'Bundled via Jio/Airtel/Amazon? Cancel through that provider.',
      'Cancel the UPI mandate.',
    ],
  },
  {
    slug: 'youtube-premium',
    name: 'YouTube Premium & Music',
    tier: 'easy',
    tag: 'OTT',
    summary: 'One toggle in your memberships.',
    steps: [
      'youtube.com → your profile → Purchases and memberships (Paid memberships) → Manage → Cancel.',
      'Or Play Store → Subscriptions → YouTube Premium → Cancel.',
      'Cancel the UPI / card mandate.',
    ],
  },
  {
    slug: 'zomato-gold',
    name: 'Zomato Gold',
    tier: 'easy',
    tag: 'Food',
    summary: 'Turn off auto-renew in the app.',
    steps: [
      'Zomato app → Profile → Gold → Manage → turn off auto-renew / Cancel.',
      'Cancel the UPI mandate.',
    ],
  },
  {
    slug: 'swiggy-one',
    name: 'Swiggy One',
    tier: 'easy',
    tag: 'Food',
    summary: 'Manage the membership from your account.',
    steps: [
      'Swiggy app → Account → Swiggy One → Manage membership → turn off auto-renew.',
      'Cancel the UPI mandate.',
    ],
  },
  {
    slug: 'zee5',
    name: 'ZEE5',
    tier: 'easy',
    tag: 'OTT',
    summary: 'Cancel from My Subscriptions.',
    steps: [
      'zee5.com or the app → My Subscriptions → Manage → Cancel / turn off auto-renew.',
      'Cancel the UPI / card mandate.',
    ],
  },
  {
    slug: 'sonyliv',
    name: 'SonyLIV',
    tier: 'easy',
    tag: 'OTT',
    summary: 'Turn off auto-renew in account settings.',
    steps: [
      'sonyliv.com or the app → Settings / My Account → Subscription → Manage → Cancel auto-renew.',
      'Cancel the UPI mandate.',
    ],
  },
  {
    slug: 'jiocinema',
    name: 'JioCinema / JioHotstar',
    tier: 'easy',
    tag: 'OTT',
    summary: 'Manage from the app or MyJio.',
    steps: [
      'JioCinema app → Profile → Subscriptions / My Plans → Cancel or turn off auto-renew.',
      'Bundled with your Jio plan? Manage it in MyJio.',
      'Cancel the UPI mandate.',
    ],
  },
  {
    slug: 'canva-pro',
    name: 'Canva Pro',
    tier: 'easy',
    tag: 'SaaS',
    summary: 'Self-serve cancel from billing settings.',
    steps: [
      'canva.com → Account settings → Billing & plans → Cancel subscription.',
      'You keep Pro until the end of the period, then move to Free.',
      'Cancel the card / UPI mandate.',
    ],
  },
]

export const GUIDES_BY_SLUG = Object.fromEntries(GUIDES.map((g) => [g.slug, g]))
export const HARD_GUIDES = GUIDES.filter((g) => g.tier === 'hard')
export const EASY_GUIDES = GUIDES.filter((g) => g.tier === 'easy')
