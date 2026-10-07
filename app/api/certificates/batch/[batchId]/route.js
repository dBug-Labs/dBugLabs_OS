import { jsonResponse, errorResponse, requireAdmin } from '@/lib/api'
import { getDb, ensureIndexes } from '@/lib/mongodb'

export async function GET(request, { params }) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const { batchId } = await params
  if (!batchId) return errorResponse('batchId is required', 400)

  await ensureIndexes()
  const db = await getDb()
  const certsCollection = db.collection('certificates')
  const outboxCollection = db.collection('mail_outbox')

  const certificates = await certsCollection
    .find({ batchId })
    .sort({ issuedAt: 1, credentialId: 1 })
    .toArray()

  if (certificates.length === 0) {
    return errorResponse('Batch not found', 404)
  }

  const outboxRows = await outboxCollection.find({ batchId }).toArray()
  const outboxByRef = {}
  outboxRows.forEach(row => {
    outboxByRef[row.refId] = row
  })

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dbuglabs.org'

  const recipients = certificates.map(cert => {
    const ob = outboxByRef[cert.credentialId]
    return {
      credentialId: cert.credentialId,
      code: cert.code,
      name: cert.issuedToName,
      email: cert.issuedToEmail,
      revoked: cert.revoked,
      revokedReason: cert.revokedReason,
      emailedAt: cert.emailedAt,
      mailStatus: ob ? ob.status : (cert.emailedAt ? 'sent' : 'none'),
      lastError: ob ? ob.lastError : null,
      verifyUrl: `${appBaseUrl.replace(/\/$/, '')}/verify/${cert.credentialId}`
    }
  })

  const first = certificates[0]
  return jsonResponse({
    batchId,
    title: first.title,
    type: first.type,
    description: first.description,
    driveLink: first.driveLink,
    issuedAt: first.issuedAt,
    total: certificates.length,
    recipients
  }, 200)
}
