'use client'

import { useEffect, useState } from 'react'
import { formatMontant, formatDateTime } from '@/lib/utils'

interface SessionCaisse {
  id: string
  statut: string
  montantOuverture: number
  montantCloture: number | null
  ouvertureAt: string
  clotureAt: string | null
  user: { nom: string }
}

export default function CaissePage() {
  const [sessionActive, setSessionActive] = useState<SessionCaisse | null>(null)
  const [historique, setHistorique] = useState<SessionCaisse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [montantOuverture, setMontantOuverture] = useState('')
  const [montantCloture, setMontantCloture] = useState('')

  useEffect(() => {
    fetch('/api/caisse')
      .then((res) => res.json())
      .then((json) => {
        setSessionActive(json.data?.sessionActive || null)
        setHistorique(json.data?.historique || [])
        setLoading(false)
      })
  }, [])

  const ouvrirSession = async () => {
    setSaving(true)
    const res = await fetch('/api/caisse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ouvrir', montantOuverture }),
    })
    const json = await res.json()
    if (res.ok) {
      setSessionActive(json.data)
      setMontantOuverture('')
    } else {
      alert(json.error)
    }
    setSaving(false)
  }

  const fermerSession = async () => {
    if (!confirm('Fermer la session caisse ?')) return
    setSaving(true)
    const res = await fetch('/api/caisse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fermer', montantCloture }),
    })
    const json = await res.json()
    if (res.ok) {
      setSessionActive(null)
      setHistorique([{ ...sessionActive!, statut: 'FERMEE', montantCloture: parseFloat(montantCloture) }, ...historique])
      setMontantCloture('')
    } else {
      alert(json.error)
    }
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Caisse</h1>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Session actuelle</h2>
          {sessionActive ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-green-600 font-medium">Session ouverte</span>
              </div>
              <p className="text-sm text-gray-500">Ouverte par : <span className="font-medium">{sessionActive.user.nom}</span></p>
              <p className="text-sm text-gray-500">Depuis : <span className="font-medium">{formatDateTime(sessionActive.ouvertureAt)}</span></p>
              <p className="text-sm text-gray-500 mb-4">Montant ouverture : <span className="font-medium">{formatMontant(sessionActive.montantOuverture)}</span></p>
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="Montant en caisse"
                  value={montantCloture}
                  onChange={(e) => setMontantCloture(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button onClick={fermerSession} disabled={saving}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {saving ? 'Fermeture...' : 'Fermer'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 bg-gray-300 rounded-full"></span>
                <span className="text-gray-500">Aucune session ouverte</span>
              </div>
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="Montant d ouverture"
                  value={montantOuverture}
                  onChange={(e) => setMontantOuverture(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button onClick={ouvrirSession} disabled={saving}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Ouverture...' : 'Ouvrir'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Historique sessions</h2>
          {historique.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune session</p>
          ) : (
            <ul className="space-y-3">
              {historique.slice(0, 5).map((s) => (
                <li key={s.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">{s.user.nom}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.statut === 'OUVERTE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.statut}
                    </span>
                  </div>
                  <p className="text-gray-500">{formatDateTime(s.ouvertureAt)}</p>
                  {s.montantCloture && <p className="text-blue-600 font-medium">{formatMontant(s.montantCloture)}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
