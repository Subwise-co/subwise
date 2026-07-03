import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

// Favicon — the Subwise "S" mark on the brand gradient (violet → emerald), matching the logo.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
          color: '#ffffff',
          fontSize: 42,
          fontWeight: 700,
          borderRadius: 14,
        }}
      >
        S
      </div>
    ),
    { ...size }
  )
}
