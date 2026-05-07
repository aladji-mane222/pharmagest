'use client'

import { useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/utils'

interface LigneInventaire {
  id: string
  quantiteReelle: number
  ecart: number
  medicament: { nom: string; lots: { quantite: number }[] }
}

interface Inventaire {
  id: string
  statut: string
  createdAt: string
  user: { nom: string }
  lignes: LigneInventaire[]
}

export default function InventairePage() {
  const [inventaires, setInventaires] = useState<Inventaire[]>([])
  const [actif, setActif] = useState<Inventaire | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/inventaires')
      .then((res) => res.json())
      .then((json) => {
        setInventaires(json.data || [])
        setLoading(false)
      })
  }, [])

  const lancerInventaire = async () => {
    setSaving(true)
    const res = await fetch('/api/inventaires', { method: 'POST' })
    const json = await res.json()
    if (res.ok) {
      const detail = await fetch(`/api/inventaires/${json.data.id}`).then((r) => r.json())
      setActif(detail.data)
    } else {
      alert(json.error)
    }
    setSaving(false)
  }

  const mettreAJourQuantite = (ligneId: string, valeur: string) => {
    if (!actif) return
    setActif({
      ...actif,
      lignes: actif.lignes.map((l) =>
        l.id === ligneId
          ? {
              ...l,
              quantiteReelle: parseInt(valeur) || 0,
              ecart: (parseInt(valeur) || 0) - l.medicament.lots.reduce((s, lot) => s + lot.quantite, 0),
            }
          : l
      ),
    })
  }

  const validerInventaire = async () => {
    if (!actif) return
    setSaving(true)
    await fetch(`/api/inventaires/${actif.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saisir', lignes: actif.lignes }),
    })
    await fetch(`/api/inventaires/${actif.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'valider' }),
    })
    alert('Inventaire valide avec succes !')
    setActif(null)
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Inventaire</h1>
        {!actif && (
          <button onClick={lancerInventaire} disabled={saving}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Lancement...' : 'Lancer un inventaire'}
          </button>
        )}
      </div>

      {actif ? (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Inventaire en cours — saisir les quantites reelles</h2>
          <table className="w-full text-sm mb-6">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 text-gray-500">Medicament</th>
                <th className="text-right py-2 text-gray-500">Stock systeme</th>
                <th className="text-right py-2 text-gray-500">Quantite reelle</th>
                <th className="text-right py-2 text-gray-500">Ecart</th>
              </tr>
            </thead>
            <tbody>
              {actif.lignes.map((ligne) => {
                const stockSysteme = ligne.medicament.lots.reduce((s, l) => s + l.quantite, 0)
                return (
                  <tr key={ligne.id} className="border-b last:border-0">
                    <td className="py-2">{ligne.medicament.nom}</td>
                    <td className="py-2 text-right text-gray-600">{stockSysteme}</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        defaultValue={0}
                        onChange={(e) => mettreAJourQuantite(ligne.id, e.target.value)}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    </td>
                    <td className={`py-2 text-right font-medium ${ligne.ecart < 0 ? 'text-red-500' : ligne.ecart > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {ligne.ecart > 0 ? '+' : ''}{ligne.ecart}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button onClick={validerInventaire} disabled={saving}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Validation...' : 'Valider et ajuster le stock'}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Date</th>
                <th className="text-left px-6 py-3 text-gray-600">Par</th>
                <th className="text-left px-6 py-3 text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody>
              {inventaires.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-400">Aucun inventaire</td></tr>
              ) : inventaires.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="px-6 py-4">{formatDateTime(inv.createdAt)}</td>
                  <td className="px-6 py-4">{inv.user.nom}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${inv.statut === 'VALIDE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {inv.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
