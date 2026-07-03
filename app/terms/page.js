import LegalPage from '@/components/LegalPage'

export const metadata = {
  title: 'Terms of Service — Subwise',
  description:
    'The terms for using Subwise — a free recurring-payment reminder service for India. Best-effort detection, not financial advice, acceptable use, and limitation of liability.',
  alternates: { canonical: '/terms' },
}

const strong = 'text-slate-900 dark:text-white font-medium'

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="1 July 2026"
      intro="Subwise is a free service that organizes your recurring payments and sends you reminders before they're due. By creating an account or using Subwise, you agree to these terms. Please read them carefully."
      sections={[
        {
          h: '1. Acceptance of these terms',
          body: (
            <p>
              By creating an account, signing in, or otherwise using Subwise, you confirm that you have read, understood,
              and agree to be bound by these Terms of Service and our{' '}
              <a href="/privacy" className="text-violet-600 dark:text-violet-400 hover:underline">Privacy Policy</a>. If you
              do not agree, please do not use the service.
            </p>
          ),
        },
        {
          h: '2. Eligibility',
          body: (
            <p>
              You must be at least 18 years old and capable of forming a binding contract to use Subwise. The service is
              designed for individuals in India managing their own (or their household&apos;s) recurring payments.
            </p>
          ),
        },
        {
          h: '3. What Subwise is — and is not',
          body: (
            <p>
              Subwise is a <span className={strong}>reminder and organization tool</span>. It is not a bank, payment app,
              lender, broker, or financial advisor. Subwise does not move, hold, or process money, and it cannot cancel
              subscriptions or UPI mandates on your behalf — it tells you about them so you can act.
            </p>
          ),
        },
        {
          h: '4. Best-effort detection',
          body: (
            <p>
              Detection from your email is automated and may miss items, duplicate them, or misidentify amounts and
              dates. Reminders are a convenience, not a guarantee. You should always verify charges with your bank or
              payment app, and you remain solely responsible for cancelling your own subscriptions and auto-pay mandates.
            </p>
          ),
        },
        {
          h: '5. Not financial advice',
          body: (
            <p>
              Nothing in Subwise (including totals, forecasts, or summaries) constitutes financial, investment, tax, or
              legal advice. Figures are estimates for your convenience and may not reflect actual charges.
            </p>
          ),
        },
        {
          h: '6. Your responsibilities',
          body: (
            <p>
              You agree to provide accurate information, keep your login credentials secure, and use Subwise only for your
              own lawful purposes. You are responsible for activity that occurs under your account.
            </p>
          ),
        },
        {
          h: '7. Acceptable use',
          body: (
            <p>
              Use the service only for your own (or your household&apos;s) recurring-payment tracking. Do not attempt to
              abuse, overload, scrape, reverse-engineer, or gain unauthorized access to the service or other users&apos;
              data, and do not use it for any unlawful purpose.
            </p>
          ),
        },
        {
          h: '8. WhatsApp & communications',
          body: (
            <p>
              If you connect WhatsApp, you consent to receive reminder messages about your own payments. You can stop
              these at any time by replying <span className={strong}>STOP</span>, or by disconnecting WhatsApp in
              Settings. We may also send essential service emails.
            </p>
          ),
        },
        {
          h: '9. Accounts & termination',
          body: (
            <p>
              You may delete your account at any time from Settings, which removes your data as described in the Privacy
              Policy. We may suspend or terminate access if these terms are violated or if required to protect the
              service or other users.
            </p>
          ),
        },
        {
          h: '10. Intellectual property',
          body: (
            <p>
              Subwise, its name, design, and software are owned by us. These terms do not grant you any rights to our
              trademarks or content beyond using the service as intended. Your data remains yours.
            </p>
          ),
        },
        {
          h: '11. Disclaimer of warranties',
          body: (
            <p>
              The service is provided <span className={strong}>&ldquo;as is&rdquo;</span> and{' '}
              <span className={strong}>&ldquo;as available&rdquo;</span>, without warranties of any kind, express or
              implied, including accuracy, reliability, or fitness for a particular purpose.
            </p>
          ),
        },
        {
          h: '12. Limitation of liability',
          body: (
            <p>
              To the maximum extent permitted by law, Subwise is not liable for any charges you incur, cancellations you
              miss, or any direct, indirect, incidental, or consequential loss arising from your use of (or inability to
              use) the service. Subwise is provided to you free of charge.
            </p>
          ),
        },
        {
          h: '13. Changes to these terms',
          body: (
            <p>
              We may update these terms as the product evolves. We&apos;ll revise the &ldquo;Last updated&rdquo; date
              above, and your continued use after a change constitutes acceptance.
            </p>
          ),
        },
        {
          h: '14. Governing law',
          body: (
            <p>
              These terms are governed by the laws of India, and any disputes are subject to the exclusive jurisdiction
              of the courts of India.
            </p>
          ),
        },
      ]}
    />
  )
}
