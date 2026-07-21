'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatMontant, formatDate } from '@/lib/utils'
import ImportModal, { ImportField } from '@/components/ui/ImportModal'

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
  produitDormant: boolean
  lots: Lot[]
}

const CHAMPS_IMPORT_STOCK: ImportField[] = [
  { key: 'nomMedicament', label: 'Medicament', required: true, guessKeywords: ['medicament', 'nom', 'designation', 'produit'] },
  { key: 'numeroLot', label: 'Numero de lot', guessKeywords: ['lot', 'numero lot'] },
  { key: 'datePeremption', label: 'Date de peremption', required: true, guessKeywords: ['peremption', 'expiration', 'date'] },
  { key: 'quantite', label: 'Quantite', required: true, guessKeywords: ['quantite', 'qte', 'stock'] },
  { key: 'prixAchat', label: 'Prix d\'achat', guessKeywords: ['prix achat', 'pu achat', 'achat'] },
]

export default function StockPage() {
  const { data: sessionData } = useSession()
  const isAdmin = sessionData?.user?.role === 'ADMIN' || sessionData?.user?.role === 'SUPER_ADMIN'

  const [stock, setStock] = useState<MedicamentStock[]>([])
  const [valeurTotale, setValeurTotale] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<'tous' | 'bas' | 'critiques' | 'dormants'>('tous')
  const [selected, setSelected] = useState<MedicamentStock | null>(null)
  const [importOuvert, setImportOuvert] = useState(false)

  const chargerStock = () => {
    fetch('/api/stock')
      .then((res) => res.json())
      .then((json) => {
        setStock(json.data?.stock || [])
        setValeurTotale(json.data?.valeurTotale || 0)
        setLoading(false)
      })
  }

  useEffect(() => {
    chargerStock()
  }, [])

  const stockFiltre = stock.filter((med) => {
    if (filtre === 'bas') return med.stockBas
    if (filtre === 'critiques') return med.lotsCritiques > 0
    if (filtre === 'dormants') return med.produitDormant
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
          {isAdmin && (
            <button
              onClick={() => setImportOuvert(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Importer le stock initial
            </button>
          )}
          <Link
            href="/stock/mouvements"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            🔄 Mouvements
          </Link>
          <div className="flex gap-2">
            {(['tous', 'bas', 'critiques', 'dormants'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltre(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filtre === f ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'tous' ? 'Tous' : f === 'bas' ? 'Stock bas' : f === 'critiques' ? 'Péremptions' : 'Dormants'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ImportModal
        open={importOuvert}
        onClose={() => setImportOuvert(false)}
        title="Importer le stock initial"
        fields={CHAMPS_IMPORT_STOCK}
        apiEndpoint="/api/stock/import"
        templateHref="/modeles/stock-modele.xlsx"
        onImported={() => chargerStock()}
      />

      <div className="grid grid-cols-4 gap-6 mb-6">
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
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Produits dormants</p>
          <p className="text-2xl font-bold text-blue-400">{stock.filter((m) => m.produitDormant).length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Aucune vente depuis 90 jours</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* ── Tableau principal ── */}
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
                <tr
                  key={med.id}
                  onClick={() => setSelected(med)}
                  className={`border-b last:border-0 cursor-pointer transition-colors ${
                    selected?.id === med.id
                      ? 'bg-green-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{med.nom}</td>
                  <td className={`px-4 py-3 text-right font-medium ${med.stockBas ? 'text-red-500' : 'text-green-600'}`}>
                    {med.stockTotal} {med.unite}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{med.stockMinimum}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {med.prixAchat ? formatMontant(med.stockTotal * med.prixAchat) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {med.stockBas && (
                      <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs">Bas</span>
                    )}
                    {med.lotsCritiques > 0 && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-600 rounded-full text-xs ml-1">Péremption</span>
                    )}
                    {med.produitDormant && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-500 rounded-full text-xs ml-1">Dormant</span>
                    )}
                    {!med.stockBas && med.lotsCritiques === 0 && !med.produitDormant && (
                      <span className="px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Panneau détail ── */}
        <div className="bg-white rounded-xl shadow p-6">
          {selected ? (
            <>
              <div className="flex items-start justify-between mb-4">
                <h2 className="font-semibold text-gray-700">{selected.nom}</h2>
                <Link
                  href={`/medicaments/${selected.id}`}
                  className="text-xs text-green-600 hover:underline whitespace-nowrap ml-2"
                >
                  Fiche →
                </Link>
              </div>
              <p className="text-sm text-gray-500 mb-3">Lots actifs</p>
              {selected.lots.length === 0 ? (
                <p className="text-gray-400 text-sm">Aucun lot</p>
              ) : (
                <ul className="space-y-3">
                  {selected.lots.map((lot) => (
                    <li key={lot.id} className="border rounded-lg p-3 text-sm">
                      <p className="font-medium">{lot.numeroLot || 'Sans numéro'}</p>
                      <p className="text-gray-500">Expire : {formatDate(lot.datePeremption)}</p>
                      <p className="text-green-600 font-medium">{lot.quantite} unités</p>
                    </li>
                  ))}
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