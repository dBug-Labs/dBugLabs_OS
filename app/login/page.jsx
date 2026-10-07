import { Suspense } from 'react'
import LoginForm from './LoginForm'

export const metadata = {
  title: 'Sign In — dBugLabs_OS',
  robots: { index: false, follow: false }
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: '#07040a',
        backgroundImage: `
          radial-gradient(circle at 50% 20%, rgba(255, 45, 79, 0.12) 0%, transparent 45%),
          radial-gradient(circle at 20% 75%, rgba(139, 61, 255, 0.1) 0%, transparent 40%),
          radial-gradient(circle at 85% 70%, rgba(255, 45, 79, 0.08) 0%, transparent 40%)
        `,
        backgroundAttachment: 'fixed'
      }}
    >
      <div
        className="panel-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '40px 36px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.65), 0 0 1px 1px rgba(255, 255, 255, 0.05)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/logo.png"
            alt="dBug Labs"
            style={{
              height: '38px',
              width: 'auto',
              margin: '0 auto 20px auto',
              display: 'block'
            }}
          />
          <h1
            className="heading-font"
            style={{
              fontSize: '24px',
              color: '#ffffff',
              letterSpacing: '0.8px',
              fontWeight: 600
            }}
          >
            Operations Portal
          </h1>
          <p
            style={{
              color: 'var(--muted)',
              fontSize: '13.5px',
              marginTop: '6px',
              lineHeight: 1.5
            }}
          >
            Enter your credentials to access admin tools
          </p>
        </div>

        <Suspense fallback={<div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px' }}>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
