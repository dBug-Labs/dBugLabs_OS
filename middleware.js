import { NextResponse } from 'next/server'
import { verifySessionCookie } from './lib/session'

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // Guard /admin routes
  if (pathname.startsWith('/admin')) {
    const sessionCookie = request.cookies.get('dbos_session')?.value
    const isValid = await verifySessionCookie(sessionCookie)

    if (!isValid) {
      const loginUrl = new URL('/login', request.url)
      // Only keep local relative return path
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl, 307)
    }
  }

  // Guard /login route for already signed in users
  if (pathname === '/login') {
    const sessionCookie = request.cookies.get('dbos_session')?.value
    const isValid = await verifySessionCookie(sessionCookie)
    if (isValid) {
      return NextResponse.redirect(new URL('/admin/certificates', request.url), 307)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/login']
}
