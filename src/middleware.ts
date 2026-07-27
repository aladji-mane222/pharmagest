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

    // Rapports (dont /rapports/audit) — Admin uniquement par defaut. Les
    // API correspondantes bloquaient deja CAISSIER (403), mais la PAGE
    // elle-meme restait accessible en tapant l'URL directement, avec un
    // flash de la sidebar avant que les appels API echouent — trouve en
    // testant reellement le 23/07/2026. Corrige ici, au meme niveau que
    // /admin et /credits. Exception : caissier ayant recu la permission
    // supplementaire ACCES_RAPPORTS (27/07/2026).
    if (
      pathname.startsWith('/rapports') &&
      token?.role === 'CAISSIER' &&
      !(token?.permissions as string[] | undefined)?.includes('ACCES_RAPPORTS')
    ) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Personnel — Admin uniquement, meme constat que /rapports
    if (pathname.startsWith('/personnel') && token?.role === 'CAISSIER') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Inventaire — Admin uniquement par defaut (decision Nabe le
    // 27/07/2026, suite a l'audit Phase 5), sauf caissier ayant recu la
    // permission supplementaire INVENTAIRE_COMPLET (embarquee dans le
    // JWT a la connexion — voir lib/auth.ts).
    if (
      pathname.startsWith('/inventaire') &&
      token?.role === 'CAISSIER' &&
      !(token?.permissions as string[] | undefined)?.includes('INVENTAIRE_COMPLET')
    ) {
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
    '/credits/:path*',
    '/superadmin/:path*',
  ],
}