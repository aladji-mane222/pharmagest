'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatMontant, formatDateTime } from '@/lib/utils'

interface Vente {
  id: string
  montantTotal: number
  montantPaye: number
  modePaiement: string
  statut: string
  createdAt: string
  user: { nom: string }
  client?: { nom: string } | null
}

const STATUT_STYLE: Record<string, string> = {
  COMPLETE:  'bg-green-100 text-green-700',
  PARTIELLE: 'bg-orange-100 text-orange-700',
  ANNULEE:   'bg-red-100 text-red-700',
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
}

const LIMITE = 20

export default function HistoriqueVentesPage() {
  const { data: session } = useSession()
  const isCaissier = session?.user?.role === 'CAISSIER'

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

  return (
    <div className="p-8">
      {isCaissier && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
          Vous consultez uniquement vos propres ventes
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Historique des ventes</h1>
          {total > 0 && (
            <p className="text-gray-500 text-sm mt-1">
              {total} vente{total > 1 ? 's' : ''} au total
            </p>
          )}
        </div>
        <Link href="/ventes"
          className="text-sm text-green-600 hover:underline">
          ← Point de vente
        </Link>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow p-4 mb-6 flex flex-wrap items-end gap-4">
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
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
          <select
            value={statut}
            onChange={onFiltreChange(setStatut)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Tous</option>
            <option value="COMPLETE">Complètes</option>
            <option value="PARTIELLE">Crédit (partielles)</option>
            <option value="ANNULEE">Annulées</option>
          </select>
        </div>
        {(dateDebut || dateFin || statut) && (
          <button
            onClick={reinitialiser}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow overflow-hidden mb-4">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : ventes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucune vente trouvée</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
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
                <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                    {formatDateTime(v.createdAt)}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-800">{v.user.nom}</td>
                  <td className="px-6 py-4 text-gray-600">{v.client?.nom || '—'}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {MODE_LABELS[v.modePaiement] ?? v.modePaiement}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-green-600">
                    {formatMontant(v.montantTotal)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUT_STYLE[v.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUT_LABEL[v.statut] ?? v.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/ventes/${v.id}`}
                      className="text-green-600 hover:underline text-sm">
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} sur {totalPages} — {total} vente{total > 1 ? 's' : ''}
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