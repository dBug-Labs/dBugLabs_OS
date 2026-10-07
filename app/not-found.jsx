import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center'
      }}
    >
      <div className="panel-card" style={{ maxWidth: '440px', padding: '36px 28px' }}>
        <h1 className="heading-font display-title" style={{ fontSize: '32px', marginBottom: '8px' }}>
          404
        </h1>
        <h2 style={{ fontSize: '18px', color: '#fff', marginBottom: '12px' }}>
          Page Not Found
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
          The page or route you are looking for does not exist.
        </p>
        <Link href="/admin/certificates" className="btn-primary" style={{ textDecoration: 'none' }}>
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}
