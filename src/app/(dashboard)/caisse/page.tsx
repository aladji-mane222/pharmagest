'use client'

import { useEffect, useState } from 'react'
import { formatMontant, formatDateTime } from '@/lib/utils'

interface SessionCaisse {
  id: string
  montantOuverture: number
  montantCloture: number | null
  dateOuverture: string
  dateCloture: string | null
  actif: boolean
  user: { nom: string }
}

export default function CaissePage() {
  const [sessionActive, setSessionActive] = useState<SessionCaisse | null>(null)
  const [historique, setHistorique] = useState<SessionCaisse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [montantOuverture, setMontantOuverture] = useState('')
  const [montantCloture, setMontantCloture] = useState('')
  const [totalEncaisse, setTotalEncaisse] = useState(0)

  // Chargement initial
  useEffect(() => {
    fetch('/api/caisse')
      .then((res) => res.json())
      .then((json) => {
        setSessionActive(json.data?.sessionActive || null)
        setHistorique(json.data?.historique || [])
        setLoading(false)
      })
  }, [])

  // Fetch total encaissé dès qu'une session active est connue
  useEffect(() => {
    if (!sessionActive?.id) {
      setTotalEncaisse(0)
      return
    }
    fetch(`/api/ventes?sessionCaisseId=${sessionActive.id}`)
      .then((res) => res.json())
      .then((json) => setTotalEncaisse(json.data?.totalEncaisse ?? 0))
  }, [sessionActive?.id])

  const totalAttendu = (sessionActive?.montantOuverture ?? 0) + totalEncaisse
  const montantClotureNum = parseFloat(montantCloture) || 0
  const ecart = montantCloture !== '' ? montantClotureNum - totalAttendu : null

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
      setTotalEncaisse(0)
      setMontantCloture('')
      const resHist = await fetch('/api/caisse')
      const jsonHist = await resHist.json()
      setHistorique(jsonHist.data?.historique || [])
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

        {/* ── Session actuelle ── */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Session actuelle</h2>

          {sessionActive ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-600 font-medium">Session ouverte</span>
              </div>

              <div className="space-y-1 mb-4 text-sm text-gray-500">
                <p>Ouverte par : <span className="font-medium text-gray-700">{sessionActive.user.nom}</span></p>
                <p>Depuis : <span className="font-medium text-gray-700">{formatDateTime(sessionActive.dateOuverture)}</span></p>
                <p>Montant ouverture : <span className="font-medium text-gray-700">{formatMontant(sessionActive.montantOuverture)}</span></p>
              </div>

              {/* Totaux encaissé / attendu */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total encaissé</span>
                  <span className="font-semibold text-green-600">{formatMontant(totalEncaisse)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total attendu en caisse</span>
                  <span className="font-semibold text-blue-600">{formatMontant(totalAttendu)}</span>
                </div>
              </div>

              {/* Clôture */}
              <div className="flex gap-3 mb-3">
                <input
                  type="number"
                  placeholder="Montant compté en caisse"
                  value={montantCloture}
                  onChange={(e) => setMontantCloture(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  onClick={fermerSession}
                  disabled={saving}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Fermeture...' : 'Fermer'}
                </button>
              </div>

              {/* Écart en temps réel */}
              {ecart !== null && (
                <div className={`text-sm font-medium px-3 py-2 rounded-lg ${
                  ecart === 0
                    ? 'bg-gray-100 text-gray-600'
                    : ecart > 0
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                }`}>
                  {ecart === 0
                    ? '✓ Caisse équilibrée'
                    : ecart > 0
                      ? `▲ Excédent : +${formatMontant(ecart)}`
                      : `▼ Manque : ${formatMontant(ecart)}`}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 bg-gray-300 rounded-full" />
                <span className="text-gray-500">Aucune session ouverte</span>
              </div>
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="Montant d'ouverture"
                  value={montantOuverture}
                  onChange={(e) => setMontantOuverture(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={ouvrirSession}
                  disabled={saving}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Ouverture...' : 'Ouvrir'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Historique ── */}
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
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      !s.dateCloture ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {!s.dateCloture ? 'OUVERTE' : 'FERMÉE'}
                    </span>
                  </div>
                  <p className="text-gray-500">{formatDateTime(s.dateOuverture)}</p>
                  {s.montantCloture != null && (
                    <p className="text-blue-600 font-medium">{formatMontant(s.montantCloture)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}
