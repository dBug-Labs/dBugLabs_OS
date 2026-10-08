// lib/mongodb.js
import { MongoClient } from 'mongodb'
import { attachDatabasePool } from '@vercel/functions'

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || 'dbuglabs_os'

// Connect lazily, inside a request, never at module load. On Vercel an instance
// can be suspended between requests; a handshake started at import time gets
// frozen mid-flight and later fails with "secureConnect timed out" after far
// longer than connectTimeoutMS.
const clientOptions = {
  maxPoolSize: 10,
  maxIdleTimeMS: 5000, // drop idle sockets before a suspend can strand them
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
}

// Cached on global so dev hot reloads reuse one client.
const cache = global._mongo || (global._mongo = { client: null, promise: null })

function connect() {
  if (!uri) {
    return Promise.reject(new Error('Please define MONGODB_URI in your environment'))
  }
  if (!cache.promise) {
    const client = new MongoClient(uri, clientOptions)
    // Lets Vercel Fluid compute close idle pool connections before suspending.
    attachDatabasePool(client)
    cache.client = client
    cache.promise = client.connect().catch((err) => {
      // Don't cache a failed connect, or every later request on this
      // instance fails too. The next call starts a fresh client.
      cache.client = null
      cache.promise = null
      client.close().catch(() => {})
      throw err
    })
  }
  return cache.promise
}

export async function getDb() {
  let connectedClient
  try {
    connectedClient = await connect()
  } catch (err) {
    // One retry covers a transient network blip or a socket stranded by suspend.
    connectedClient = await connect()
  }
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
