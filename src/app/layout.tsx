import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from '@/components/providers'
import OfflineBanner from '@/components/OfflineBanner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PharmaGest',
  description: 'Pilotee par vous, ou que vous soyez',
  manifest: '/manifest.json',
  themeColor: '#2ECC8A', // vert de marque — cohérent avec DESIGN-SYSTEM.md
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PharmaGest',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning : l'attribut class de <html> differe
    // volontairement entre le rendu serveur (jamais de "dark", le
    // serveur n'a pas acces a localStorage) et le premier rendu client
    // (le script ci-dessous l'ajoute avant hydratation si besoin) — sans
    // ca, React signale une erreur d'hydratation sur cet attribut precis
    // meme si le comportement est correct et volontaire.
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Anti-flash de theme : applique la classe "dark" AVANT que React
            hydrate la page, en lisant directement localStorage/la
            preference systeme — sinon on verrait un flash du theme clair
            pendant une fraction de seconde meme pour un utilisateur ayant
            choisi le theme sombre.
            IMPORTANT : next/script avec strategy="beforeInteractive" —
            PAS une balise <script> brute — c'est le mecanisme garanti
            par Next.js App Router pour executer un script avant
            l'hydratation React. Une balise <script> ordinaire placee
            directement dans le JSX du layout n'a pas cette garantie de
            timing avec l'App Router, ce qui empechait le theme de
            persister correctement au rechargement (trouve le
            02/08/2026). */}
        <Script id="theme-anti-flash" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var stocke = localStorage.getItem('pharmagest-theme');
                var sombre = stocke ? stocke === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (sombre) document.documentElement.classList.add('dark');
              } catch (e) {}
            })();
          `}
        </Script>
      </head>
      <body className={inter.className}>
        <Providers>
          <OfflineBanner />
          {children}
        </Providers>
      </body>
    </html>
  )
}