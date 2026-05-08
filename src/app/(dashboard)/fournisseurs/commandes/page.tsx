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

export default function CommandesPage() {
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [fournisseurId, setFournisseurId] = useState('')
  const [saving, setSaving] = useState(false)

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
      case 'ENVOYEE': return 'bg-blue-100 text-blue-700'
      case 'RECUE': return 'bg-green-100 text-green-700'
      case 'ANNULEE': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Commandes Fournisseurs</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
          + Nouvelle commande
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
            <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Choisir un fournisseur</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </div>
          <button onClick={creerCommande} disabled={saving}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Creation...' : 'Creer'}
          </button>
          <button onClick={() => setShowForm(false)}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200">
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
                        <button onClick={() => changerStatut(cmd.id, 'ENVOYEE')}
                          className="text-blue-600 hover:underline text-xs">
                          Envoyer
                        </button>
                      )}
                      {cmd.statut === 'ENVOYEE' && (
                        <button onClick={() => changerStatut(cmd.id, 'RECUE')}
                          className="text-green-600 hover:underline text-xs">
                          Receptionner
                        </button>
                      )}
                      {cmd.statut !== 'ANNULEE' && cmd.statut !== 'RECUE' && (
                        <button onClick={() => changerStatut(cmd.id, 'ANNULEE')}
                          className="text-red-600 hover:underline text-xs">
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
