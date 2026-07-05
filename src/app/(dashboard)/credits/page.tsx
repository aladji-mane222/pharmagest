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

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-5 border border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function BarreProgression({ pct }: { pct: number }) {
  const couleur = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-orange-400' : 'bg-green-500'
  const texte   = pct > 80 ? 'text-red-600' : pct > 50 ? 'text-orange-500' : 'text-green-600'
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full ${couleur}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-medium ${texte}`}>{pct}%</span>
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

  const totalDu      = clients.reduce((sum, c) => sum + c.soldeCredit, 0)
  const plusGros     = clients[0] ?? null

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Crédits en cours</h1>
        <p className="text-gray-500 text-sm mt-1">Clients avec un solde crédit impayé</p>
      </div>

      {/* ── 3 KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard
          label="Total dû"
          value={formatMontant(totalDu)}
          sub="Toutes pharmacies confondues"
        />
        <KpiCard
          label="Clients avec crédit"
          value={loading ? '…' : String(clients.length)}
          sub={clients.length > 1 ? `${clients.length} clients` : clients.length === 1 ? '1 client' : 'Aucun'}
        />
        <KpiCard
          label="Plus gros débiteur"
          value={plusGros ? formatMontant(plusGros.soldeCredit) : '—'}
          sub={plusGros?.nom ?? 'Aucun crédit'}
        />
      </div>

      {/* ── Tableau ── */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucun crédit en cours</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Nom</th>
                <th className="text-left px-6 py-3 text-gray-600">Telephone</th>
                <th className="text-right px-6 py-3 text-gray-600">Solde dû</th>
                <th className="text-right px-6 py-3 text-gray-600">Plafond</th>
                <th className="text-left px-6 py-3 text-gray-600">% utilisé</th>
                <th className="text-right px-6 py-3 text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const pct = c.plafondCredit > 0
                  ? Math.round((c.soldeCredit / c.plafondCredit) * 100)
                  : 100

                const telNettoyé = c.telephone?.replace(/\D/g, '') ?? ''
                const messageWa  = encodeURIComponent(
                  `Bonjour ${c.nom}, votre solde crédit à la Pharmacie Centrale est de ${c.soldeCredit} GNF. Merci de régulariser.`
                )
                const lienWa = `https://wa.me/${telNettoyé}?text=${messageWa}`

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
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-3">
                        {c.telephone && (
                          <a
                            href={lienWa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-green-700 hover:text-green-900 whitespace-nowrap"
                            title={`Relancer ${c.nom} sur WhatsApp`}
                          >
                            📱 Relancer
                          </a>
                        )}
                        <Link
                          href={`/clients/${c.id}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        >
                          Voir fiche
                        </Link>
                      </div>
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
