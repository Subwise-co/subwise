import LegalPage from '@/components/LegalPage'

export const metadata = {
  title: 'Privacy Policy — Subwise',
  description:
    'What Subwise accesses (read-only Gmail), what we store, how AI parsing and WhatsApp reminders work, the sub-processors we use, and how to delete your data — aligned with the DPDP Act 2023.',
  alternates: { canonical: '/privacy' },
}

const strong = 'text-slate-900 dark:text-white font-medium'
const code = 'rounded bg-slate-100 dark:bg-white/10 px-1 py-0.5 text-[0.85em]'

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="1 July 2026"
      intro="Subwise organizes your recurring payments and reminds you on WhatsApp before money leaves your account. This policy explains, in plain language, exactly what we access, what we store, who processes it, and the control you have over your data. It is aligned with India's Digital Personal Data Protection (DPDP) Act, 2023."
      sections={[
        {
          h: '1. Who we are',
          body: (
            <p>
              Subwise (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the website at subwise.co.in. For the purposes of the
              DPDP Act 2023 we are the <span className={strong}>Data Fiduciary</span> for the personal data described below.
              You can reach us at{' '}
              <a href="mailto:hello@subwise.co.in" className="text-violet-600 dark:text-violet-400 hover:underline">
                hello@subwise.co.in
              </a>
              .
            </p>
          ),
        },
        {
          h: '2. Gmail access (read-only)',
          body: (
            <>
              <p>
                If you sign in with Google, we request the <code className={code}>gmail.readonly</code> scope. We search
                only for emails that match <span className={strong}>payment-related keywords</span> (e.g. receipts,
                invoices, renewals, auto-pay/UPI mandates, trials) from roughly the last 6 months. For those matching
                emails we read the <span className={strong}>subject, sender, date, and message text</span> to detect the
                service or merchant, amount, billing cycle, payment method (including bank auto-pay mandates), and
                renewal or trial dates.
              </p>
              <p>
                We <span className={strong}>never</span> read your whole inbox, never read non-matching emails, and never
                open attachments. We request read-only access — Subwise cannot send, delete, or modify any email.
              </p>
              <p>
                Subwise&apos;s use and transfer of information received from Google APIs to any other app will adhere to
                the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. We do not use Gmail data for advertising, do not sell it, and do
                not let humans read it except as needed for security, to comply with law, or with your explicit consent.
              </p>
            </>
          ),
        },
        {
          h: '3. Email / password accounts',
          body: (
            <p>
              If you sign up with an email and password instead of Google, we <span className={strong}>never</span>{' '}
              request Gmail access at all, and you add your commitments manually. Passwords are stored only as a salted
              hash (bcrypt) — never in plain text, and we cannot recover them.
            </p>
          ),
        },
        {
          h: '4. What we store',
          body: (
            <>
              <p>We store the minimum needed to run the service:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Your name and email address.</li>
                <li>The recurring commitments and one-time payments we detect or you add manually.</li>
                <li>Your optional WhatsApp number and reminder preferences.</li>
                <li>
                  For Google accounts, the OAuth tokens needed to run your weekly automatic scan. The ~1-year refresh
                  token is proportionate to, and used solely for, that weekly auto-scan — so you don&apos;t have to log in
                  every week.
                </li>
              </ul>
            </>
          ),
        },
        {
          h: '5. How we use AI to read payment emails',
          body: (
            <p>
              To turn a payment email into a structured commitment, the relevant email text is processed by a
              large-language-model provider (Groq, running Meta&apos;s Llama models), with Google&apos;s Gemini as an
              automatic fallback if the primary provider is unavailable. This is used purely to extract fields like
              merchant, amount and date, and only the extracted fields are stored — the raw email text is not
              retained. We do <span className={strong}>not</span> use your data to train any AI model, and we do not
              send your data to consumer/free AI tiers.
            </p>
          ),
        },
        {
          h: '6. Sub-processors',
          body: (
            <>
              <p>We rely on a small set of trusted providers to operate Subwise:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><span className={strong}>Google</span> — sign-in and read-only Gmail access.</li>
                <li><span className={strong}>Supabase</span> — encrypted database hosting.</li>
                <li><span className={strong}>Vercel</span> — application hosting.</li>
                <li><span className={strong}>Groq</span> — AI parsing of payment-email text (see above).</li>
                <li><span className={strong}>Google (Gemini)</span> — fallback AI parsing if the primary provider is unavailable.</li>
                <li><span className={strong}>Meta (WhatsApp)</span> — delivering your reminders.</li>
                <li><span className={strong}>Resend</span> — email reminders when WhatsApp isn&apos;t connected.</li>
                <li><span className={strong}>PostHog</span> — privacy-conscious product analytics to understand how features are used (no selling of data).</li>
              </ul>
            </>
          ),
        },
        {
          h: '7. WhatsApp messages',
          body: (
            <p>
              If you opt in, we send renewal reminders and occasional summaries to your WhatsApp number. You confirm by
              replying <span className={strong}>YES</span>, and you can reply <span className={strong}>STOP</span> at any
              time to unsubscribe immediately (TRAI compliant), or <span className={strong}>PAUSE</span> to snooze the
              weekly scan. We only message you about your own payments — never marketing for third parties.
            </p>
          ),
        },
        {
          h: '8. What we never do',
          body: (
            <p>
              We never sell or rent your data, never read non-payment emails, never share your information with
              advertisers, and never use it to build profiles for anyone else.
            </p>
          ),
        },
        {
          h: '9. Data retention & deletion',
          body: (
            <p>
              You can delete your account and all associated data at any time from <span className={strong}>Settings</span>
              . Deletion is processed within 48 hours. Disconnecting Gmail revokes our access and removes the stored
              tokens. You can also revoke Subwise&apos;s access directly from your Google Account&apos;s security settings.
            </p>
          ),
        },
        {
          h: '10. Your rights (DPDP Act 2023)',
          body: (
            <p>
              You have the right to access, correct, and erase your personal data, to withdraw consent, and to nominate
              another person to exercise your rights. To make a request or raise a grievance, email{' '}
              <a href="mailto:hello@subwise.co.in" className="text-violet-600 dark:text-violet-400 hover:underline">
                hello@subwise.co.in
              </a>{' '}
              and we will respond within the timelines required by law.
            </p>
          ),
        },
        {
          h: '11. Security',
          body: (
            <p>
              Data is transmitted over HTTPS and stored in access-controlled, encrypted databases. Access tokens and
              secrets are kept server-side and never exposed to your browser. No system is perfectly secure, but we work
              to protect your data using industry-standard measures.
            </p>
          ),
        },
        {
          h: '12. Children',
          body: <p>Subwise is intended for users aged 18 and above and is not directed at children.</p>,
        },
        {
          h: '13. Changes to this policy',
          body: (
            <p>
              We may update this policy as the product evolves. We&apos;ll revise the &ldquo;Last updated&rdquo; date above,
              and material changes will be communicated in-app or by email.
            </p>
          ),
        },
      ]}
    />
  )
}
