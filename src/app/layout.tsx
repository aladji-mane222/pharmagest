import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
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
    <html lang="fr">
      <body className={inter.className}>
        <Providers>
          <OfflineBanner />
          {children}
        </Providers>
      </body>
    </html>
  )
}
