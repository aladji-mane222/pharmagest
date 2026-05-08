'use client'

import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white text-center py-2 text-sm font-medium">
      Vous etes hors ligne — les ventes seront synchronisees au retour de la connexion
    </div>
  )
}
