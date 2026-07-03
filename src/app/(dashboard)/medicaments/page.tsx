'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatMontant } from '@/lib/utils'

interface Medicament {
  id: string
  nom: string
  categorie: string | null
  prixVente: number
  stockTotal: number
  stockMinimum: number
  unite: string
}

const CATEGORIES = [
  'Analgésique', 'Antibiotique', 'Antipaludéen', 'Anti-inflammatoire',
  'Antidiarrhéique', 'Antiparasitaire', 'Vitamine', 'Autre',
]

export default function MedicamentsPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  const [medicaments, setMedicaments] = useState<Medicament[]>([])
  const [search,      setSearch]      = useState('')
  const [categorie,   setCategorie]   = useState('')
  const [loading,     setLoading]     = useState(true)
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const LIMITE = 20

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search, page: String(page), limite: String(LIMITE) })
      if (categorie) params.set('categorie', categorie)

      fetch(`/api/medicaments?${params.toString()}`)
        .then((res) => res.json())
        .then((json) => {
          setMedicaments(json.data?.medicaments || [])
          setTotal(json.data?.total || 0)
          setLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [search, categorie, page])

  const onFiltreChange = (setter: (v: string) => void) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setter(e.target.value)
    setPage(1)
  }

  const totalPages = Math.ceil(total / LIMITE)

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Médicaments</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} médicament{total > 1 ? 's' : ''} au total</p>
        </div>
        {isAdmin && (
          <Link
            href="/medicaments/nouveau"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
            + Nouveau médicament
          </Link>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Rechercher un médicament..."
          value={search}
          onChange={onFiltreChange(setSearch)}
          className="flex-1 max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select
          value={categorie}
          onChange={onFiltreChange(setCategorie)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {(search || categorie) && (
          <button
            onClick={() => { setSearch(''); setCategorie(''); setPage(1) }}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
            Réinitialiser
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden mb-4">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : medicaments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucun médicament trouvé</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Nom</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Catégorie</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Stock</th>
                <th className="text-right px-6 py-3 text-gray-600 font-medium">Prix vente</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {medicaments.map((med) => (
                <tr key={med.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{med.nom}</td>
                  <td className="px-6 py-4 text-gray-600">{med.categorie || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${med.stockTotal < med.stockMinimum ? 'text-red-500' : 'text-green-600'}`}>
                        {med.stockTotal} {med.unite}
                      </span>
                      {med.stockTotal < med.stockMinimum && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                          Stock bas
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">{formatMontant(med.prixVente)}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/medicaments/${med.id}`}
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
            Page {page} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              ← Précédent
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              Suivant →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}