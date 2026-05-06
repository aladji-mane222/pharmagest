import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Protection routes superadmin
    if (pathname.startsWith('/superadmin') && token?.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Protection routes admin
    if (pathname.startsWith('/admin') && token?.role === 'CAISSIER') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/medicaments/:path*',
    '/ventes/:path*',
    '/stock/:path*',
    '/fournisseurs/:path*',
    '/clients/:path*',
    '/rapports/:path*',
    '/personnel/:path*',
    '/parametres/:path*',
    '/caisse/:path*',
    '/inventaire/:path*',
    '/depenses/:path*',
    '/superadmin/:path*',
  ],
}
