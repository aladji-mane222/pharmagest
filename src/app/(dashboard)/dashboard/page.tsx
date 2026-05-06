'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatMontant, formatDateTime } from '@/lib/utils'

interface DashboardData {
  caJour: number
  caMois: number
  stockBas: number
  peremptions: number
  totalMedicaments: number
  stockBasDetails: { id: string; nom: string; lots: { quantite: number }[] }[]
  peremptionsDetails: { id: string; datePeremption: string; medicament: { nom: string } }[]
  ventesRecentes: { id: string; montantTotal: number; createdAt: string; user: { nom: string } }[]
}

export default function DashboardPage() {
  const { status } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/dashboard')
        .then((res) => res.json())
        .then((json) => {
          setData(json.data)
          setLoading(false)
        })
    }
  }, [status])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tableau de bord</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500">CA du jour</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatMontant(data?.caJour ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500">CA du mois</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatMontant(data?.caMois ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500">Stock bas</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">{data?.stockBas ?? 0} medicaments</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500">Peremptions 90j</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{data?.peremptions ?? 0} lots</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Alertes Stock Bas</h2>
          {data?.stockBasDetails.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune alerte</p>
          ) : (
            <ul className="space-y-2">
              {data?.stockBasDetails.map((med) => (
                <li key={med.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{med.nom}</span>
                  <span className="text-orange-500 font-medium">{med.lots.reduce((s, l) => s + l.quantite, 0)} unites</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Peremptions proches</h2>
          {data?.peremptionsDetails.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune alerte</p>
          ) : (
            <ul className="space-y-2">
              {data?.peremptionsDetails.map((lot) => (
                <li key={lot.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{lot.medicament.nom}</span>
                  <span className="text-red-500 font-medium">{formatDateTime(lot.datePeremption)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold text-gray-700 mb-4">Ventes recentes</h2>
        {data?.ventesRecentes.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucune vente pour le moment</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Date</th>
                <th className="pb-2">Caissier</th>
                <th className="pb-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {data?.ventesRecentes.map((vente) => (
                <tr key={vente.id} className="border-b last:border-0">
                  <td className="py-2 text-gray-600">{formatDateTime(vente.createdAt)}</td>
                  <td className="py-2 text-gray-600">{vente.user.nom}</td>
                  <td className="py-2 text-right font-medium text-green-600">{formatMontant(vente.montantTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
