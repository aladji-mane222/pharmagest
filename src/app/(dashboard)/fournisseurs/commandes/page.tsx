'use client'

import { useEffect, useState } from 'react'
import { formatMontant, formatDateTime } from '@/lib/utils'

interface Commande {
  id: string
  statut: string
  montantTotal: number
  createdAt: string
  fournisseur: { nom: string }
  lignes: { id: string; quantite: number; prixUnitaire: number; medicamentId: string }[]
}

interface Fournisseur {
  id: string
  nom: string
}

interface Medicament {
  id: string
  nom: string
  prixAchat: number | null
}

interface Suggestion {
  medicamentId: string
  nom: string
  stockActuel: number
  stockMinimum: number
  quantiteSuggeree: number
}

interface LigneForm {
  medicamentId: string
  quantite: string
  prixUnitaire: string
}

export default function CommandesPage() {
  const [commandes,     setCommandes]     = useState<Commande[]>([])
  const [fournisseurs,  setFournisseurs]  = useState<Fournisseur[]>([])
  const [medicaments,   setMedicaments]   = useState<Medicament[]>([])
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [fournisseurId, setFournisseurId] = useState('')
  const [lignes,        setLignes]        = useState<LigneForm[]>([
    { medicamentId: '', quantite: '1', prixUnitaire: '' },
  ])
  const [saving,        setSaving]        = useState(false)
  const [erreur,        setErreur]        = useState<string | null>(null)

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions,     setSuggestions]     = useState<Suggestion[]>([])
  const [loadingSugg,     setLoadingSugg]     = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/commandes').then((r)     => r.json()),
      fetch('/api/fournisseurs').then((r)  => r.json()),
      fetch('/api/medicaments?limite=200').then((r) => r.json()),
    ]).then(([cmd, four, meds]) => {
      setCommandes(cmd.data || [])
      setFournisseurs(four.data || [])
      setMedicaments(meds.data?.medicaments || [])
      setLoading(false)
    })
  }, [])

  // Quand on sélectionne un médicament sur une ligne, pré-remplir le prix d'achat
  const onMedicamentChange = (index: number, medicamentId: string) => {
    const med = medicaments.find((m) => m.id === medicamentId)
    setLignes(lignes.map((l, i) =>
      i === index
        ? { ...l, medicamentId, prixUnitaire: med?.prixAchat ? String(med.prixAchat) : '' }
        : l
    ))
  }

  const ajouterLigne = () => {
    setLignes([...lignes, { medicamentId: '', quantite: '1', prixUnitaire: '' }])
  }

  const supprimerLigne = (index: number) => {
    if (lignes.length === 1) return
    setLignes(lignes.filter((_, i) => i !== index))
  }

  const toggleSuggestions = () => {
    if (showSuggestions) { setShowSuggestions(false); return }
    setShowSuggestions(true)
    setLoadingSugg(true)
    fetch('/api/commandes/suggerer')
      .then((r) => r.json())
      .then((json) => {
        setSuggestions(json.data || [])
        setLoadingSugg(false)
      })
  }

  // Auto-remplir le formulaire depuis les suggestions
  const utiliserSuggestions = () => {
    if (suggestions.length === 0) return
    const nouvellesLignes: LigneForm[] = suggestions.map((s) => {
      const med = medicaments.find((m) => m.id === s.medicamentId)
      return {
        medicamentId: s.medicamentId,
        quantite:     String(s.quantiteSuggeree),
        prixUnitaire: med?.prixAchat ? String(med.prixAchat) : '',
      }
    })
    setLignes(nouvellesLignes)
    setShowForm(true)
    setShowSuggestions(false)
  }

  const creerCommande = async () => {
    setErreur(null)
    if (!fournisseurId) { setErreur('Choisir un fournisseur'); return }

    const lignesValides = lignes.filter((l) => l.medicamentId && l.quantite && l.prixUnitaire)
    if (lignesValides.length === 0) {
      setErreur('Ajouter au moins une ligne avec médicament, quantité et prix')
      return
    }

    const lignesIncompletes = lignes.filter((l) => l.medicamentId && (!l.quantite || !l.prixUnitaire))
    if (lignesIncompletes.length > 0) {
      setErreur('Certaines lignes sont incomplètes (quantité ou prix manquant)')
      return
    }

    setSaving(true)
    const res = await fetch('/api/commandes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        fournisseurId,
        lignes: lignesValides.map((l) => ({
          medicamentId: l.medicamentId,
          quantite:     parseInt(l.quantite),
          prixUnitaire: parseFloat(l.prixUnitaire),
        })),
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setCommandes([json.data, ...commandes])
      setShowForm(false)
      setFournisseurId('')
      setLignes([{ medicamentId: '', quantite: '1', prixUnitaire: '' }])
    } else {
      setErreur(json.error || 'Erreur lors de la création')
    }
    setSaving(false)
  }

  const changerStatut = async (id: string, statut: string) => {
    const res = await fetch(`/api/commandes/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ statut }),
    })
    if (res.ok) {
      setCommandes(commandes.map((c) => c.id === id ? { ...c, statut } : c))
    }
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

  const couleurStock = (actuel: number) =>
    actuel === 0 ? 'text-red-600 font-semibold' : 'text-orange-600 font-semibold'

  const montantFormulaire = lignes.reduce((sum, l) => {
    const q = parseInt(l.quantite) || 0
    const p = parseFloat(l.prixUnitaire) || 0
    return sum + q * p
  }, 0)

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
            onClick={() => { setShowForm(!showForm); setErreur(null) }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            + Nouvelle commande
          </button>
        </div>
      </div>

      {/* Panneau suggestions */}
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
            <div className="flex gap-2">
              {suggestions.length > 0 && (
                <button
                  onClick={utiliserSuggestions}
                  className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700">
                  Utiliser ces suggestions →
                </button>
              )}
              <button onClick={() => setShowSuggestions(false)}
                className="text-amber-600 hover:text-amber-800 text-sm px-2">
                ✕
              </button>
            </div>
          </div>

          {loadingSugg ? (
            <p className="text-sm text-amber-600">Calcul en cours...</p>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-green-700">✓ Tous les médicaments sont au-dessus de leur seuil minimum.</p>
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
                      <td className={`px-4 py-3 text-center ${couleurStock(s.stockActuel)}`}>{s.stockActuel}</td>
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

      {/* Formulaire nouvelle commande */}
      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">Nouvelle commande</h2>

          {/* Fournisseur */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur *</label>
            <select
              value={fournisseurId}
              onChange={(e) => setFournisseurId(e.target.value)}
              className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Choisir un fournisseur</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </div>

          {/* Lignes de commande */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">Articles commandés *</label>
              {montantFormulaire > 0 && (
                <span className="text-sm text-gray-500">
                  Total estimé : <span className="font-semibold text-green-600">{formatMontant(montantFormulaire)}</span>
                </span>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* En-têtes */}
              <div className="grid grid-cols-12 gap-2 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 border-b">
                <div className="col-span-5">Médicament</div>
                <div className="col-span-2 text-center">Quantité</div>
                <div className="col-span-3">Prix unitaire (GNF)</div>
                <div className="col-span-2 text-right">Sous-total</div>
              </div>

              {/* Lignes */}
              {lignes.map((ligne, index) => {
                const q = parseInt(ligne.quantite) || 0
                const p = parseFloat(ligne.prixUnitaire) || 0
                return (
                  <div key={index} className="grid grid-cols-12 gap-2 px-4 py-3 border-b last:border-0 items-center">
                    <div className="col-span-5">
                      <select
                        value={ligne.medicamentId}
                        onChange={(e) => onMedicamentChange(index, e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Choisir un médicament</option>
                        {medicaments.map((m) => (
                          <option key={m.id} value={m.id}>{m.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={ligne.quantite}
                        onChange={(e) => setLignes(lignes.map((l, i) => i === index ? { ...l, quantite: e.target.value } : l))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0"
                        value={ligne.prixUnitaire}
                        onChange={(e) => setLignes(lignes.map((l, i) => i === index ? { ...l, prixUnitaire: e.target.value } : l))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-1 text-right text-sm font-medium text-gray-700">
                      {q > 0 && p > 0 ? formatMontant(q * p) : '—'}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        onClick={() => supprimerLigne(index)}
                        disabled={lignes.length === 1}
                        className="text-red-400 hover:text-red-600 disabled:opacity-30 text-sm">
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={ajouterLigne}
              className="mt-2 text-sm text-green-600 hover:text-green-800 font-medium">
              + Ajouter une ligne
            </button>
          </div>

          {erreur && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {erreur}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={creerCommande}
              disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
              {saving ? 'Création...' : 'Créer la commande'}
            </button>
            <button
              onClick={() => { setShowForm(false); setErreur(null); setLignes([{ medicamentId: '', quantite: '1', prixUnitaire: '' }]) }}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des commandes */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {commandes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucune commande</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Date</th>
                <th className="text-left px-6 py-3 text-gray-600">Fournisseur</th>
                <th className="text-left px-6 py-3 text-gray-600">Articles</th>
                <th className="text-right px-6 py-3 text-gray-600">Montant</th>
                <th className="text-center px-6 py-3 text-gray-600">Statut</th>
                <th className="text-center px-6 py-3 text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commandes.map((cmd) => (
                <tr key={cmd.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{formatDateTime(cmd.createdAt)}</td>
                  <td className="px-6 py-4 font-medium">{cmd.fournisseur.nom}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs">{cmd.lignes.length} ligne{cmd.lignes.length > 1 ? 's' : ''}</td>
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
                          Réceptionner
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