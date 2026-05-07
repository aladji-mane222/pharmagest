'use client'

import { useEffect, useState } from 'react'
import { formatMontant, formatDateTime } from '@/lib/utils'

interface LigneVente {
  id: string
  quantite: number
  prixUnitaire: number
  medicament: { nom: string }
}

interface Vente {
  id: string
  montantTotal: number
  montantPaye: number
  monnaie: number
  modePaiement: string
  statut: string
  createdAt: string
  user: { nom: string }
  lignes: LigneVente[]
}

export default function HistoriqueVentesPage() {
  const [ventes, setVentes] = useState<Vente[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Vente | null>(null)

  useEffect(() => {
    fetch('/api/ventes')
      .then((res) => res.json())
      .then((json) => {
        setVentes(json.data || [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Historique des ventes</h1>
        <a href="/ventes" className="text-green-600 hover:underline text-sm">Retour au POS</a>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Detail vente</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <p className="text-sm text-gray-500 mb-1">Date : {formatDateTime(selected.createdAt)}</p>
            <p className="text-sm text-gray-500 mb-4">Caissier : {selected.user.nom}</p>
            <table className="w-full text-sm mb-4">
              <thead><tr className="border-b">
                <th className="text-left py-1">Medicament</th>
                <th className="text-center py-1">Qte</th>
                <th className="text-right py-1">Total</th>
              </tr></thead>
              <tbody>
                {selected.lignes.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="py-1">{l.medicament.nom}</td>
                    <td className="py-1 text-center">{l.quantite}</td>
                    <td className="py-1 text-right">{formatMontant(l.prixUnitaire * l.quantite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between font-bold text-green-600">
              <span>Total</span>
              <span>{formatMontant(selected.montantTotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Monnaie</span>
              <span>{formatMontant(selected.monnaie)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {ventes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucune vente</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Date</th>
                <th className="text-left px-6 py-3 text-gray-600">Caissier</th>
                <th className="text-left px-6 py-3 text-gray-600">Mode</th>
                <th className="text-right px-6 py-3 text-gray-600">Montant</th>
                <th className="text-center px-6 py-3 text-gray-600">Statut</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {ventes.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600">{formatDateTime(v.createdAt)}</td>
                  <td className="px-6 py-4">{v.user.nom}</td>
                  <td className="px-6 py-4 text-gray-600">{v.modePaiement}</td>
                  <td className="px-6 py-4 text-right font-medium text-green-600">{formatMontant(v.montantTotal)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.statut === 'COMPLETE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {v.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => setSelected(v)} className="text-green-600 hover:underline text-sm">Voir</button>
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
