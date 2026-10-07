import crypto from 'crypto'
import { jsonResponse, errorResponse, requireAdmin, requireJsonContent } from '@/lib/api'
import { getDb, ensureIndexes } from '@/lib/mongodb'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_TYPES = ['participation', 'completion', 'appreciation', 'custom']

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

  const { recipients, type, title, description = null, driveLink = null } = body || {}

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return errorResponse('The CSV has no data rows.', 400)
  }

  if (recipients.length > 1000) {
    return errorResponse('Cannot issue more than 1,000 certificates in one run.', 400)
  }

  if (!VALID_TYPES.includes(type)) {
    return errorResponse('Invalid certificate type', 400)
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return errorResponse('Title is required', 400)
  }

  if (driveLink && !/^https?:\/\//i.test(driveLink)) {
    return errorResponse('Drive link must start with http:// or https://', 400)
  }

  // Validate recipients
  const invalidRows = []
  const countsByCode = {}

  recipients.forEach((r, idx) => {
    const rowNum = idx + 2
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    const email = typeof r.email === 'string' ? r.email.trim().toLowerCase() : ''
    let code = typeof r.code === 'string' ? r.code.trim().toUpperCase() : ''

    if (!name) {
      invalidRows.push({ row: rowNum, error: 'Name is missing' })
      return
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      invalidRows.push({ row: rowNum, error: 'Invalid email address' })
      return
    }
    if (!code || code.length > 12 || !/^[A-Z0-9]+$/.test(code)) {
      invalidRows.push({ row: rowNum, error: 'Code must be 1-12 alphanumeric characters' })
      return
    }

    countsByCode[code] = (countsByCode[code] || 0) + 1
  })

  if (invalidRows.length > 0) {
    return errorResponse(`${invalidRows.length} rows need fixing`, 400, {
      invalid: invalidRows.slice(0, 8)
    })
  }

  try {
    await ensureIndexes()
    const db = await getDb()
    const countersCollection = db.collection('counters')
    const certsCollection = db.collection('certificates')

    // Generate batchId
    const timestamp = Date.now()
    const hexSuffix = crypto.randomBytes(3).toString('hex')
    const batchId = `BATCH-${timestamp}-${hexSuffix}`

    // Year in 2 digits (e.g. "26")
    const yy = new Date().getFullYear().toString().slice(-2)

    // Atomic reservation for each code
    const codeSequences = {}
    for (const [code, count] of Object.entries(countsByCode)) {
      const counterId = `CERT-${code}-${yy}`
      const result = await countersCollection.findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: count } },
        { upsert: true, returnDocument: 'after' }
      )
      const endSeq = result.seq
      const startSeq = endSeq - count + 1
      codeSequences[code] = { current: startSeq }
    }

    // Build certificate documents
    const issuedAt = new Date()
    const certDocs = []
    const issuedList = []

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dbuglabs.org'

    for (const r of recipients) {
      const name = r.name.trim()
      const email = r.email.trim().toLowerCase()
      const code = r.code.trim().toUpperCase()

      const seqNum = codeSequences[code].current++
      const padded = String(seqNum).padStart(4, '0')
      const credentialId = `DBUG-${code}-${yy}-${padded}`
      const verifyUrl = `${appBaseUrl.replace(/\/$/, '')}/verify/${credentialId}`

      certDocs.push({
        credentialId,
        batchId,
        code,
        issuedToName: name,
        issuedToEmail: email,
        issuedBy: 'dBug Labs',
        type,
        title: title.trim(),
        description: description ? description.trim() : null,
        driveLink: driveLink ? driveLink.trim() : null,
        issuedAt,
        revoked: false,
        revokedAt: null,
        revokedReason: null,
        emailedAt: null
      })

      issuedList.push({
        credentialId,
        issuedToName: name,
        issuedToEmail: email,
        verifyUrl
      })
    }

    // Insert into MongoDB
    try {
      await certsCollection.insertMany(certDocs, { ordered: true })
    } catch (err) {
      console.error('Batch creation insert error:', err)
      // Roll back batch on failure
      await certsCollection.deleteMany({ batchId })
      return errorResponse('Failed to create batch records', 500)
    }

    return jsonResponse({
      batchId,
      count: certDocs.length,
      issued: issuedList
    }, 201)
  } catch (dbErr) {
    console.error('Database connection error in batch API:', dbErr)
    return errorResponse(`Database error: ${dbErr.message || 'Could not connect to MongoDB Atlas'}`, 500)
  }
}
