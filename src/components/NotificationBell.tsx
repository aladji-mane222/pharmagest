'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/ui'

interface Notification {
  id: string
  type: string
  titre: string
  message: string
  lien: string | null
  lu: boolean
  createdAt: string
}

const INTERVALLE_POLLING_MS = 30_000

function ilYA(dateStr: string): string {
  const secondes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (secondes < 60) return "à l'instant"
  const minutes = Math.floor(secondes / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `il y a ${heures}h`
  const jours = Math.floor(heures / 24)
  return `il y a ${jours}j`
}

// Cloche de notifications internes — Phase 6 (27/07/2026). Interroge
// l'API par sondage (pas d'infrastructure temps-reel existante dans le
// projet type websocket/SSE) toutes les 30s. Un toast s'affiche pour
// toute notification apparue depuis le dernier sondage, en plus de la
// liste persistante dans le menu deroulant.
export default function NotificationBell() {
  const { status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [nonLues, setNonLues] = useState(0)
  const [ouvert, setOuvert] = useState(false)
  const dernierIdConnuRef = useRef<string | null>(null)
  const premierChargementRef = useRef(true)
  const conteneurRef = useRef<HTMLDivElement>(null)

  const charger = async () => {
    const res = await fetch('/api/notifications')
    if (!res.ok) return
    const json = await res.json()
    const nouvelles: Notification[] = json.data?.notifications || []

    // Toast pour toute notification plus recente que la derniere connue
    // (jamais au tout premier chargement de la page, sinon ca spamme des
    // toasts pour tout l'historique existant a l'ouverture de l'app).
    if (!premierChargementRef.current && dernierIdConnuRef.current) {
      const indexDerniereConnue = nouvelles.findIndex((n) => n.id === dernierIdConnuRef.current)
      const fraiches = indexDerniereConnue === -1 ? [] : nouvelles.slice(0, indexDerniereConnue)
      for (const n of fraiches.reverse()) {
        showToast(n.titre, 'info')
      }
    }

    if (nouvelles.length > 0) dernierIdConnuRef.current = nouvelles[0].id
    premierChargementRef.current = false
    setNotifications(nouvelles)
    setNonLues(json.data?.nonLues || 0)
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    charger()
    const interval = setInterval(charger, INTERVALLE_POLLING_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Fermer au clic en dehors
  useEffect(() => {
    const onClickDehors = (e: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false)
      }
    }
    document.addEventListener('mousedown', onClickDehors)
    return () => document.removeEventListener('mousedown', onClickDehors)
  }, [])

  const ouvrirNotification = async (n: Notification) => {
    if (!n.lu) {
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, lu: true } : x))
      setNonLues((c) => Math.max(0, c - 1))
      fetch(`/api/notifications/${n.id}`, { method: 'PATCH' }).catch(() => {})
    }
    setOuvert(false)
    if (n.lien) router.push(n.lien)
  }

  const toutMarquerLu = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })))
    setNonLues(0)
    fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
  }

  if (status !== 'authenticated') return null

  return (
    <div ref={conteneurRef} className="relative">
      <button
        onClick={() => setOuvert((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-white/10"
        title="Notifications"
      >
        <span className="text-lg">🔔</span>
        {nonLues > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {nonLues > 9 ? '9+' : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute left-0 top-11 z-50 w-80 max-h-[70vh] overflow-y-auto bg-surface rounded-card shadow-lg border border-gray-100">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-navy">Notifications</p>
            {nonLues > 0 && (
              <button onClick={toutMarquerLu} className="text-xs text-mint-dark hover:underline">
                Tout marquer comme lu
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-400 text-center">Aucune notification</p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => ouvrirNotification(n)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-app-bg transition-colors ${!n.lu ? 'bg-info-bg/40' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.lu && <span className="w-2 h-2 rounded-full bg-info mt-1.5 flex-shrink-0" />}
                      <div className={n.lu ? 'ml-4' : ''}>
                        <p className={`text-sm ${!n.lu ? 'font-semibold text-navy' : 'text-gray-600'}`}>
                          {n.titre}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{ilYA(n.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
