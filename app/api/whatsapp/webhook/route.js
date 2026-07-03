import { sendRaw } from '@/lib/whatsapp'
import { handleInboundMessage } from '@/lib/whatsapp-inbound'
import crypto from 'crypto'

// GET — Meta webhook verification (challenge-response).
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN)
    return new Response(challenge, { status: 200 })
  return new Response('Forbidden', { status: 403 })
}

// Constant-time comparison of the Meta signature header.
function isValidSignature(rawBody, signatureHeader) {
  const secret = process.env.WHATSAPP_APP_SECRET || process.env.WHATSAPP_ACCESS_TOKEN || ''
  const sig = signatureHeader || ''
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  if (sig.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}

// POST — incoming messages from users.
export async function POST(req) {
  const rawBody = await req.text()

  // Verify Meta's signature in production. Meta signs with the App Secret; we fall back to
  // the access token only if the secret isn't configured (matches the guide's example).
  if (process.env.NODE_ENV === 'production') {
    if (!isValidSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ status: 'ok' })
  }

  const entry = body?.entry?.[0]?.changes?.[0]?.value
  const message = entry?.messages?.[0]
  if (!message || message.type !== 'text') return Response.json({ status: 'ok' })

  const phone = message.from // e.g. "919876543210"
  const { reply } = await handleInboundMessage(phone, message.text?.body)
  if (reply) await sendRaw(phone, reply)

  return Response.json({ status: 'ok' })
}
