// Inbound endpoint for the whatsapp-web.js worker (WHATSAPP_PROVIDER=webjs).
// The worker forwards each incoming user message here; we run the shared command handler and
// return the reply text for the worker to send back through the WhatsApp session.
// Auth: shared Bearer secret (WHATSAPP_WORKER_SECRET), same secret used for outbound /enqueue.
import { handleInboundMessage } from '@/lib/whatsapp-inbound'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  const secret = process.env.WHATSAPP_WORKER_SECRET
  const auth = req.headers.get('authorization') || ''
  if (!secret || auth !== `Bearer ${secret}`)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { from, text } = body
  if (!from) return Response.json({ error: 'from is required' }, { status: 400 })

  const { reply } = await handleInboundMessage(from, text)
  return Response.json({ reply })
}
