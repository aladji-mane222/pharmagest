'use client'

import { useEffect, useState } from 'react'
import { formatMontant, formatDateTime } from '@/lib/utils'
import Modal from '@/components/ui/Modal'

interface Commande {
  id: string
  statut: string
  montantTotal: number
  createdAt: string
  dateLivraisonPrevue: string | null
  dateReception: string | null
  fournisseur: { nom: string }
  lignes: {
    id: string
    quantite: number
    quantiteRecue: number | null
    prixUnitaire: number
    medicamentId: string
    medicament: { nom: string } | null
  }[]
}

interface SousLotForm {
  quantite: string
  datePeremption: string
  numeroLot: string
}

interface LigneReception {
  ligneId: string
  nom: string
  quantiteCommandee: number
  sousLots: SousLotForm[]
}

// Seuil de peremption proche a la reception : reprend exactement le seuil
// deja utilise ailleurs dans l'app (/stock lotsCritiques, alertes cron) —
// 90 jours — pour rester coherent plutot que d'inventer un autre chiffre.
const SEUIL_PEREMPTION_PROCHE_JOURS = 90

function estPeremptionProche(dateStr: string): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  const diffJours = (d.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  return diffJours >= 0 && diffJours <= SEUIL_PEREMPTION_PROCHE_JOURS
}

// Suggestion de date de livraison prevue a la creation : +7 jours,
// editable/effaçable par l'admin. Si effacee, on envoie null — pas de
// date fabriquee silencieusement (voir le bug corrige a la reception).
function suggestionDateLivraison(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

function joursDeRetard(dateLivraisonPrevue: string | null, dateReference: Date): number {
  if (!dateLivraisonPrevue) return 0
  const prevue = new Date(dateLivraisonPrevue)
  const diffMs = dateReference.getTime() - prevue.getTime()
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

// Tolerance de 2 jours avant de considerer une livraison en retard
const TOLERANCE_RETARD_JOURS = 2

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
  const [dateLivraisonPrevue, setDateLivraisonPrevue] = useState<string>(suggestionDateLivraison())
  const [saving,        setSaving]        = useState(false)
  const [erreur,        setErreur]        = useState<string | null>(null)

  // ── Modale de reception reelle ──
  const [commandeAReceptionner, setCommandeAReceptionner] = useState<Commande | null>(null)
  const [lignesReception,       setLignesReception]       = useState<LigneReception[]>([])
  const [erreurReception,       setErreurReception]       = useState<string | null>(null)
  const [savingReception,       setSavingReception]       = useState(false)

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions,     setSuggestions]     = useState<Suggestion[]>([])
  const [loadingSugg,     setLoadingSugg]     = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/commandes').then((r)     => r.json()),
      fetch('/api/fournisseurs').then((r)  => r.json()),
      // Bug corrige 19/07/2026 : le parametre etait "limite" (jamais lu par
      // l'API qui attend "limit"), donc retombait sur la valeur par defaut
      // de 20 medicaments — la plupart des suggestions issues du catalogue
      // complet ne matchaient alors aucune option du menu deroulant.
      // 2000 couvre un catalogue de pharmacie realiste ; la recherche
      // autocompletee prevue en tache 3.4 remplacera ce chargement complet
      // par une recherche serveur si le catalogue devient plus gros.
      fetch('/api/medicaments?limit=2000').then((r) => r.json()),
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
        dateLivraisonPrevue: dateLivraisonPrevue || null,
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
      setDateLivraisonPrevue(suggestionDateLivraison())
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

  const ouvrirReception = (cmd: Commande) => {
    setErreurReception(null)
    setCommandeAReceptionner(cmd)
    setLignesReception(
      cmd.lignes.map((l) => ({
        ligneId: l.id,
        nom: l.medicament?.nom || 'Médicament',
        quantiteCommandee: l.quantite,
        // Un seul sous-lot pre-rempli avec la quantite commandee par
        // confort — modifiable, et l'admin peut en ajouter d'autres si le
        // fournisseur a livre le meme medicament avec plusieurs dates de
        // peremption differentes dans la meme reception.
        sousLots: [{ quantite: String(l.quantite), datePeremption: '', numeroLot: '' }],
      }))
    )
  }

  const fermerReception = () => {
    if (savingReception) return
    setCommandeAReceptionner(null)
    setLignesReception([])
    setErreurReception(null)
  }

  const ajouterSousLot = (ligneIndex: number) => {
    setLignesReception((prev) =>
      prev.map((l, i) =>
        i === ligneIndex
          ? { ...l, sousLots: [...l.sousLots, { quantite: '', datePeremption: '', numeroLot: '' }] }
          : l
      )
    )
  }

  const supprimerSousLot = (ligneIndex: number, sousLotIndex: number) => {
    setLignesReception((prev) =>
      prev.map((l, i) =>
        i === ligneIndex
          ? { ...l, sousLots: l.sousLots.filter((_, si) => si !== sousLotIndex) }
          : l
      )
    )
  }

  const modifierSousLot = (
    ligneIndex: number,
    sousLotIndex: number,
    champ: 'quantite' | 'datePeremption' | 'numeroLot',
    valeur: string
  ) => {
    setLignesReception((prev) =>
      prev.map((l, i) =>
        i === ligneIndex
          ? {
              ...l,
              sousLots: l.sousLots.map((sl, si) =>
                si === sousLotIndex ? { ...sl, [champ]: valeur } : sl
              ),
            }
          : l
      )
    )
  }

  const totalRecuLigne = (l: LigneReception) =>
    l.sousLots.reduce((s, sl) => s + (parseInt(sl.quantite) || 0), 0)

  const confirmerReception = async () => {
    if (!commandeAReceptionner) return
    setErreurReception(null)

    for (const l of lignesReception) {
      for (const sl of l.sousLots) {
        if (sl.quantite === '' || parseInt(sl.quantite) < 0) {
          setErreurReception(`Quantité manquante ou invalide pour ${l.nom}`)
          return
        }
        if (parseInt(sl.quantite) > 0 && !sl.datePeremption) {
          setErreurReception(`Date de péremption manquante pour ${l.nom}`)
          return
        }
      }
    }

    setSavingReception(true)
    const res = await fetch(`/api/commandes/${commandeAReceptionner.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        statut: 'RECUE',
        lignes: lignesReception.map((l) => ({
          ligneId: l.ligneId,
          sousLots: l.sousLots.map((sl) => ({
            quantite: parseInt(sl.quantite) || 0,
            datePeremption: sl.datePeremption,
            numeroLot: sl.numeroLot.trim() || null,
          })),
        })),
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setCommandes(commandes.map((c) =>
        c.id === commandeAReceptionner.id ? { ...c, statut: 'RECUE' } : c
      ))
      if (json.data?.ecarts?.length > 0) {
        setErreurReception(
          `Commande réceptionnée avec ${json.data.ecarts.length} écart(s) de livraison — voir le journal d'audit.`
        )
        setTimeout(() => fermerReception(), 2500)
      } else {
        fermerReception()
      }
    } else {
      setErreurReception(json.error || 'Erreur lors de la réception')
    }
    setSavingReception(false)
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

  const badgeLivraison = (cmd: Commande) => {
    if (!cmd.dateLivraisonPrevue) {
      return <span className="text-gray-300 text-xs">—</span>
    }
    if (cmd.statut === 'RECUE' && cmd.dateReception) {
      const retard = joursDeRetard(cmd.dateLivraisonPrevue, new Date(cmd.dateReception))
      if (retard > TOLERANCE_RETARD_JOURS) {
        return (
          <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs">
            Reçue en retard ({retard}j)
          </span>
        )
      }
      return <span className="px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs">Reçue à temps</span>
    }
    if (cmd.statut === 'ENVOYEE') {
      const retard = joursDeRetard(cmd.dateLivraisonPrevue, new Date())
      if (retard > TOLERANCE_RETARD_JOURS) {
        return (
          <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded-full text-xs">
            En retard ({retard}j)
          </span>
        )
      }
    }
    return (
      <span className="text-gray-500 text-xs">
        {new Date(cmd.dateLivraisonPrevue).toLocaleDateString('fr-FR')}
      </span>
    )
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

          {/* Date de livraison prevue */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de livraison prévue
            </label>
            <input
              type="date"
              value={dateLivraisonPrevue}
              onChange={(e) => setDateLivraisonPrevue(e.target.value)}
              className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Suggestion à titre indicatif (+7 jours) — modifiable, ou effaçable si inconnue.
            </p>
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
                <th className="text-center px-6 py-3 text-gray-600">Livraison</th>
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
                  <td className="px-6 py-4 text-center">{badgeLivraison(cmd)}</td>
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
                        <button onClick={() => ouvrirReception(cmd)}
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

      {/* Modale de reception reelle : quantite et date de peremption
          saisies ligne par ligne, plus aucune valeur inventee. */}
      <Modal
        open={!!commandeAReceptionner}
        onClose={fermerReception}
        onConfirm={confirmerReception}
        title={`Réceptionner la commande — ${commandeAReceptionner?.fournisseur.nom || ''}`}
        confirmLabel="Confirmer la réception"
        loading={savingReception}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Indiquez la quantité réellement livrée et la date de péremption pour chaque article.
            Si un article n'a pas été livré du tout, laissez la quantité à 0.
          </p>

          {lignesReception.map((l, index) => {
            const total = totalRecuLigne(l)
            return (
              <div key={l.ligneId} className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  {l.nom} <span className="text-gray-400 font-normal">(commandé : {l.quantiteCommandee})</span>
                </p>

                <div className="space-y-2">
                  {l.sousLots.map((sl, sousIndex) => (
                    <div key={sousIndex} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">
                          {sousIndex === 0 ? 'Quantité reçue' : `Quantité (lot ${sousIndex + 1})`}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={sl.quantite}
                          onChange={(e) => modifierSousLot(index, sousIndex, 'quantite', e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Date de péremption</label>
                        <input
                          type="date"
                          value={sl.datePeremption}
                          onChange={(e) => modifierSousLot(index, sousIndex, 'datePeremption', e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        {estPeremptionProche(sl.datePeremption) && (
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠ Péremption dans moins de 3 mois
                          </p>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">N° de lot (optionnel)</label>
                        <input
                          type="text"
                          value={sl.numeroLot}
                          onChange={(e) => modifierSousLot(index, sousIndex, 'numeroLot', e.target.value)}
                          placeholder="Ex: LOT-2026-04"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      {l.sousLots.length > 1 && (
                        <button
                          onClick={() => supprimerSousLot(index, sousIndex)}
                          className="text-red-400 hover:text-red-600 text-sm mt-5"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => ajouterSousLot(index)}
                  className="mt-2 text-xs text-green-600 hover:text-green-800 font-medium"
                >
                  + Ajouter un lot avec une autre date de péremption
                </button>

                {total < l.quantiteCommandee && (
                  <p className="text-xs text-orange-500 mt-1">
                    ⚠ Écart : {l.quantiteCommandee - total} unité(s) manquante(s)
                  </p>
                )}
                {total > l.quantiteCommandee && (
                  <p className="text-xs text-blue-500 mt-1">
                    ⚠ Écart : {total - l.quantiteCommandee} unité(s) reçue(s) en plus de la commande
                  </p>
                )}
              </div>
            )
          })}

          {erreurReception && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {erreurReception}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}