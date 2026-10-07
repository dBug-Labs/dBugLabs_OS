import { jsonResponse, errorResponse } from '@/lib/api'
import { getDb, ensureIndexes } from '@/lib/mongodb'

export async function GET(request, { params }) {
  const { credentialId } = await params
  if (!credentialId) return errorResponse('credentialId is required', 400)

  try {
    await ensureIndexes()
    const db = await getDb()
    const certsCollection = db.collection('certificates')

    const cert = await certsCollection.findOne({ credentialId })
    if (!cert) {
      return jsonResponse({
        status: 'not_found',
        credentialId
      }, 404)
    }

    if (cert.revoked) {
      return jsonResponse({
        status: 'revoked',
        credentialId: cert.credentialId,
        issuedToName: cert.issuedToName,
        title: cert.title,
        revokedAt: cert.revokedAt,
        revokedReason: cert.revokedReason
      }, 200)
    }

    return jsonResponse({
      status: 'valid',
      credentialId: cert.credentialId,
      code: cert.code,
      issuedToName: cert.issuedToName,
      issuedBy: cert.issuedBy,
      type: cert.type,
      title: cert.title,
      description: cert.description,
      driveLink: cert.driveLink,
      issuedAt: cert.issuedAt
    }, 200)
  } catch (err) {
    console.error('Verify API error:', err)
    return jsonResponse({
      status: 'unavailable',
      error: 'Database unavailable'
    }, 500)
  }
}
