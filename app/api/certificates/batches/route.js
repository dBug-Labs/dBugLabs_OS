import { jsonResponse, errorResponse, requireAdmin } from '@/lib/api'
import { getDb, ensureIndexes } from '@/lib/mongodb'

export async function GET(request) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  await ensureIndexes()
  const db = await getDb()
  const certsCollection = db.collection('certificates')
  const outboxCollection = db.collection('mail_outbox')

  // Aggregate batches from certificates
  const batches = await certsCollection.aggregate([
    {
      $group: {
        _id: '$batchId',
        title: { $first: '$title' },
        type: { $first: '$type' },
        issuedAt: { $first: '$issuedAt' },
        total: { $sum: 1 },
        emailedCount: {
          $sum: { $cond: [{ $ne: ['$emailedAt', null] }, 1, 0] }
        },
        revokedCount: {
          $sum: { $cond: [{ $eq: ['$revoked', true] }, 1, 0] }
        }
      }
    },
    { $sort: { issuedAt: -1 } }
  ]).toArray()

  // For each batch, get outbox summary to see active failures
  const batchSummaries = await Promise.all(batches.map(async (b) => {
    const outboxCounts = await outboxCollection.aggregate([
      { $match: { batchId: b._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray()

    const outboxMap = {}
    outboxCounts.forEach(item => {
      outboxMap[item._id] = item.count
    })

    return {
      batchId: b._id,
      title: b.title,
      type: b.type,
      issuedAt: b.issuedAt,
      total: b.total,
      sent: b.emailedCount,
      failed: (outboxMap['failed'] || 0) + (outboxMap['dead'] || 0),
      queued: (outboxMap['queued'] || 0) + (outboxMap['sending'] || 0),
      revoked: b.revokedCount
    }
  }))

  return jsonResponse({ batches: batchSummaries }, 200)
}
