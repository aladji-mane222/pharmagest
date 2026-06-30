'use client'

import { useEffect, useState } from 'react'
import { formatMontant, formatDateTime } from '@/lib/utils'

interface Commande {
  id: string
  statut: string
  montantTotal: number
  createdAt: string
  fournisseur: { nom: string }
  lignes: { id: string; quantite: number; prixUnitaire: number }[]
}

interface Fournisseur {
  id: string
  nom: string
}

interface Suggestion {
  medicamentId: string
  nom: string
  stockActuel: number
  stockMinimum: number
  quantiteSuggeree: number
}

export default function CommandesPage() {
  const [commandes, setCommandes]       = useState<Commande[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [loading, setLoading]           = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [fournisseurId, setFournisseurId] = useState('')
  const [saving, setSaving]             = useState(false)

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions]         = useState<Suggestion[]>([])
  const [loadingSugg, setLoadingSugg]         = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/commandes').then((r) => r.json()),
      fetch('/api/fournisseurs').then((r) => r.json()),
    ]).then(([cmd, four]) => {
      setCommandes(cmd.data || [])
      setFournisseurs(four.data || [])
      setLoading(false)
    })
  }, [])

  const toggleSuggestions = () => {
    if (showSuggestions) {
      setShowSuggestions(false)
      return
    }
    setShowSuggestions(true)
    setLoadingSugg(true)
    fetch('/api/commandes/suggerer')
      .then((r) => r.json())
      .then((json) => {
        setSuggestions(json.data || [])
        setLoadingSugg(false)
      })
  }

  const changerStatut = async (id: string, statut: string) => {
    const res = await fetch(`/api/commandes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    })
    if (res.ok) {
      setCommandes(commandes.map((c) => c.id === id ? { ...c, statut } : c))
    }
  }

  const creerCommande = async () => {
    if (!fournisseurId) return alert('Choisir un fournisseur')
    setSaving(true)
    const res = await fetch('/api/commandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fournisseurId, lignes: [{ quantite: 1, prixUnitaire: 0 }] }),
    })
    const json = await res.json()
    if (res.ok) {
      setCommandes([json.data, ...commandes])
      setShowForm(false)
      setFournisseurId('')
    }
    setSaving(false)
  }

  const statutCouleur = (statut: string) => {
    switch (statut) {
      case 'BROUILLON': return 'bg-gray-100 text-gray-700'
      case 'ENVOYEE':   return 'bg-blue-100 text-blue-700'
      case 'RECUE':     return 'bg-green-100 text-green-700'
      case 'ANNULEE':   return 'bg-red-100 text-red-700'
      default:          return 'bg-gray-100 text-gray-700'
    }
  }

  // Couleur de la barre de stock : rouge si stock = 0, orange sinon
  const couleurStock = (actuel: number) =>
    actuel === 0 ? 'text-red-600 font-semibold' : 'text-orange-600 font-semibold'

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Commandes Fournisseurs</h1>
        <div className="flex gap-3">
          <button
            onClick={toggleSuggestions}
            className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
              showSuggestions
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            📋 Commandes suggérées
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            + Nouvelle commande
          </button>
        </div>
      </div>

      {/* Panneau commandes suggérées */}
      {showSuggestions && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-base font-semibold text-amber-800">
                Médicaments en rupture ou sous seuil d'alerte
              </h2>
              {!loadingSugg && (
                <p className="text-xs text-amber-600 mt-0.5">
                  {suggestions.length > 0
                    ? `${suggestions.length} médicament${suggestions.length > 1 ? 's' : ''} à commander`
                    : 'Aucun médicament sous seuil'}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-amber-600 hover:text-amber-800 text-sm"
            >
              ✕ Fermer
            </button>
          </div>

          {loadingSugg ? (
            <p className="text-sm text-amber-600">Calcul en cours...</p>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-green-700">
              ✓ Tous les médicaments sont au-dessus de leur seuil minimum.
            </p>
          ) : (
            <div className="bg-white rounded-lg overflow-hidden border border-amber-200">
              <table className="w-full text-sm">
                <thead className="bg-amber-100 border-b border-amber-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-amber-800 font-medium">Médicament</th>
                    <th className="text-center px-4 py-3 text-amber-800 font-medium">Stock actuel</th>
                    <th className="text-center px-4 py-3 text-amber-800 font-medium">Seuil minimum</th>
                    <th className="text-center px-4 py-3 text-amber-800 font-medium">Qté à commander</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s) => (
                    <tr key={s.medicamentId} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium text-gray-800">{s.nom}</td>
                      <td className={`px-4 py-3 text-center ${couleurStock(s.stockActuel)}`}>
                        {s.stockActuel}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{s.stockMinimum}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                          {s.quantiteSuggeree}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
            <select
              value={fournisseurId}
              onChange={(e) => setFournisseurId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Choisir un fournisseur</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </div>
          <button
            onClick={creerCommande}
            disabled={saving}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Creation...' : 'Creer'}
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
          >
            Annuler
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {commandes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucune commande</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Date</th>
                <th className="text-left px-6 py-3 text-gray-600">Fournisseur</th>
                <th className="text-right px-6 py-3 text-gray-600">Montant</th>
                <th className="text-center px-6 py-3 text-gray-600">Statut</th>
                <th className="text-center px-6 py-3 text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commandes.map((cmd) => (
                <tr key={cmd.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600">{formatDateTime(cmd.createdAt)}</td>
                  <td className="px-6 py-4 font-medium">{cmd.fournisseur.nom}</td>
                  <td className="px-6 py-4 text-right">{formatMontant(cmd.montantTotal)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statutCouleur(cmd.statut)}`}>
                      {cmd.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex gap-2 justify-center">
                      {cmd.statut === 'BROUILLON' && (
                        <button
                          onClick={() => changerStatut(cmd.id, 'ENVOYEE')}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Envoyer
                        </button>
                      )}
                      {cmd.statut === 'ENVOYEE' && (
                        <button
                          onClick={() => changerStatut(cmd.id, 'RECUE')}
                          className="text-green-600 hover:underline text-xs"
                        >
                          Receptionner
                        </button>
                      )}
                      {cmd.statut !== 'ANNULEE' && cmd.statut !== 'RECUE' && (
                        <button
                          onClick={() => changerStatut(cmd.id, 'ANNULEE')}
                          className="text-red-600 hover:underline text-xs"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
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
