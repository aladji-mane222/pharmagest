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

export default function MedicamentsPage() {
  const { data: sessionData } = useSession()
  const isAdmin = sessionData?.user?.role === 'ADMIN' || sessionData?.user?.role === 'SUPER_ADMIN'

  const [medicaments, setMedicaments] = useState<Medicament[]>([])
  const [search, setSearch] = useState('')
  const [categorieFiltree, setCategorieFiltree] = useState('')
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/medicaments?search=${search}`)
        .then((res) => res.json())
        .then((json) => {
          setMedicaments(json.data?.medicaments || [])
          setTotal(json.data?.total || 0)
          setLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Catégories uniques dérivées des médicaments chargés
  const categories = [...new Set(
    medicaments.map((m) => m.categorie).filter(Boolean)
  )] as string[]

  const medicamentsFiltres = categorieFiltree
    ? medicaments.filter((m) => m.categorie === categorieFiltree)
    : medicaments

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Médicaments</h1>
          <p className="text-gray-500 text-sm">{total} médicaments au total</p>
        </div>
        {isAdmin && (
          <Link
            href="/medicaments/nouveau"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            + Nouveau médicament
          </Link>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher un médicament..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select
          value={categorieFiltree}
          onChange={(e) => setCategorieFiltree(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-gray-700"
        >
          <option value="">Toutes catégories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : medicamentsFiltres.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucun médicament trouvé</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Nom</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Catégorie</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Stock</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Prix vente</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {medicamentsFiltres.map((med) => {
                const stockBas = med.stockTotal < med.stockMinimum
                return (
                  <tr key={med.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {med.nom}
                      {stockBas && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-medium ml-2">
                          Stock bas
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{med.categorie || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${stockBas ? 'text-red-500' : 'text-green-600'}`}>
                        {med.stockTotal} {med.unite}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatMontant(med.prixVente)}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/medicaments/${med.id}`}
                        className="text-green-600 hover:underline"
                      >
                        Voir
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
