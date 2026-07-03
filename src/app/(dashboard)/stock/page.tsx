'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatMontant, formatDate } from '@/lib/utils'

interface Lot {
  id: string
  numeroLot: string | null
  datePeremption: string
  quantite: number
}

interface MedicamentStock {
  id: string
  nom: string
  categorie: string | null
  unite: string
  prixVente: number
  prixAchat: number | null
  stockMinimum: number
  stockTotal: number
  stockBas: boolean
  lotsCritiques: number
  lots: Lot[]
}

export default function StockPage() {
  const [stock,        setStock]        = useState<MedicamentStock[]>([])
  const [valeurTotale, setValeurTotale] = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [filtre,       setFiltre]       = useState<'tous' | 'bas' | 'critiques'>('tous')
  const [selected,     setSelected]     = useState<MedicamentStock | null>(null)

  useEffect(() => {
    fetch('/api/stock')
      .then((res) => res.json())
      .then((json) => {
        setStock(json.data?.stock || [])
        setValeurTotale(json.data?.valeurTotale || 0)
        setLoading(false)
      })
  }, [])

  const stockFiltre = stock.filter((med) => {
    if (filtre === 'bas')      return med.stockBas
    if (filtre === 'critiques') return med.lotsCritiques > 0
    return true
  })

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Stock</h1>
          <p className="text-gray-500 text-sm mt-1">
            Valeur totale : <span className="font-semibold text-blue-600">{formatMontant(valeurTotale)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {(['tous', 'bas', 'critiques'] as const).map((f) => (
              <button key={f} onClick={() => setFiltre(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filtre === f ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {f === 'tous' ? 'Tous' : f === 'bas' ? 'Stock bas' : 'Péremptions'}
              </button>
            ))}
          </div>
          <Link
            href="/stock/mouvements"
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
            🔄 Mouvements
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Total médicaments</p>
          <p className="text-2xl font-bold text-gray-800">{stock.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Stock bas</p>
          <p className="text-2xl font-bold text-orange-500">{stock.filter((m) => m.stockBas).length}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Lots critiques</p>
          <p className="text-2xl font-bold text-red-500">{stock.filter((m) => m.lotsCritiques > 0).length}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600">Médicament</th>
                <th className="text-right px-4 py-3 text-gray-600">Stock</th>
                <th className="text-right px-4 py-3 text-gray-600">Min</th>
                <th className="text-right px-4 py-3 text-gray-600">Valeur</th>
                <th className="text-center px-4 py-3 text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody>
              {stockFiltre.map((med) => (
                <tr key={med.id}
                  onClick={() => setSelected(med)}
                  className={`border-b last:border-0 hover:bg-gray-50 cursor-pointer ${selected?.id === med.id ? 'bg-green-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{med.nom}</td>
                  <td className={`px-4 py-3 text-right font-medium ${med.stockBas ? 'text-red-500' : 'text-green-600'}`}>
                    {med.stockTotal} {med.unite}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{med.stockMinimum}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {med.prixAchat ? formatMontant(med.stockTotal * med.prixAchat) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {med.stockBas && (
                      <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs">Bas</span>
                    )}
                    {med.lotsCritiques > 0 && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-600 rounded-full text-xs ml-1">Péremption</span>
                    )}
                    {!med.stockBas && med.lotsCritiques === 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Panneau détail lots */}
        <div className="bg-white rounded-xl shadow p-6">
          {selected ? (
            <>
              <div className="flex justify-between items-start mb-3">
                <h2 className="font-semibold text-gray-700">{selected.nom}</h2>
                <Link href={`/medicaments/${selected.id}`}
                  className="text-xs text-green-600 hover:underline">
                  Fiche →
                </Link>
              </div>
              <p className="text-sm text-gray-500 mb-3">Lots actifs</p>
              {selected.lots.length === 0 ? (
                <p className="text-gray-400 text-sm">Aucun lot</p>
              ) : (
                <ul className="space-y-3">
                  {selected.lots.map((lot) => {
                    const jours = Math.ceil(
                      (new Date(lot.datePeremption).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    )
                    return (
                      <li key={lot.id} className="border rounded-lg p-3 text-sm">
                        <p className="font-medium text-gray-800">{lot.numeroLot || 'Sans numéro'}</p>
                        <p className={`text-xs mt-0.5 ${jours <= 90 ? 'text-orange-500 font-medium' : 'text-gray-500'}`}>
                          Expire : {formatDate(lot.datePeremption)}
                          {jours <= 90 && ` (J-${jours})`}
                        </p>
                        <p className="text-green-600 font-medium mt-1">{lot.quantite} unités</p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-sm text-center mt-8">
              Cliquez sur un médicament pour voir ses lots
            </p>
          )}
        </div>
      </div>
    </div>
  )
}