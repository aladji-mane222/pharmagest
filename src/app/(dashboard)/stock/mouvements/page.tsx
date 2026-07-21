
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDateTime, formatDate } from '@/lib/utils'

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

const BADGE: Record<string, { bg: string; label: string }> = {
  ENTREE:     { bg: 'bg-green-100 text-green-700',   label: 'Entrée' },
  SORTIE:     { bg: 'bg-red-100 text-red-700',       label: 'Sortie' },
  RETOUR:     { bg: 'bg-orange-100 text-orange-700', label: 'Retour' },
  AJUSTEMENT: { bg: 'bg-blue-100 text-blue-700',     label: 'Ajustement' },
}

function afficherQuantite(type: string, quantite: number) {
  if (type === 'ENTREE' || type === 'RETOUR') return { signe: `+${quantite}`, couleur: 'text-green-600' }
  if (type === 'SORTIE')                       return { signe: `-${quantite}`, couleur: 'text-red-600' }
  return                                               { signe: `${quantite}`,  couleur: 'text-blue-600' }
}

// Origine du mouvement (Phase 3.8) : un seul des trois champs relation
// est rempli selon le type. Pas de detail de commande/inventaire
// existant pour l'instant (voir tache a part "Detail et modification
// d'une commande" dans PLAN-CONSOLIDATION-SAAS.md) — on renvoie donc
// vers la liste plutot que vers une fiche individuelle pour ces deux cas.
function Origine({ m }: { m: Mouvement }) {
  if (m.vente) {
    return (
      <Link href={`/ventes/${m.vente.id}`} className="text-green-600 hover:underline">
        Vente {m.vente.numeroFacture || ''}
      </Link>
    )
  }
  if (m.commande) {
    return (
      <Link href="/fournisseurs/commandes" className="text-green-600 hover:underline">
        Commande {m.commande.numeroCommande || ''}
      </Link>
    )
  }
  if (m.inventaire) {
    return (
      <Link href="/inventaire" className="text-green-600 hover:underline">
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

  return (
    <div className="p-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Journal des mouvements</h1>
        <p className="text-gray-500 text-sm mt-1">
          {total > 0
            ? `${total} mouvement${total > 1 ? 's' : ''} au total`
            : 'Aucun mouvement enregistré'}
        </p>
      </div>

      {/* SECTION 1 — Filtres */}
      <div className="bg-white rounded-xl shadow p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={type}
            onChange={onFiltreChange(setType)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Tous les types</option>
            <option value="ENTREE">Entrée</option>
            <option value="SORTIE">Sortie</option>
            <option value="RETOUR">Retour</option>
            <option value="AJUSTEMENT">Ajustement</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={onFiltreChange(setDateDebut)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={onFiltreChange(setDateFin)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <button
          onClick={reinitialiser}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
        >
          Réinitialiser
        </button>
      </div>

      {/* SECTION 2 — Tableau */}
      <div className="bg-white rounded-xl shadow overflow-hidden mb-4">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : mouvements.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucun mouvement trouvé</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
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
                const badge = BADGE[m.type] ?? { bg: 'bg-gray-100 text-gray-600', label: m.type }
                const { signe, couleur } = afficherQuantite(m.type, m.quantite)
                return (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {m.medicament.nom}
                      <span className="ml-1 text-xs text-gray-400">{m.medicament.unite}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${badge.bg}`}>
                        {badge.label}
                      </span>
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
      </div>

      {/* SECTION 3 — Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} sur {totalPages} — {total} mouvement{total > 1 ? 's' : ''} au total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Précédent
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant →
            </button>
          </div>
        </div>
      )}

    </div>
  )
}