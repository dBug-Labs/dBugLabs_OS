import { jsonResponse, errorResponse, requireJsonContent } from '@/lib/api'
import { verifyPassword, createSessionCookieValue, SESSION_CONFIG } from '@/lib/session'
import { getDb, ensureIndexes } from '@/lib/mongodb'

// In-memory rate limiting map: ip -> { count, firstAttemptTime }
const rateLimitMap = new Map()
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 mins
const MAX_ATTEMPTS = 5

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request) {
  const jsonError = requireJsonContent(request)
  if (jsonError) return jsonError

  const ip = getClientIp(request)
  const now = Date.now()

  // Clean expired rate limit
  const rateLimit = rateLimitMap.get(ip)
  if (rateLimit) {
    if (now - rateLimit.firstAttemptTime > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip)
    } else if (rateLimit.count >= MAX_ATTEMPTS) {
      const waitMinutes = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - rateLimit.firstAttemptTime)) / 60000)
      const retryAfterSec = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - rateLimit.firstAttemptTime)) / 1000)
      return errorResponse(`Too many attempts. Try again in ${waitMinutes} min.`, 429, {
        retryAfter: retryAfterSec
      })
    }
  }

  let body
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid request body', 400)
  }

  const { name, password } = body || {}
  const adminName = typeof name === 'string' && name.trim() ? name.trim() : 'Admin'

  if (typeof password !== 'string') {
    return errorResponse('Password required', 400)
  }

  const isCorrect = await verifyPassword(password)
  const userAgent = request.headers.get('user-agent') || 'Unknown'

  // Log attempt to MongoDB
  try {
    await ensureIndexes()
    const db = await getDb()
    await db.collection('login_logs').insertOne({
      name: adminName,
      ip,
      userAgent,
      success: isCorrect,
      timestamp: new Date()
    })
  } catch (logErr) {
    console.error('Failed to save login log:', logErr.message)
  }

  if (!isCorrect) {
    // Record failed attempt
    const current = rateLimitMap.get(ip) || { count: 0, firstAttemptTime: now }
    current.count += 1
    rateLimitMap.set(ip, current)

    return errorResponse('Incorrect password', 401)
  }

  // Password correct: reset rate limit
  rateLimitMap.delete(ip)

  try {
    const cookieValue = await createSessionCookieValue(adminName)
    const isProd = process.env.NODE_ENV === 'production'
    const cookieHeader = `${SESSION_CONFIG.name}=${cookieValue}; Path=/; Max-Age=${SESSION_CONFIG.maxAge}; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`

    return jsonResponse({ ok: true, name: adminName }, 200, {
      'Set-Cookie': cookieHeader
    })
  } catch (err) {
    console.error('Session creation error:', err)
    return errorResponse('Server configuration error', 500)
  }
}
