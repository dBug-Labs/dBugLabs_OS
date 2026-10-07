import { NextResponse } from 'next/server'
import { verifySessionCookie } from '@/lib/session'

export function jsonResponse(data, status = 200, headers = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      ...headers
    }
  })
}

export function errorResponse(message, status = 400, extra = {}) {
  return jsonResponse({ error: message, ...extra }, status)
}

export async function requireAdmin(request) {
  const sessionCookie = request.cookies.get('dbos_session')?.value
  const isValid = await verifySessionCookie(sessionCookie)
  if (!isValid) {
    return errorResponse('Not signed in', 401)
  }
  return null
}

export function requireJsonContent(request) {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return errorResponse('Content-Type must be application/json', 415)
  }
  return null
}
