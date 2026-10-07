'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      // Safe next redirect
      const rawNext = searchParams.get('next')
      let nextPath = '/admin/certificates'
      if (rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')) {
        nextPath = rawNext
      }

      router.push(nextPath)
      router.refresh()
    } catch {
      setError('Connection error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label
          htmlFor="admin-name"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--muted)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.8px'
          }}
        >
          Your Name
        </label>
        <input
          id="admin-name"
          type="text"
          required
          autoFocus
          className="input-field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex Sharma"
        />
      </div>

      <div>
        <label
          htmlFor="admin-password"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--muted)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.8px'
          }}
        >
          Admin Password
        </label>
        <input
          id="admin-password"
          type="password"
          required
          className="input-field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••••••"
        />
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(255, 45, 79, 0.1)',
            border: '1px solid rgba(255, 45, 79, 0.25)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: 'var(--red-soft)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        className="btn-primary"
        disabled={loading}
        style={{ width: '100%', marginTop: '6px', height: '46px', fontSize: '15px' }}
      >
        {loading ? 'Authenticating...' : 'Sign In'}
      </button>
    </form>
  )
}
