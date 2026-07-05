'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatDateTime } from '@/lib/utils'
import { useToast } from '@/components/ui'

interface LigneInventaire {
  id: string
  quantiteReelle: number
  ecart: number
  motifEcart?: string
  medicament: { nom: string; prixAchat: number; lots: { quantite: number }[] }
}

interface Inventaire {
  id: string
  statut: string
  createdAt: string
  user: { nom: string }
  lignes: LigneInventaire[]
  nbLignes?: number
  nbEcarts?: number
}

// ── Composant cartes de résumé — partagé entre saisie et lecture seule ──────
function CardsRapport({
  nbConformes, nbSurplus, nbManque, valeurEcartTotal,
}: {
  nbConformes: number
  nbSurplus: number
  nbManque: number
  valeurEcartTotal: number
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <p className="text-xs text-green-600 font-medium mb-0.5">✅ Conformes</p>
        <p className="text-2xl font-bold text-green-700">{nbConformes}</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <p className="text-xs text-blue-600 font-medium mb-0.5">📈 Surplus</p>
        <p className="text-2xl font-bold text-blue-700">
          {nbSurplus}
          <span className="text-sm font-normal ml-1 text-blue-500">
            ligne{nbSurplus !== 1 ? 's' : ''}
          </span>
        </p>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
        <p className="text-xs text-red-600 font-medium mb-0.5">📉 Manques</p>
        <p className="text-2xl font-bold text-red-700">
          {nbManque}
          <span className="text-sm font-normal ml-1 text-red-400">
            ligne{nbManque !== 1 ? 's' : ''}
          </span>
        </p>
      </div>

      <div className={`border rounded-lg px-4 py-3 ${
        valeurEcartTotal > 0 ? 'bg-green-50 border-green-200'
        : valeurEcartTotal < 0 ? 'bg-red-50 border-red-200'
        : 'bg-gray-50 border-gray-200'
      }`}>
        <p className={`text-xs font-medium mb-0.5 ${
          valeurEcartTotal > 0 ? 'text-green-600'
          : valeurEcartTotal < 0 ? 'text-red-600'
          : 'text-gray-500'
        }`}>
          💰 Impact valeur
        </p>
        <p className={`text-lg font-bold ${
          valeurEcartTotal > 0 ? 'text-green-700'
          : valeurEcartTotal < 0 ? 'text-red-700'
          : 'text-gray-500'
        }`}>
          {valeurEcartTotal > 0 ? '+' : ''}
          {valeurEcartTotal.toLocaleString('fr-FR')} GNF
        </p>
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function InventairePage() {
  const { showToast } = useToast()
  const [inventaires, setInventaires] = useState<Inventaire[]>([])
  const [actif,   setActif]   = useState<Inventaire | null>(null) // EN_COURS — saisie
  const [lecture, setLecture] = useState<Inventaire | null>(null) // VALIDE   — lecture seule
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  const chargerListe = () =>
    fetch('/api/inventaires')
      .then((r) => r.json())
      .then((json) => setInventaires(json.data || []))

  useEffect(() => {
    chargerListe().then(() => setLoading(false))
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────────
  const lancerInventaire = async () => {
    setSaving(true)
    const res  = await fetch('/api/inventaires', { method: 'POST' })
    const json = await res.json()
    if (res.ok) {
      const detail = await fetch(`/api/inventaires/${json.data.id}`).then((r) => r.json())
      setActif(detail.data)
    } else {
      showToast(json.error, 'error')
    }
    setSaving(false)
  }

  const ouvrirInventaire = async (inv: Inventaire) => {
    const detail = await fetch(`/api/inventaires/${inv.id}`).then((r) => r.json())
    if (inv.statut === 'EN_COURS') {
      setActif(detail.data)
    } else {
      setLecture(detail.data)
    }
  }

  const mettreAJourQuantite = (ligneId: string, valeur: string) => {
    if (!actif) return
    setActif({
      ...actif,
      lignes: actif.lignes.map((l) => {
        if (l.id !== ligneId) return l
        const stockSysteme = l.medicament.lots.reduce((s, lot) => s + lot.quantite, 0)
        const qte          = parseInt(valeur) || 0
        const nouvelEcart  = qte - stockSysteme
        return {
          ...l,
          quantiteReelle: qte,
          ecart:          nouvelEcart,
          motifEcart:     nouvelEcart === 0 ? '' : l.motifEcart,
        }
      }),
    })
  }

  const mettreAJourMotif = (ligneId: string, valeur: string) => {
    if (!actif) return
    setActif({
      ...actif,
      lignes: actif.lignes.map((l) =>
        l.id === ligneId ? { ...l, motifEcart: valeur } : l
      ),
    })
  }

  const validerInventaire = async () => {
    if (!actif) return
    setSaving(true)
    // 1. Sauvegarder les quantités et motifs
    await fetch(`/api/inventaires/${actif.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'saisir', lignes: actif.lignes }),
    })
    // 2. Valider et ajuster le stock
    const res  = await fetch(`/api/inventaires/${actif.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'valider' }),
    })
    const json = await res.json()
    if (res.ok) {
      showToast('Inventaire validé avec succès !', 'success')
      setActif(null)
      chargerListe()
    } else {
      showToast(json.error || 'Erreur lors de la validation', 'error')
    }
    setSaving(false)
  }

  // ── Rapport d'écart — partagé saisie + lecture seule ────────────────────
  const rapport = useMemo(() => {
    const lignes = actif?.lignes ?? lecture?.lignes ?? []
    return {
      nbSurplus:        lignes.filter((l) => l.ecart > 0).length,
      nbManque:         lignes.filter((l) => l.ecart < 0).length,
      nbConformes:      lignes.filter((l) => l.ecart === 0).length,
      valeurEcartTotal: lignes.reduce((sum, l) => sum + l.ecart * l.medicament.prixAchat, 0),
    }
  }, [actif?.lignes, lecture?.lignes])

  // Lignes bloquant la validation (écart sans motif)
  const lignesAvecEcartSansMotif = actif
    ? actif.lignes.filter(
        (l) => l.ecart !== 0 && (!l.motifEcart || l.motifEcart.trim() === '')
      ).length
    : 0

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8">

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          {(actif || lecture) && (
            <button
              onClick={() => { setActif(null); setLecture(null) }}
              className="text-gray-500 hover:text-gray-800 text-sm"
            >
              ← Liste
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-800">
            {lecture
              ? `Inventaire du ${formatDateTime(lecture.createdAt)}`
              : 'Inventaire'}
          </h1>
          {lecture && (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
              VALIDÉ · lecture seule
            </span>
          )}
        </div>

        {!actif && !lecture && (
          <button
            onClick={lancerInventaire}
            disabled={saving}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Lancement...' : 'Lancer un inventaire'}
          </button>
        )}
      </div>

      {/* ── VUE SAISIE (EN_COURS) ────────────────────────────────────────── */}
      {actif && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">
            Inventaire en cours — saisir les quantités réelles
          </h2>

          <CardsRapport {...rapport} />

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 text-gray-500">Médicament</th>
                  <th className="text-right py-2 text-gray-500">Stock système</th>
                  <th className="text-right py-2 text-gray-500">Quantité réelle</th>
                  <th className="text-right py-2 text-gray-500 pr-4">Écart</th>
                  <th className="text-left py-2 text-gray-500 pl-4">Motif de l'écart</th>
                </tr>
              </thead>
              <tbody>
                {actif.lignes.map((ligne) => {
                  const stockSysteme  = ligne.medicament.lots.reduce((s, l) => s + l.quantite, 0)
                  const aUnEcart      = ligne.ecart !== 0
                  const motifManquant = aUnEcart && (!ligne.motifEcart || ligne.motifEcart.trim() === '')

                  return (
                    <tr
                      key={ligne.id}
                      className={`border-b last:border-0 transition-colors ${motifManquant ? 'bg-red-50' : ''}`}
                    >
                      <td className="py-2 pr-4">{ligne.medicament.nom}</td>
                      <td className="py-2 text-right text-gray-600">{stockSysteme}</td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          defaultValue={0}
                          onChange={(e) => mettreAJourQuantite(ligne.id, e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                      </td>
                      <td className={`py-2 text-right font-medium pr-4 ${
                        ligne.ecart < 0 ? 'text-red-500'
                        : ligne.ecart > 0 ? 'text-green-600'
                        : 'text-gray-400'
                      }`}>
                        {ligne.ecart > 0 ? '+' : ''}{ligne.ecart}
                      </td>
                      <td className="py-2 pl-4">
                        {aUnEcart ? (
                          <input
                            type="text"
                            value={ligne.motifEcart || ''}
                            onChange={(e) => mettreAJourMotif(ligne.id, e.target.value)}
                            placeholder="Motif obligatoire…"
                            className={`w-full px-3 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-green-400 text-sm ${
                              motifManquant
                                ? 'border-red-400 bg-white ring-1 ring-red-300'
                                : 'border-gray-300'
                            }`}
                          />
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={validerInventaire}
              disabled={saving || lignesAvecEcartSansMotif > 0}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Validation...' : 'Valider et ajuster le stock'}
            </button>
            {lignesAvecEcartSansMotif > 0 && (
              <p className="text-sm text-red-600">
                {lignesAvecEcartSansMotif} ligne{lignesAvecEcartSansMotif > 1 ? 's' : ''} avec
                écart nécessite{lignesAvecEcartSansMotif > 1 ? 'nt' : ''} un motif
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── VUE LECTURE SEULE (VALIDE) ───────────────────────────────────── */}
      {lecture && (
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500 mb-4">
            Validé par{' '}
            <span className="font-medium text-gray-700">{lecture.user.nom}</span>
          </p>

          <CardsRapport {...rapport} />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 text-gray-500">Médicament</th>
                  <th className="text-right py-2 text-gray-500">Stock théorique</th>
                  <th className="text-right py-2 text-gray-500">Quantité comptée</th>
                  <th className="text-right py-2 text-gray-500 pr-4">Écart</th>
                  <th className="text-left py-2 text-gray-500 pl-4">Motif</th>
                </tr>
              </thead>
              <tbody>
                {lecture.lignes.map((ligne) => {
                  // Stock théorique au moment de l'inventaire = quantiteReelle − ecart
                  const stockTheorique = ligne.quantiteReelle - ligne.ecart
                  return (
                    <tr key={ligne.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium text-gray-800">{ligne.medicament.nom}</td>
                      <td className="py-3 text-right text-gray-600">{stockTheorique}</td>
                      <td className="py-3 text-right text-gray-800">{ligne.quantiteReelle}</td>
                      <td className={`py-3 text-right font-medium pr-4 ${
                        ligne.ecart < 0 ? 'text-red-500'
                        : ligne.ecart > 0 ? 'text-green-600'
                        : 'text-gray-400'
                      }`}>
                        {ligne.ecart > 0 ? '+' : ''}{ligne.ecart}
                      </td>
                      <td className="py-3 pl-4 text-gray-600 text-sm">
                        {ligne.ecart !== 0
                          ? (ligne.motifEcart || <span className="text-gray-400 italic">aucun motif</span>)
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── LISTE DES INVENTAIRES ────────────────────────────────────────── */}
      {!actif && !lecture && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Date</th>
                <th className="text-left px-6 py-3 text-gray-600">Par</th>
                <th className="text-center px-6 py-3 text-gray-600">Lignes</th>
                <th className="text-center px-6 py-3 text-gray-600">Écarts</th>
                <th className="text-center px-6 py-3 text-gray-600">Statut</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {inventaires.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Aucun inventaire
                  </td>
                </tr>
              ) : inventaires.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4">{formatDateTime(inv.createdAt)}</td>
                  <td className="px-6 py-4 text-gray-700">{inv.user.nom}</td>
                  <td className="px-6 py-4 text-center text-gray-500">{inv.nbLignes ?? '—'}</td>
                  <td className="px-6 py-4 text-center">
                    {inv.nbEcarts != null && inv.nbEcarts > 0 ? (
                      <span className="font-medium text-orange-600">{inv.nbEcarts}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      inv.statut === 'VALIDE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {inv.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => ouvrirInventaire(inv)}
                      className={`text-sm font-medium ${
                        inv.statut === 'VALIDE'
                          ? 'text-blue-600 hover:text-blue-800'
                          : 'text-green-600 hover:text-green-800'
                      }`}
                    >
                      {inv.statut === 'VALIDE' ? 'Revoir →' : 'Reprendre →'}
                    </button>
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
