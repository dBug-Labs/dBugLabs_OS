'use client'

import { useState, useEffect } from 'react'

export default function CertificateLogs() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [batchDetail, setBatchDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [message, setMessage] = useState('')

  const fetchBatches = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/certificates/batches')
      if (res.ok) {
        const data = await res.json()
        setBatches(data.batches || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBatches()
  }, [])

  const loadBatchDetail = async (batchId) => {
    setSelectedBatch(batchId)
    setDetailLoading(true)
    setMessage('')
    try {
      const res = await fetch(`/api/certificates/batch/${batchId}`)
      if (res.ok) {
        const data = await res.json()
        setBatchDetail(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleResend = async (batchId) => {
    setResending(true)
    setMessage('')
    try {
      const res = await fetch(`/api/certificates/batch/${batchId}/resend`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setMessage(`Resend failed: ${data.error}`)
      } else {
        setMessage(`Requeued ${data.requeued} emails (${data.sentImmediately} sent immediately)`)
        loadBatchDetail(batchId)
        fetchBatches()
      }
    } catch {
      setMessage('Network error resending batch')
    } finally {
      setResending(false)
    }
  }

  const handleToggleRevoke = async (credentialId, currentRevoked) => {
    const reason = !currentRevoked ? prompt('Reason for revocation (optional):') : null
    try {
      const res = await fetch(`/api/certificates/${credentialId}/revoke`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoked: !currentRevoked, reason })
      })
      if (res.ok) {
        if (selectedBatch) loadBatchDetail(selectedBatch)
        fetchBatches()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const [activeTab, setActiveTab] = useState('batches') // 'batches' or 'logins'
  const [loginLogs, setLoginLogs] = useState([])
  const [loginLogsLoading, setLoginLogsLoading] = useState(false)

  const fetchLoginLogs = async () => {
    setLoginLogsLoading(true)
    try {
      const res = await fetch('/api/auth/logs')
      if (res.ok) {
        const data = await res.json()
        setLoginLogs(data.logs || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoginLogsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'logins') {
      fetchLoginLogs()
    }
  }, [activeTab])

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="heading-font display-title" style={{ fontSize: '28px', margin: '4px 0' }}>
          Operations & Audit Logs
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
          Review issued batches, monitor email delivery status, and inspect administrator login activity.
        </p>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            type="button"
            className={activeTab === 'batches' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '13px', padding: '8px 16px' }}
            onClick={() => setActiveTab('batches')}
          >
            Certificate Batches
          </button>
          <button
            type="button"
            className={activeTab === 'logins' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '13px', padding: '8px 16px' }}
            onClick={() => setActiveTab('logins')}
          >
            Login Activity
          </button>
        </div>
      </div>

      {activeTab === 'logins' ? (
        <div className="panel-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff' }}>Administrator Sign-In History</h3>
            <button
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '4px 12px' }}
              onClick={fetchLoginLogs}
            >
              Refresh
            </button>
          </div>

          {loginLogsLoading ? (
            <div style={{ color: 'var(--muted)', padding: '16px' }}>Loading sign-in history…</div>
          ) : loginLogs.length === 0 ? (
            <div style={{ color: 'var(--muted)', padding: '16px', textAlign: 'center' }}>No login records found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--panel-border)', textAlign: 'left', color: 'var(--dim)' }}>
                    <th style={{ padding: '10px 8px' }}>Timestamp</th>
                    <th style={{ padding: '10px 8px' }}>User / Name</th>
                    <th style={{ padding: '10px 8px' }}>IP Address</th>
                    <th style={{ padding: '10px 8px' }}>Result</th>
                    <th style={{ padding: '10px 8px' }}>Device / Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {loginLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 8px', color: 'var(--muted)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: '#fff' }}>
                        {log.name}
                      </td>
                      <td className="mono" style={{ padding: '10px 8px', color: 'var(--purple-soft)' }}>
                        {log.ip}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: log.success ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255, 45, 79, 0.15)',
                            color: log.success ? '#2ecc71' : 'var(--red-soft)'
                          }}
                        >
                          {log.success ? 'SUCCESS' : 'FAILED'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--dim)', fontSize: '11px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.userAgent}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : loading ? (
        <div style={{ color: 'var(--muted)', padding: '24px' }}>Loading batches…</div>
      ) : batches.length === 0 ? (
        <div className="panel-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
          No certificate batches issued yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedBatch ? '1fr 1.2fr' : '1fr', gap: '24px' }}>
          {/* Batches Table */}
          <div className="panel-card" style={{ padding: '16px', overflowX: 'auto' }}>
            <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '12px' }}>Batches</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--panel-border)', textAlign: 'left', color: 'var(--dim)' }}>
                  <th style={{ padding: '8px' }}>Date</th>
                  <th style={{ padding: '8px' }}>Title</th>
                  <th style={{ padding: '8px' }}>Total</th>
                  <th style={{ padding: '8px' }}>Sent</th>
                  <th style={{ padding: '8px' }}>Failed</th>
                  <th style={{ padding: '8px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr
                    key={b.batchId}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: selectedBatch === b.batchId ? 'rgba(255,45,79,0.06)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px 8px', color: 'var(--muted)' }}>
                      {new Date(b.issuedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 8px', fontWeight: 600, color: '#fff' }}>
                      {b.title}
                    </td>
                    <td style={{ padding: '10px 8px' }}>{b.total}</td>
                    <td style={{ padding: '10px 8px', color: '#2ecc71' }}>{b.sent}</td>
                    <td style={{ padding: '10px 8px', color: b.failed > 0 ? 'var(--red-soft)' : 'var(--muted)' }}>
                      {b.failed}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        onClick={() => loadBatchDetail(b.batchId)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Batch Details Modal / Panel */}
          {selectedBatch && (
            <div className="panel-card" style={{ padding: '20px' }}>
              {detailLoading ? (
                <div style={{ color: 'var(--muted)' }}>Loading batch details…</div>
              ) : batchDetail ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--red)', fontWeight: 800, textTransform: 'uppercase' }}>
                        {batchDetail.batchId}
                      </div>
                      <h2 style={{ fontSize: '20px', color: '#fff', marginTop: '2px' }}>{batchDetail.title}</h2>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {batchDetail.total} recipients · Issued {new Date(batchDetail.issuedAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      className="btn-primary"
                      disabled={resending}
                      style={{ fontSize: '12px', padding: '6px 14px' }}
                      onClick={() => handleResend(batchDetail.batchId)}
                    >
                      {resending ? 'Resending…' : 'Resend Failed'}
                    </button>
                  </div>

                  {message && (
                    <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', fontSize: '12px', marginBottom: '12px' }}>
                      {message}
                    </div>
                  )}

                  <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--panel-border)', textAlign: 'left', color: 'var(--dim)' }}>
                          <th style={{ padding: '6px' }}>ID</th>
                          <th style={{ padding: '6px' }}>Recipient</th>
                          <th style={{ padding: '6px' }}>Status</th>
                          <th style={{ padding: '6px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchDetail.recipients.map(r => (
                          <tr key={r.credentialId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td className="mono" style={{ padding: '8px 6px', color: 'var(--red-soft)' }}>
                              {r.credentialId}
                            </td>
                            <td style={{ padding: '8px 6px' }}>
                              <div style={{ color: '#fff', fontWeight: 600 }}>{r.name}</div>
                              <div style={{ color: 'var(--dim)', fontSize: '11px' }}>{r.email}</div>
                            </td>
                            <td style={{ padding: '8px 6px' }}>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  background: r.revoked ? 'rgba(255,45,79,0.2)' : r.mailStatus === 'sent' ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.1)',
                                  color: r.revoked ? 'var(--red)' : r.mailStatus === 'sent' ? '#2ecc71' : 'var(--muted)'
                                }}
                              >
                                {r.revoked ? 'Revoked' : r.mailStatus}
                              </span>
                            </td>
                            <td style={{ padding: '8px 6px' }}>
                              <button
                                className="btn-secondary"
                                style={{ padding: '2px 8px', fontSize: '11px', color: r.revoked ? '#2ecc71' : 'var(--red-soft)' }}
                                onClick={() => handleToggleRevoke(r.credentialId, r.revoked)}
                              >
                                {r.revoked ? 'Restore' : 'Revoke'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
