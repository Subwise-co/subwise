import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Subwise — Never miss another payment'

// Branded share/social card (light theme).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: '#F6F5F1',
          color: '#0F0F0F',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 34, fontWeight: 600 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#0F0F0F',
              color: '#F6F5F1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            S
          </div>
          subwise
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, marginTop: 40, lineHeight: 1.05 }}>
          Never miss another payment.
        </div>
        <div style={{ fontSize: 30, color: 'rgba(15,15,15,0.6)', marginTop: 24, maxWidth: 900 }}>
          Every recurring payment, organized — with WhatsApp reminders before money leaves your account.
        </div>
        <div style={{ display: 'flex', marginTop: 40 }}>
          <div style={{ background: '#1E8E5A', color: '#fff', padding: '12px 24px', borderRadius: 999, fontSize: 24 }}>
            Free · India-first
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
