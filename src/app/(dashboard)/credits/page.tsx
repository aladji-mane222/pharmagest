'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatMontant } from '@/lib/utils'
import { useToast } from '@/components/ui'

interface Client {
  id: string
  nom: string
  telephone: string | null
  soldeCredit: number
  plafondCredit: number
}

function BarreProgression({ pct }: { pct: number }) {
  const couleur = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-orange-400' : 'bg-green-500'
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
  const { showToast } = useToast()
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

  const totalDu       = clients.reduce((sum, c) => sum + c.soldeCredit, 0)
  const plusGrosDebiteur = clients.length > 0
    ? clients.reduce((max, c) => c.soldeCredit > max.soldeCredit ? c : max, clients[0])
    : null

  const envoyerWhatsApp = (client: Client) => {
    if (!client.telephone) { showToast('Ce client n\'a pas de numéro de téléphone enregistré', 'error'); return }
    const numero  = client.telephone.replace(/\D/g, '')
    const message = encodeURIComponent(
      `Bonjour ${client.nom},\n\nNous vous rappelons que vous avez un solde de crédit de ${client.soldeCredit.toLocaleString('fr-FR')} GNF en attente de règlement.\n\nMerci de bien vouloir régulariser votre situation.\n\nCordialement,\nVotre pharmacie`
    )
    window.open(`https://wa.me/${numero}?text=${message}`, '_blank')
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Crédits en cours</h1>
      </div>

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-sm text-gray-500 mb-1">Total dû</p>
            <p className="text-2xl font-bold text-red-600">{formatMontant(totalDu)}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-sm text-gray-500 mb-1">Clients avec crédit</p>
            <p className="text-2xl font-bold text-gray-800">
              {clients.length}
              <span className="text-sm font-normal text-gray-400 ml-1">
                client{clients.length > 1 ? 's' : ''}
              </span>
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-sm text-gray-500 mb-1">Plus gros débiteur</p>
            {plusGrosDebiteur ? (
              <>
                <p className="text-base font-bold text-gray-800 truncate">{plusGrosDebiteur.nom}</p>
                <p className="text-sm font-semibold text-red-500">{formatMontant(plusGrosDebiteur.soldeCredit)}</p>
              </>
            ) : (
              <p className="text-gray-400 text-sm">—</p>
            )}
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucun crédit en cours ✓</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Nom</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Téléphone</th>
                <th className="text-right px-6 py-3 text-gray-600 font-medium">Solde dû</th>
                <th className="text-right px-6 py-3 text-gray-600 font-medium">Plafond</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">% utilisé</th>
                <th className="text-right px-6 py-3 text-gray-600 font-medium">Actions</th>
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
                      <div className="flex items-center justify-end gap-3">
                        {c.telephone && (
                          <button
                            onClick={() => envoyerWhatsApp(c)}
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                            title="Relancer par WhatsApp">
                            📱 Relancer
                          </button>
                        )}
                        <Link href={`/clients/${c.id}`}
                          className="text-green-600 hover:underline text-xs font-medium">
                          Voir fiche →
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