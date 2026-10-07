import { jsonResponse } from '@/lib/api'
import { SESSION_CONFIG } from '@/lib/session'

export async function POST() {
  const cookieHeader = `${SESSION_CONFIG.name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  return jsonResponse({ ok: true }, 200, {
    'Set-Cookie': cookieHeader
  })
}
