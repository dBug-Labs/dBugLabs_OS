// lib/session.js
// Uses Web Crypto API for compatibility across middleware and route handlers (AUTH requirements)

const COOKIE_NAME = 'dbos_session'
const MAX_AGE_SECONDS = 12 * 60 * 60 // 12 hours

function getSigningKeyString() {
  const secret = process.env.SESSION_SECRET || ''
  const password = process.env.ADMIN_PASSWORD || ''
  if (!secret || !password) return null
  return `${secret}:${password}`
}

async function getHmacKey(keyString) {
  const enc = new TextEncoder()
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(keyString),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlToUint8Array(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function createSessionCookieValue(adminName = 'Admin') {
  const keyString = getSigningKeyString()
  if (!keyString) throw new Error('Missing SESSION_SECRET or ADMIN_PASSWORD')

  const expiresAtMs = Date.now() + MAX_AGE_SECONDS * 1000
  const safeName = encodeURIComponent(String(adminName || 'Admin').trim())
  const payload = `${expiresAtMs}:${safeName}`
  const enc = new TextEncoder()
  const key = await getHmacKey(keyString)
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const signature = bufferToBase64Url(signatureBuffer)

  return `${payload}.${signature}`
}

export async function verifySessionCookie(cookieValue) {
  try {
    if (!cookieValue || typeof cookieValue !== 'string') return false
    const parts = cookieValue.split('.')
    if (parts.length !== 2) return false

    const [payload, signatureStr] = parts
    const payloadParts = payload.split(':')
    const expiresAtStr = payloadParts[0]
    const adminName = payloadParts[1] ? decodeURIComponent(payloadParts[1]) : 'Admin'

    if (!/^\d+$/.test(expiresAtStr)) return false

    const expiresAt = parseInt(expiresAtStr, 10)
    if (Date.now() >= expiresAt) return false

    const keyString = getSigningKeyString()
    if (!keyString) return false

    const key = await getHmacKey(keyString)
    const enc = new TextEncoder()
    const signatureBytes = base64UrlToUint8Array(signatureStr)

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      enc.encode(payload)
    )

    if (!isValid) return false
    return { valid: true, adminName }
  } catch {
    return false
  }
}

export async function verifyPassword(candidate) {
  if (typeof candidate !== 'string') return false
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return false

  const enc = new TextEncoder()
  const [aBuffer, bBuffer] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(candidate)),
    crypto.subtle.digest('SHA-256', enc.encode(adminPassword))
  ])

  const a = new Uint8Array(aBuffer)
  const b = new Uint8Array(bBuffer)
  let diff = 0
  for (let i = 0; i < 32; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

export const SESSION_CONFIG = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE_SECONDS
}
