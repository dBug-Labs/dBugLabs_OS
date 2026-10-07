// lib/mongodb.js
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || 'dbuglabs_os'

let client
let clientPromise

if (!process.env.MONGODB_URI) {
  // If not configured, clientPromise will reject when awaited
  clientPromise = Promise.reject(new Error('Please define MONGODB_URI in your environment'))
} else {
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri)
      global._mongoClientPromise = client.connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    client = new MongoClient(uri)
    clientPromise = client.connect()
  }
}

export async function getDb() {
  const connectedClient = await clientPromise
  return connectedClient.db(dbName)
}

let indexesEnsured = false
export async function ensureIndexes() {
  if (indexesEnsured) return
  try {
    const db = await getDb()

    // certificates indexes
    const certs = db.collection('certificates')
    await certs.createIndex({ credentialId: 1 }, { unique: true })
    await certs.createIndex({ batchId: 1, issuedAt: -1 })
    await certs.createIndex({ issuedAt: -1 })

    // mail_outbox indexes
    const outbox = db.collection('mail_outbox')
    await outbox.createIndex({ batchId: 1, refId: 1 }, { unique: true })
    await outbox.createIndex({ status: 1, nextRetryAt: 1 })
    await outbox.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })

    // login_logs indexes
    const loginLogs = db.collection('login_logs')
    await loginLogs.createIndex({ timestamp: -1 })

    indexesEnsured = true
  } catch (err) {
    console.error('Error ensuring indexes:', err)
  }
}
