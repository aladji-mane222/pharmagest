'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatMontant } from '@/lib/utils'

interface Client {
  id: string
  nom: string
  telephone: string | null
  soldeCredit: number
  plafondCredit: number
}

function BarreProgression({ pct }: { pct: number }) {
  const couleur =
    pct > 80 ? 'bg-red-500' :
    pct > 50 ? 'bg-orange-400' :
               'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full ${couleur}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-medium ${pct > 80 ? 'text-red-600' : pct > 50 ? 'text-orange-500' : 'text-green-600'}`}>
        {pct}%
      </span>
    </div>
  )
}

export default function CreditsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/clients?avecCredit=true')
      .then((res) => res.json())
      .then((json) => {
        setClients(json.data || [])
        setLoading(false)
      })
  }, [])

  const totalDu = clients.reduce((sum, c) => sum + c.soldeCredit, 0)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Credits en cours</h1>
        <p className="text-gray-500 text-sm mt-1">
          Total du :{' '}
          <span className="font-semibold text-red-600">{formatMontant(totalDu)}</span>
          {clients.length > 0 && (
            <span className="ml-2 text-gray-400">— {clients.length} client{clients.length > 1 ? 's' : ''}</span>
          )}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucun credit en cours</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Nom</th>
                <th className="text-left px-6 py-3 text-gray-600">Telephone</th>
                <th className="text-right px-6 py-3 text-gray-600">Solde du</th>
                <th className="text-right px-6 py-3 text-gray-600">Plafond</th>
                <th className="text-left px-6 py-3 text-gray-600">% utilise</th>
                <th className="text-right px-6 py-3 text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const pct = c.plafondCredit > 0
                  ? Math.round((c.soldeCredit / c.plafondCredit) * 100)
                  : 100
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">{c.nom}</td>
                    <td className="px-6 py-4 text-gray-600">{c.telephone || '—'}</td>
                    <td className="px-6 py-4 text-right font-semibold text-red-600">
                      {formatMontant(c.soldeCredit)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {formatMontant(c.plafondCredit)}
                    </td>
                    <td className="px-6 py-4">
                      <BarreProgression pct={pct} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/clients/${c.id}`}
                        className="text-green-600 hover:text-green-800 text-xs font-medium"
                      >
                        Voir fiche
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
