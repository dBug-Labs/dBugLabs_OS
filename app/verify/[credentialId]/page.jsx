import { getDb, ensureIndexes } from '@/lib/mongodb'

export async function generateMetadata({ params }) {
  const { credentialId } = await params
  return {
    title: `Certificate ${credentialId} — dBug Labs`,
    robots: { index: false, follow: false }
  }
}

export default async function VerifyPage({ params }) {
  const { credentialId } = await params

  let cert = null
  let isUnavailable = false

  try {
    await ensureIndexes()
    const db = await getDb()
    cert = await db.collection('certificates').findOne({ credentialId })
  } catch (err) {
    console.error('Verify lookup error:', err)
    isUnavailable = true
  }

  const issueYear = cert?.issuedAt ? new Date(cert.issuedAt).getFullYear() : new Date().getFullYear()
  const issueMonth = cert?.issuedAt ? new Date(cert.issuedAt).getMonth() + 1 : 1
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dbuglabs.org'
  const verifyUrl = `${appBaseUrl.replace(/\/$/, '')}/verify/${credentialId}`

  const linkedInParams = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: cert?.title || '',
    organizationName: 'dBug Labs',
    issueYear: issueYear.toString(),
    issueMonth: issueMonth.toString(),
    certId: credentialId,
    certUrl: verifyUrl
  })
  const linkedInUrl = `https://www.linkedin.com/profile/add?${linkedInParams.toString()}`

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div
        className="panel-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '36px 30px',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '2px', color: 'var(--red)', textTransform: 'uppercase', marginBottom: '8px' }}>
          dBug Labs Verification
        </div>

        {isUnavailable ? (
          <div>
            <h1 className="heading-font" style={{ fontSize: '24px', color: 'var(--red-soft)', marginBottom: '12px' }}>
              Service Unavailable
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              We could not connect to the verification database. Please try again in a few moments.
            </p>
          </div>
        ) : !cert ? (
          <div>
            <h1 className="heading-font" style={{ fontSize: '24px', color: 'var(--red-soft)', marginBottom: '12px' }}>
              Certificate Not Found
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
              No certificate with ID <strong className="mono" style={{ color: '#fff' }}>{credentialId}</strong> exists in our records.
            </p>
            <div style={{ fontSize: '12px', color: 'var(--dim)' }}>
              If you believe this is an error, please reach out to the dBug Labs team.
            </div>
          </div>
        ) : cert.revoked ? (
          <div>
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(255, 45, 79, 0.15)',
                color: 'var(--red-soft)',
                border: '1px solid var(--red)',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                marginBottom: '16px'
              }}
            >
              Revoked
            </div>
            <h1 className="heading-font" style={{ fontSize: '24px', color: '#fff', marginBottom: '8px' }}>
              This Certificate Has Been Revoked
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '16px' }}>
              Issued to <strong>{cert.issuedToName}</strong> for <strong>{cert.title}</strong>
            </p>
            {cert.revokedReason && (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--muted)',
                  marginBottom: '20px'
                }}
              >
                Reason: {cert.revokedReason}
              </div>
            )}
            <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>
              Credential ID: {cert.credentialId}
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(46, 204, 113, 0.15)',
                color: '#2ecc71',
                border: '1px solid #2ecc71',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                marginBottom: '16px'
              }}
            >
              ✓ Verified Genuine
            </div>

            <h1 className="heading-font display-title" style={{ fontSize: '28px', marginBottom: '6px' }}>
              Certificate of {cert.type.charAt(0).toUpperCase() + cert.type.slice(1)}
            </h1>

            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
              This document was officially issued by <strong>{cert.issuedBy}</strong>.
            </p>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--panel-border)',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'left',
                marginBottom: '24px'
              }}
            >
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--dim)' }}>Issued To</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                  {cert.issuedToName}
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--dim)' }}>Event / Achievement</div>
                <div style={{ fontSize: '15px', color: 'var(--text)', marginTop: '2px' }}>
                  {cert.title}
                </div>
                {cert.description && (
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                    {cert.description}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--dim)' }}>Issue Date</div>
                  <div style={{ fontSize: '13px', color: 'var(--text)', marginTop: '2px' }}>
                    {new Date(cert.issuedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--dim)' }}>Credential ID</div>
                  <div className="mono" style={{ fontSize: '13px', color: 'var(--red-soft)', marginTop: '2px' }}>
                    {cert.credentialId}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <a
                href={linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ textDecoration: 'none', fontSize: '13px' }}
              >
                Add to LinkedIn Profile
              </a>
              {cert.driveLink && (
                <a
                  href={cert.driveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ textDecoration: 'none', fontSize: '13px' }}
                >
                  Batch Drive Folder
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
