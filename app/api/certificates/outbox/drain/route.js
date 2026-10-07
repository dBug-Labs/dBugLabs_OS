import { jsonResponse, errorResponse } from '@/lib/api'
import { getDb, ensureIndexes } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mail'

export const maxDuration = 60

async function handleDrain(request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return errorResponse('CRON_SECRET not configured on server', 503)
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return errorResponse('Unauthorized cron trigger', 401)
  }

  await ensureIndexes()
  const db = await getDb()
  const outboxCollection = db.collection('mail_outbox')
  const certsCollection = db.collection('certificates')

  const now = new Date()

  // Claim up to 20 due items: status in ['queued', 'failed'], or stuck 'sending' for > 3 mins
  const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000)

  const dueItems = await outboxCollection.find({
    $or: [
      { status: 'queued' },
      { status: 'failed', nextRetryAt: { $lte: now } },
      { status: 'sending', lastAttemptAt: { $lt: threeMinutesAgo } }
    ],
    'attachment.contentBase64': { $exists: true }
  }).limit(20).toArray()

  let transporter
  try {
    transporter = getTransporter()
  } catch (err) {
    console.error('SMTP initialization error during drain:', err)
  }

  let sentCount = 0
  let failedCount = 0
  let deadCount = 0

  const retryDelaysMs = [
    1 * 60 * 1000,   // after attempt 1: 1 min
    5 * 60 * 1000,   // after attempt 2: 5 min
    15 * 60 * 1000,  // after attempt 3: 15 min
    60 * 60 * 1000   // after attempt 4: 60 min
  ]

  for (const item of dueItems) {
    const attempts = (item.attempts || 0) + 1
    const claimTime = new Date()

    // Atomically claim
    const claimed = await outboxCollection.findOneAndUpdate(
      { _id: item._id },
      {
        $set: {
          status: 'sending',
          attempts,
          lastAttemptAt: claimTime,
          updatedAt: claimTime
        }
      },
      { returnDocument: 'after' }
    )

    if (!claimed) continue

    if (!transporter) {
      await outboxCollection.updateOne(
        { _id: item._id },
        {
          $set: {
            status: 'failed',
            lastError: 'SMTP not configured',
            updatedAt: new Date()
          }
        }
      )
      failedCount++
      continue
    }

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || `"dBug Labs" <${process.env.SMTP_USER}>`,
        to: item.to,
        subject: item.subject,
        html: item.html,
        attachments: [
          {
            filename: item.attachment.filename,
            content: Buffer.from(item.attachment.contentBase64, 'base64'),
            contentType: item.attachment.contentType,
            cid: item.attachment.cid,
            contentDisposition: 'attachment'
          }
        ]
      })

      const emailedAt = new Date()
      sentCount++

      await outboxCollection.updateOne(
        { _id: item._id },
        {
          $set: {
            status: 'sent',
            sentAt: emailedAt,
            updatedAt: emailedAt,
            lastError: null
          },
          $unset: { attachment: '' }
        }
      )

      await certsCollection.updateOne(
        { credentialId: item.refId },
        { $set: { emailedAt } }
      )
    } catch (err) {
      const errMsg = (err.message || 'SMTP error').slice(0, 500)
      const isPermanent = err.responseCode && err.responseCode >= 500 && err.responseCode < 600

      if (isPermanent || attempts >= 5) {
        deadCount++
        await outboxCollection.updateOne(
          { _id: item._id },
          {
            $set: {
              status: 'dead',
              lastError: errMsg,
              updatedAt: new Date()
            }
          }
        )
      } else {
        failedCount++
        const delay = retryDelaysMs[attempts - 1] || 60 * 60 * 1000
        await outboxCollection.updateOne(
          { _id: item._id },
          {
            $set: {
              status: 'failed',
              lastError: errMsg,
              nextRetryAt: new Date(Date.now() + delay),
              updatedAt: new Date()
            }
          }
        )
      }
    }
  }

  // Count remaining
  const remaining = await outboxCollection.countDocuments({
    status: { $in: ['queued', 'failed'] },
    'attachment.contentBase64': { $exists: true }
  })

  return jsonResponse({
    sent: sentCount,
    failed: failedCount,
    dead: deadCount,
    remaining
  }, 200)
}

export async function GET(request) {
  return handleDrain(request)
}

export async function POST(request) {
  return handleDrain(request)
}
