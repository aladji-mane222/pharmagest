
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDateTime, formatDate } from '@/lib/utils'
import { Card, PageHeader, EmptyState, Badge, Button, Select, Input, SkeletonTable } from '@/components/ui'

interface Mouvement {
  id: string
  type: 'ENTREE' | 'SORTIE' | 'RETOUR' | 'AJUSTEMENT'
  quantite: number
  createdAt: string
  medicament: { nom: string; unite: string }
  user: { nom: string } | null
  vente: { id: string; numeroFacture: string | null } | null
  commande: { id: string; numeroCommande: string | null } | null
  inventaire: { id: string; createdAt: string } | null
}

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

const BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  ENTREE:     { variant: 'success', label: 'Entrée' },
  SORTIE:     { variant: 'danger',  label: 'Sortie' },
  RETOUR:     { variant: 'warning', label: 'Retour' },
  AJUSTEMENT: { variant: 'info',    label: 'Ajustement' },
}

function afficherQuantite(type: string, quantite: number) {
  if (type === 'ENTREE' || type === 'RETOUR') return { signe: `+${quantite}`, couleur: 'text-success' }
  if (type === 'SORTIE')                       return { signe: `-${quantite}`, couleur: 'text-danger' }
  return                                               { signe: `${quantite}`,  couleur: 'text-info' }
}

// Origine du mouvement (Phase 3.8) : un seul des trois champs relation
// est rempli selon le type. Pas de detail de commande/inventaire
// existant pour l'instant (voir tache a part "Detail et modification
// d'une commande" dans PLAN-CONSOLIDATION-SAAS.md) — on renvoie donc
// vers la liste plutot que vers une fiche individuelle pour ces deux cas.
function Origine({ m }: { m: Mouvement }) {
  if (m.vente) {
    return (
      <Link href={`/ventes/${m.vente.id}`} className="text-mint-dark hover:underline">
        Vente {m.vente.numeroFacture || ''}
      </Link>
    )
  }
  if (m.commande) {
    return (
      <Link href={`/fournisseurs/commandes?commandeId=${m.commande.id}`} className="text-mint-dark hover:underline">
        Commande {m.commande.numeroCommande || ''}
      </Link>
    )
  }
  if (m.inventaire) {
    return (
      <Link href="/inventaire" className="text-mint-dark hover:underline">
        Inventaire du {formatDate(m.inventaire.createdAt)}
      </Link>
    )
  }
  return <span className="text-gray-400">—</span>
}

export default function MouvementsStockPage() {
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]       = useState(true)

  const [type,      setType]      = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin,   setDateFin]   = useState('')
  const [page,      setPage]      = useState(1)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (type)      params.set('type',      type)
    if (dateDebut) params.set('dateDebut', dateDebut)
    if (dateFin)   params.set('dateFin',   dateFin)

    fetch(`/api/stock/mouvements?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setMouvements(json.data?.mouvements || [])
        setTotal(json.data?.total           || 0)
        setTotalPages(json.data?.totalPages || 1)
        setLoading(false)
      })
  }, [type, dateDebut, dateFin, page])

  // Remet page à 1 quand un filtre change
  const onFiltreChange =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setter(e.target.value)
      setPage(1)
    }

  const reinitialiser = () => {
    setType('')
    setDateDebut('')
    setDateFin('')
    setPage(1)
  }

  const filtresActifs = !!(type || dateDebut || dateFin)

  return (
    <div className="p-8">
      <Link href="/stock" className="text-sm text-gray-500 hover:text-mint-dark hover:underline mb-4 inline-block">
        ← Retour au stock
      </Link>

      <PageHeader
        title="Journal des mouvements"
        description={total > 0 ? `${total} mouvement${total > 1 ? 's' : ''} au total` : 'Aucun mouvement enregistré'}
      />

      {/* SECTION 1 — Filtres */}
      <Card padding="sm" className="mb-6 flex flex-wrap items-end gap-4">
        <Select label="Type" value={type} onChange={onFiltreChange(setType)}>
          <option value="">Tous les types</option>
          <option value="ENTREE">Entrée</option>
          <option value="SORTIE">Sortie</option>
          <option value="RETOUR">Retour</option>
          <option value="AJUSTEMENT">Ajustement</option>
        </Select>

        <Input label="Du" type="date" value={dateDebut} onChange={onFiltreChange(setDateDebut)} />

        <Input label="Au" type="date" value={dateFin} onChange={onFiltreChange(setDateFin)} />

        <Button variant="secondary" onClick={reinitialiser}>
          Réinitialiser
        </Button>
      </Card>

      {/* SECTION 2 — Tableau */}
      <Card padding="none" className="overflow-hidden mb-4">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={8} cols={6} />
          </div>
        ) : mouvements.length === 0 ? (
          <EmptyState
            icon="🔄"
            title={filtresActifs ? 'Aucun mouvement ne correspond' : 'Aucun mouvement enregistré'}
            description={filtresActifs ? 'Essayez une autre période ou un autre type.' : 'Les mouvements de stock apparaîtront ici.'}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-app-bg border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Date / Heure</th>
                <th className="text-left px-6 py-3 text-gray-600">Médicament</th>
                <th className="text-center px-6 py-3 text-gray-600">Type</th>
                <th className="text-right px-6 py-3 text-gray-600">Quantité</th>
                <th className="text-left px-6 py-3 text-gray-600">Effectué par</th>
                <th className="text-left px-6 py-3 text-gray-600">Origine</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.map((m) => {
                const badge = BADGE[m.type] ?? { variant: 'neutral' as const, label: m.type }
                const { signe, couleur } = afficherQuantite(m.type, m.quantite)
                return (
                  <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-app-bg">
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="px-6 py-4 font-medium text-navy">
                      {m.medicament.nom}
                      <span className="ml-1 text-xs text-gray-400">{m.medicament.unite}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    <td className={`px-6 py-4 text-right font-semibold ${couleur}`}>
                      {signe}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {m.user?.nom || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Origine m={m} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* SECTION 3 — Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} sur {totalPages} — {total} mouvement{total > 1 ? 's' : ''} au total
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