'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatMontant, formatDateTime } from '@/lib/utils'
import { Card, PageHeader, Button, Badge, EmptyState, Select, SkeletonTable } from '@/components/ui'

interface Vente {
  id: string
  montantTotal: number
  montantPaye: number
  modePaiement: string
  paiements?: { modePaiement: string; montant: number }[]
  statut: string
  createdAt: string
  user: { nom: string }
  client?: { nom: string } | null
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral'

const STATUT_BADGE: Record<string, BadgeVariant> = {
  COMPLETE:  'success',
  PARTIELLE: 'warning',
  ANNULEE:   'danger',
}

const STATUT_LABEL: Record<string, string> = {
  COMPLETE:  'Complète',
  PARTIELLE: 'Crédit',
  ANNULEE:   'Annulée',
}

const MODE_LABELS: Record<string, string> = {
  ESPECES:           'Espèces',
  MOBILE_MONEY:      'Mobile Money',
  ORANGE_MONEY:      'Orange Money',
  MTN_MONEY:         'MTN Money',
  PAIEMENT_MARCHAND: 'Paiement Marchand',
  CARTE:             'Carte',
  CREDIT:            'Crédit',
  MIXTE:             'Mixte',
}

const LIMITE = 20

export default function HistoriqueVentesPage() {
  const { data: session } = useSession()
  const isCaissier = session?.user?.role === 'CAISSIER' && !session?.user?.permissions?.includes('HISTORIQUE_COMPLET')

  const [ventes,     setVentes]     = useState<Vente[]>([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)

  // Filtres
  const [dateDebut,  setDateDebut]  = useState('')
  const [dateFin,    setDateFin]    = useState('')
  const [statut,     setStatut]     = useState('')

  const totalPages = Math.ceil(total / LIMITE)

  const charger = (p: number, debut: string, fin: string, s: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limite: String(LIMITE) })
    if (debut) params.set('dateDebut', debut)
    if (fin)   params.set('dateFin',   fin)
    if (s)     params.set('statut',    s)

    fetch(`/api/ventes?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setVentes(json.data?.ventes || json.data || [])
        setTotal(json.data?.total   || 0)
        setLoading(false)
      })
  }

  useEffect(() => {
    charger(page, dateDebut, dateFin, statut)
  }, [page, dateDebut, dateFin, statut])

  const reinitialiser = () => {
    setDateDebut('')
    setDateFin('')
    setStatut('')
    setPage(1)
  }

  const onFiltreChange = (setter: (v: string) => void) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setter(e.target.value)
    setPage(1)
  }

  const filtresActifs = !!(dateDebut || dateFin || statut)

  return (
    <div className="p-8">
      {isCaissier && (
        <div className="mb-4 bg-info-bg border border-info/20 rounded-card px-4 py-2.5 text-sm text-info-text">
          Vous consultez uniquement vos propres ventes
        </div>
      )}

      <PageHeader
        title="Historique des ventes"
        description={total > 0 ? `${total} vente${total > 1 ? 's' : ''} au total` : undefined}
        actions={
          <Link href="/ventes" className="text-sm text-mint-dark hover:underline">
            ← Point de vente
          </Link>
        }
      />

      {/* Filtres */}
      <Card padding="sm" className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={onFiltreChange(setDateDebut)}
            className="px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-mint/50 focus:border-mint"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={onFiltreChange(setDateFin)}
            className="px-3 py-2 border border-gray-300 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-mint/50 focus:border-mint"
          />
        </div>
        <Select label="Statut" value={statut} onChange={onFiltreChange(setStatut)}>
          <option value="">Tous</option>
          <option value="COMPLETE">Complètes</option>
          <option value="PARTIELLE">Crédit (partielles)</option>
          <option value="ANNULEE">Annulées</option>
        </Select>
        {filtresActifs && (
          <Button variant="secondary" onClick={reinitialiser}>
            Réinitialiser
          </Button>
        )}
      </Card>

      {/* Tableau */}
      <Card padding="none" className="overflow-hidden mb-4">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={8} cols={7} />
          </div>
        ) : ventes.length === 0 ? (
          <EmptyState
            icon="🧾"
            title={filtresActifs ? 'Aucune vente ne correspond' : 'Aucune vente trouvée'}
            description={filtresActifs ? 'Essayez une autre période ou un autre statut.' : undefined}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-app-bg border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Date</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Caissier</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Client</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Mode</th>
                <th className="text-right px-6 py-3 text-gray-600 font-medium">Montant</th>
                <th className="text-center px-6 py-3 text-gray-600 font-medium">Statut</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {ventes.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 last:border-0 hover:bg-app-bg">
                  <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                    {formatDateTime(v.createdAt)}
                  </td>
                  <td className="px-6 py-4 font-medium text-navy">{v.user.nom}</td>
                  <td className="px-6 py-4 text-gray-600">{v.client?.nom || '—'}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {MODE_LABELS[v.modePaiement] ?? v.modePaiement}
                    {v.modePaiement === 'MIXTE' && v.paiements && v.paiements.length > 0 && (
                      <span className="block text-xs text-gray-400">
                        {v.paiements.map((p) => `${MODE_LABELS[p.modePaiement] ?? p.modePaiement} ${formatMontant(p.montant)}`).join(' + ')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-success">
                    {formatMontant(v.montantTotal)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge variant={STATUT_BADGE[v.statut] ?? 'neutral'}>
                      {STATUT_LABEL[v.statut] ?? v.statut}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/ventes/${v.id}`} className="text-mint-dark hover:underline text-sm">
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} sur {totalPages} — {total} vente{total > 1 ? 's' : ''}
          </p>
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
    </div>
  )
}
