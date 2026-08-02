'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import { Modal, useToast, Card, PageHeader, Button, Badge, EmptyState, SkeletonTable } from '@/components/ui'

interface Notification {
  id: string
  type: string
  titre: string
  message: string
  lien: string | null
  lu: boolean
  createdAt: string
}

const ICONES: Record<string, string> = {
  STOCK_BAS: '📦',
  PEREMPTION_PROCHE: '📅',
  VENTE_CREDIT: '💳',
  ECART_INVENTAIRE: '📋',
  COMMANDE_ECART: '🚚',
  REMBOURSEMENT_CREDIT: '💰',
  COMPTE_CREE: '👤',
  COMPTE_DESACTIVE: '👤',
  SESSION_CAISSE_LONGUE: '🕐',
  PERMISSION_ACCORDEE: '🔓',
  PERMISSION_RETIREE: '🔒',
  PERMISSION_EXPIRE_BIENTOT: '⏳',
  BACKUP_ECHEC: '💾',
  LICENCE_EXPIRE_BIENTOT: '📄',
}

const LIMITE = 20

export default function NotificationsPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filtre, setFiltre] = useState<'toutes' | 'non_lues' | 'lues'>('toutes')
  const [confirmSuppression, setConfirmSuppression] = useState<'lues' | 'tout' | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)

  const charger = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limite: String(LIMITE) })
    if (filtre !== 'toutes') params.set('filtre', filtre)
    fetch(`/api/notifications?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setNotifications(json.data?.notifications || [])
        setTotal(json.data?.total || 0)
        setTotalPages(json.data?.totalPages || 1)
        setLoading(false)
      })
  }, [page, filtre])

  useEffect(() => { charger() }, [charger])

  // Revenir a la page 1 a chaque changement de filtre
  useEffect(() => { setPage(1) }, [filtre])

  const basculerLu = async (n: Notification) => {
    setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, lu: !x.lu } : x))
    const res = await fetch(`/api/notifications/${n.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lu: !n.lu }),
    })
    if (!res.ok) {
      // Rollback si echec
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, lu: n.lu } : x))
      showToast('Erreur lors de la mise à jour', 'error')
    }
  }

  const supprimerUne = async (id: string) => {
    setNotifications((prev) => prev.filter((x) => x.id !== id))
    setTotal((t) => Math.max(0, t - 1))
    const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Notification supprimée', 'success')
    } else {
      showToast('Erreur lors de la suppression', 'error')
      charger()
    }
  }

  const allerAuLien = (n: Notification) => {
    if (n.lien) router.push(n.lien)
  }

  const toutMarquerLu = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })))
    await fetch('/api/notifications', { method: 'PATCH' })
    showToast('Toutes les notifications ont été marquées comme lues', 'success')
    charger()
  }

  const confirmerSuppressionMasse = async () => {
    if (!confirmSuppression) return
    setSuppressionEnCours(true)
    const res = await fetch(`/api/notifications?portee=${confirmSuppression}`, { method: 'DELETE' })
    if (res.ok) {
      showToast(
        confirmSuppression === 'tout' ? 'Toutes les notifications ont été supprimées' : 'Les notifications lues ont été supprimées',
        'success'
      )
      charger()
    } else {
      showToast('Erreur lors de la suppression', 'error')
    }
    setSuppressionEnCours(false)
    setConfirmSuppression(null)
  }

  const FILTRES = [
    { value: 'toutes' as const, label: 'Toutes' },
    { value: 'non_lues' as const, label: 'Non lues' },
    { value: 'lues' as const, label: 'Lues' },
  ]

  return (
    <div className="p-8">
      <PageHeader
        title="Notifications"
        description={total > 0 ? `${total} notification${total > 1 ? 's' : ''}` : undefined}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={toutMarquerLu}>
              Tout marquer comme lu
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmSuppression('lues')}>
              Supprimer les lues
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmSuppression('tout')}>
              Tout supprimer
            </Button>
          </>
        }
      />

      <div className="flex gap-2 mb-6">
        {FILTRES.map((f) => (
          <Button
            key={f.value}
            variant={filtre === f.value ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFiltre(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card padding="none" className="overflow-hidden mb-4">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={8} cols={3} />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="🔔"
            title={filtre === 'non_lues' ? 'Aucune notification non lue' : filtre === 'lues' ? 'Aucune notification lue' : 'Aucune notification'}
            description={filtre === 'toutes' ? 'Les événements importants de la pharmacie apparaîtront ici.' : undefined}
          />
        ) : (
          <ul>
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-4 px-6 py-4 border-b border-gray-100 last:border-0 transition-colors ${!n.lu ? 'bg-info-bg/40' : 'hover:bg-app-bg'}`}
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{ICONES[n.type] ?? '🔔'}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${!n.lu ? 'font-semibold text-navy' : 'text-gray-600'}`}>
                      {n.titre}
                    </p>
                    {!n.lu && <span className="w-2 h-2 rounded-full bg-info flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(n.createdAt)}</p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {n.lien && (
                    <button onClick={() => allerAuLien(n)} className="text-xs text-mint-dark hover:underline whitespace-nowrap">
                      Voir →
                    </button>
                  )}
                  <button onClick={() => basculerLu(n)} className="text-xs text-gray-400 hover:text-navy hover:underline whitespace-nowrap">
                    {n.lu ? 'Marquer non lu' : 'Marquer lu'}
                  </button>
                  <button onClick={() => supprimerUne(n.id)} className="text-xs text-danger hover:underline whitespace-nowrap">
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {page} sur {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              ← Précédent
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              Suivant →
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={!!confirmSuppression}
        onClose={() => setConfirmSuppression(null)}
        onConfirm={confirmerSuppressionMasse}
        title={confirmSuppression === 'tout' ? 'Tout supprimer ?' : 'Supprimer les notifications lues ?'}
        description={
          confirmSuppression === 'tout'
            ? 'Toutes tes notifications (lues et non lues) seront supprimées définitivement.'
            : 'Toutes les notifications déjà marquées comme lues seront supprimées définitivement.'
        }
        variant="danger"
        confirmLabel="Supprimer"
        loading={suppressionEnCours}
      />
    </div>
  )
}
