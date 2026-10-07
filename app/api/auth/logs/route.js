import { jsonResponse, errorResponse, requireAdmin } from '@/lib/api'
import { getDb, ensureIndexes } from '@/lib/mongodb'

export async function GET(request) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  try {
    await ensureIndexes()
    const db = await getDb()
    const logs = await db.collection('login_logs')
      .find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray()

    const formatted = logs.map(l => ({
      id: l._id.toString(),
      name: l.name || 'Unknown',
      ip: l.ip || 'Unknown',
      userAgent: l.userAgent || 'Unknown',
      success: Boolean(l.success),
      timestamp: l.timestamp
    }))

    return jsonResponse({ logs: formatted }, 200)
  } catch (err) {
    console.error('Error fetching login logs:', err)
    return errorResponse('Failed to fetch login logs', 500)
  }
}
