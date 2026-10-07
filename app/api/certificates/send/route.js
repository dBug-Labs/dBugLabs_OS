import { jsonResponse, errorResponse, requireAdmin, requireJsonContent } from '@/lib/api'
import { getDb, ensureIndexes } from '@/lib/mongodb'
import { getTransporter, buildCertificateEmail } from '@/lib/mail'

export const maxDuration = 60

export async function POST(request) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const jsonError = requireJsonContent(request)
  if (jsonError) return jsonError

  let body
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const { batchId, items } = body || {}

  if (!batchId || typeof batchId !== 'string') {
    return errorResponse('batchId is required', 400)
  }

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse('items must be a non-empty array', 400)
  }

  // Spec: chunk size <= 5, recommended <= 3
  if (items.length > 5) {
    return errorResponse('Too many items in one chunk (maximum 5)', 413)
  }

  await ensureIndexes()
  const db = await getDb()
  const certsCollection = db.collection('certificates')
  const outboxCollection = db.collection('mail_outbox')

  let transporter
  try {
    transporter = getTransporter()
  } catch (err) {
    console.error('SMTP initialization error:', err)
  }

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dbuglabs.org'
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  let sentCount = 0
  const failedList = []
  const deadList = []

  for (const item of items) {
    const { credentialId, imageBase64, mimeType = 'image/png' } = item
    if (!credentialId || !imageBase64) {
      deadList.push({ credentialId: credentialId || 'unknown', error: 'Missing credentialId or image data' })
      continue
    }

    const cert = await certsCollection.findOne({ batchId, credentialId })
    if (!cert) {
      deadList.push({ credentialId, error: 'Certificate record not found' })
      continue
    }

    const verifyUrl = `${appBaseUrl.replace(/\/$/, '')}/verify/${credentialId}`
    const mailData = buildCertificateEmail({
      recipientName: cert.issuedToName,
      recipientEmail: cert.issuedToEmail,
      title: cert.title,
      credentialId: cert.credentialId,
      code: cert.code,
      verifyUrl,
      driveLink: cert.driveLink,
      imageBase64,
      mimeType
    })

    // Upsert into mail_outbox
    const outboxRow = {
      batchId,
      refId: credentialId,
      kind: 'certificate',
      to: mailData.to,
      subject: mailData.subject,
      html: mailData.html,
      attachment: mailData.attachment,
      status: 'sending',
      attempts: 1,
      lastError: null,
      lastAttemptAt: now,
      sentAt: null,
      nextRetryAt: new Date(now.getTime() + 60 * 1000), // 1 min after 1st attempt
      createdAt: now,
      updatedAt: now,
      expiresAt
    }

    await outboxCollection.updateOne(
      { batchId, refId: credentialId },
      { $set: outboxRow },
      { upsert: true }
    )

    if (!transporter) {
      const errMessage = 'SMTP credentials not configured'
      await outboxCollection.updateOne(
        { batchId, refId: credentialId },
        {
          $set: {
            status: 'failed',
            lastError: errMessage,
            updatedAt: new Date()
          }
        }
      )
      failedList.push({ credentialId, error: errMessage })
      continue
    }

    try {
      await transporter.sendMail({
        from: mailData.from,
        to: mailData.to,
        subject: mailData.subject,
        html: mailData.html,
        attachments: [
          {
            filename: mailData.attachment.filename,
            content: Buffer.from(mailData.attachment.contentBase64, 'base64'),
            contentType: mailData.attachment.contentType,
            cid: mailData.attachment.cid,
            contentDisposition: 'attachment'
          }
        ]
      })

      // SMTP accepted
      const emailedAt = new Date()
      sentCount++

      // Unset attachment to free spool, update status
      await outboxCollection.updateOne(
        { batchId, refId: credentialId },
        {
          $set: {
            status: 'sent',
            sentAt: emailedAt,
            lastError: null,
            updatedAt: emailedAt
          },
          $unset: { attachment: '' }
        }
      )

      await certsCollection.updateOne(
        { credentialId },
        { $set: { emailedAt } }
      )
    } catch (sendErr) {
      const errMsg = (sendErr.message || 'SMTP error').slice(0, 500)
      console.error(`Send mail error for ${credentialId}:`, errMsg)

      // Transient vs permanent check
      const isPermanent = sendErr.responseCode && sendErr.responseCode >= 500 && sendErr.responseCode < 600
      const finalStatus = isPermanent ? 'dead' : 'failed'

      await outboxCollection.updateOne(
        { batchId, refId: credentialId },
        {
          $set: {
            status: finalStatus,
            lastError: errMsg,
            updatedAt: new Date()
          }
        }
      )

      if (finalStatus === 'dead') {
        deadList.push({ credentialId, error: errMsg })
      } else {
        failedList.push({ credentialId, error: errMsg })
      }
    }
  }

  return jsonResponse({
    batchId,
    sent: sentCount,
    failed: failedList,
    dead: deadList
  }, 200)
}
