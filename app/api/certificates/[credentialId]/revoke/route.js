import { jsonResponse, errorResponse, requireAdmin, requireJsonContent } from '@/lib/api'
import { getDb, ensureIndexes } from '@/lib/mongodb'

export async function PATCH(request, { params }) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const jsonError = requireJsonContent(request)
  if (jsonError) return jsonError

  const { credentialId } = await params
  if (!credentialId) return errorResponse('credentialId is required', 400)

  let body
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const { revoked, reason = null } = body || {}

  if (typeof revoked !== 'boolean') {
    return errorResponse('revoked must be a boolean', 400)
  }

  if (revoked && reason && typeof reason === 'string' && reason.length > 300) {
    return errorResponse('reason must be 300 characters or less', 400)
  }

  await ensureIndexes()
  const db = await getDb()
  const certsCollection = db.collection('certificates')

  const existing = await certsCollection.findOne({ credentialId })
  if (!existing) {
    return errorResponse('Certificate not found', 404)
  }

  const now = new Date()
  const updateFields = {
    revoked,
    revokedAt: revoked ? (existing.revokedAt || now) : null,
    revokedReason: revoked ? (reason ? reason.trim() : existing.revokedReason) : null
  }

  await certsCollection.updateOne(
    { credentialId },
    { $set: updateFields }
  )

  return jsonResponse({
    credentialId,
    revoked: updateFields.revoked,
    revokedAt: updateFields.revokedAt,
    revokedReason: updateFields.revokedReason
  }, 200)
}
