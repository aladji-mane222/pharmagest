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
  const [sessionActive,  setSessionActive]  = useState<SessionCaisse | null>(null)
  const [historique,     setHistorique]     = useState<SessionCaisse[]>([])
  const [totalSession,   setTotalSession]   = useState<number | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [montantOuverture, setMontantOuverture] = useState('')
  const [montantCloture,   setMontantCloture]   = useState('')
  const [erreur,         setErreur]         = useState<string | null>(null)

  const charger = async () => {
    const res  = await fetch('/api/caisse')
    const json = await res.json()
    setSessionActive(json.data?.sessionActive || null)
    setHistorique(json.data?.historique || [])

    // Si session ouverte, charger le total des ventes de cette session
    if (json.data?.sessionActive) {
      const sessionId = json.data.sessionActive.id
      fetch(`/api/ventes?sessionCaisseId=${sessionId}&limite=1000`)
        .then((r) => r.json())
        .then((v) => {
          // Calculer le total des ventes COMPLETE de cette session
          const ventes = v.data?.ventes || []
          const total  = ventes
            .filter((vt: { statut: string; montantPaye: number }) => vt.statut === 'COMPLETE')
            .reduce((sum: number, vt: { montantPaye: number }) => sum + vt.montantPaye, 0)
          setTotalSession(total)
        })
    } else {
      setTotalSession(null)
    }
    setLoading(false)
  }

  useEffect(() => { charger() }, [])

  const ouvrirSession = async () => {
    setErreur(null)
    setSaving(true)
    const res  = await fetch('/api/caisse', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'ouvrir', montantOuverture }),
    })
    const json = await res.json()
    if (res.ok) {
      setSessionActive(json.data)
      setTotalSession(0)
      setMontantOuverture('')
    } else {
      setErreur(json.error)
    }
    setSaving(false)
  }

  const fermerSession = async () => {
    if (!montantCloture) { setErreur('Entrez le montant compté en caisse'); return }
    setErreur(null)
    setSaving(true)
    const res  = await fetch('/api/caisse', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'fermer', montantCloture }),
    })
    const json = await res.json()
    if (res.ok) {
      setSessionActive(null)
      setTotalSession(null)
      setMontantCloture('')
      // Recharger l'historique
      const resHist = await fetch('/api/caisse')
      const jsonHist = await resHist.json()
      setHistorique(jsonHist.data?.historique || [])
    } else {
      setErreur(json.error)
    }
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Caisse</h1>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Session actuelle */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Session actuelle</h2>

          {sessionActive ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-green-600 font-medium">Session ouverte</span>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p>Caissier : <span className="font-medium text-gray-800">{sessionActive.user.nom}</span></p>
                <p>Depuis : <span className="font-medium text-gray-800">{formatDateTime(sessionActive.dateOuverture)}</span></p>
                <p>Fonds initiaux : <span className="font-medium text-gray-800">{formatMontant(sessionActive.montantOuverture)}</span></p>
              </div>

              {/* Total ventes session */}
              {totalSession !== null && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-xs text-green-600 font-medium mb-1">Encaissé depuis l'ouverture</p>
                  <p className="text-2xl font-bold text-green-700">{formatMontant(totalSession)}</p>
                  <p className="text-xs text-green-500 mt-1">
                    Total attendu : {formatMontant(sessionActive.montantOuverture + totalSession)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Montant compté en caisse</label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    placeholder="Montant compté (GNF)"
                    value={montantCloture}
                    onChange={(e) => setMontantCloture(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <button
                    onClick={fermerSession}
                    disabled={saving}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
                    {saving ? 'Fermeture...' : 'Clôturer'}
                  </button>
                </div>
                {montantCloture && totalSession !== null && (
                  <p className={`text-xs font-medium ${
                    parseFloat(montantCloture) === sessionActive.montantOuverture + totalSession
                      ? 'text-green-600'
                      : 'text-orange-500'
                  }`}>
                    {parseFloat(montantCloture) > sessionActive.montantOuverture + totalSession
                      ? `Excédent : +${formatMontant(parseFloat(montantCloture) - sessionActive.montantOuverture - totalSession)}`
                      : parseFloat(montantCloture) < sessionActive.montantOuverture + totalSession
                      ? `Manque : −${formatMontant(sessionActive.montantOuverture + totalSession - parseFloat(montantCloture))}`
                      : 'Caisse équilibrée ✓'
                    }
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 bg-gray-300 rounded-full"></span>
                <span className="text-gray-500">Aucune session ouverte</span>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fonds d'ouverture (GNF)</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="Montant initial"
                  value={montantOuverture}
                  onChange={(e) => setMontantOuverture(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={ouvrirSession}
                  disabled={saving}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Ouverture...' : 'Ouvrir'}
                </button>
              </div>
            </div>
          )}

          {erreur && <p className="text-red-500 text-sm mt-3">{erreur}</p>}
        </div>

        {/* Historique */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Historique des sessions</h2>
          {historique.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune session</p>
          ) : (
            <ul className="space-y-3">
              {historique.slice(0, 6).map((s) => (
                <li key={s.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-gray-800">{s.user.nom}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      !s.dateCloture ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {!s.dateCloture ? 'En cours' : 'Fermée'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs">{formatDateTime(s.dateOuverture)}</p>
                  {s.dateCloture && (
                    <p className="text-gray-400 text-xs">→ {formatDateTime(s.dateCloture)}</p>
                  )}
                  {s.montantCloture != null && (
                    <p className="text-green-600 font-medium mt-1">{formatMontant(s.montantCloture)}</p>
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