'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
  const [medicaments, setMedicaments] = useState<Medicament[]>([])
  const [search, setSearch] = useState('')
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

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Medicaments</h1>
          <p className="text-gray-500 text-sm">{total} medicaments au total</p>
        </div>
        <Link
          href="/medicaments/nouveau"
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          + Nouveau medicament
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher un medicament..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : medicaments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucun medicament trouve</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Nom</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Categorie</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Stock</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Prix vente</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {medicaments.map((med) => (
                <tr key={med.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{med.nom}</td>
                  <td className="px-6 py-4 text-gray-600">{med.categorie || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${med.stockTotal < med.stockMinimum ? 'text-red-500' : 'text-green-600'}`}>
                      {med.stockTotal} {med.unite}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{formatMontant(med.prixVente)}</td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/medicaments/${med.id}`}
                      className="text-green-600 hover:underline mr-3"
                    >
                      Voir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
