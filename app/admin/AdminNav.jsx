'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  const isGen = pathname === '/admin/certificates'
  const isLogs = pathname.startsWith('/admin/certificates/logs')

  return (
    <header
      style={{
        borderBottom: '1px solid var(--panel-border)',
        background: 'rgba(8, 5, 10, 0.85)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link href="/admin/certificates" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <img
              src="/logo.png"
              alt="dBug Labs"
              style={{
                height: '32px',
                width: 'auto',
                display: 'block',
                objectFit: 'contain'
              }}
            />
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link
              href="/admin/certificates"
              style={{
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600,
                color: isGen ? '#fff' : 'var(--muted)',
                borderBottom: isGen ? '2px solid var(--red)' : '2px solid transparent',
                paddingBottom: '4px',
                transition: 'color 0.15s'
              }}
            >
              Generator
            </Link>
            <Link
              href="/admin/certificates/logs"
              style={{
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600,
                color: isLogs ? '#fff' : 'var(--muted)',
                borderBottom: isLogs ? '2px solid var(--red)' : '2px solid transparent',
                paddingBottom: '4px',
                transition: 'color 0.15s'
              }}
            >
              Certificate Log
            </Link>
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="btn-secondary"
          style={{ fontSize: '13px', padding: '6px 14px' }}
        >
          Sign Out
        </button>
      </div>
    </header>
  )
}
