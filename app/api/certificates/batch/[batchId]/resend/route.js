import { jsonResponse, errorResponse, requireAdmin } from '@/lib/api'
import { getDb, ensureIndexes } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mail'

export const maxDuration = 60

export async function POST(request, { params }) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const { batchId } = await params
  if (!batchId) return errorResponse('batchId is required', 400)

  await ensureIndexes()
  const db = await getDb()
  const outboxCollection = db.collection('mail_outbox')
  const certsCollection = db.collection('certificates')

  // Find failed/dead rows for this batch that still have the attachment
  const eligible = await outboxCollection.find({
    batchId,
    status: { $in: ['failed', 'dead'] },
    'attachment.contentBase64': { $exists: true }
  }).toArray()

  if (eligible.length === 0) {
    return errorResponse('No retryable emails found for this batch (spooled attachments may have expired after 48h)', 400)
  }

  // Reset to queued, reset attempts
  await outboxCollection.updateMany(
    {
      batchId,
      status: { $in: ['failed', 'dead'] },
      'attachment.contentBase64': { $exists: true }
    },
    {
      $set: {
        status: 'queued',
        attempts: 0,
        nextRetryAt: new Date(),
        lastError: null,
        updatedAt: new Date()
      }
    }
  )

  // Send the first few immediately
  let transporter
  try {
    transporter = getTransporter()
  } catch (err) {
    console.error('SMTP initialization error:', err)
  }

  let sentCount = 0
  const immediateItems = eligible.slice(0, 5)

  if (transporter) {
    for (const item of immediateItems) {
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
      } catch (sendErr) {
        await outboxCollection.updateOne(
          { _id: item._id },
          {
            $set: {
              status: 'failed',
              lastError: sendErr.message.slice(0, 500),
              attempts: 1,
              nextRetryAt: new Date(Date.now() + 60 * 1000),
              updatedAt: new Date()
            }
          }
        )
      }
    }
  }

  return jsonResponse({
    batchId,
    requeued: eligible.length,
    sentImmediately: sentCount
  }, 200)
}
