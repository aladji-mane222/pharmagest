'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { formatDateTime } from '@/lib/utils'
import { useToast, Card, PageHeader, Button, Badge, EmptyState, SkeletonTable } from '@/components/ui'

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
      <Card padding="sm" className="bg-success-bg border-success/20">
        <p className="text-xs text-success font-medium mb-0.5">✅ Conformes</p>
        <p className="text-2xl font-bold text-success">{nbConformes}</p>
      </Card>

      <Card padding="sm" className="bg-info-bg border-info/20">
        <p className="text-xs text-info-text font-medium mb-0.5">📈 Surplus</p>
        <p className="text-2xl font-bold text-info-text">
          {nbSurplus}
          <span className="text-sm font-normal ml-1 opacity-70">
            ligne{nbSurplus !== 1 ? 's' : ''}
          </span>
        </p>
      </Card>

      <Card padding="sm" className="bg-danger-bg border-danger/20">
        <p className="text-xs text-danger font-medium mb-0.5">📉 Manques</p>
        <p className="text-2xl font-bold text-danger">
          {nbManque}
          <span className="text-sm font-normal ml-1 opacity-70">
            ligne{nbManque !== 1 ? 's' : ''}
          </span>
        </p>
      </Card>

      <Card padding="sm" className={
        valeurEcartTotal > 0 ? 'bg-success-bg border-success/20'
        : valeurEcartTotal < 0 ? 'bg-danger-bg border-danger/20'
        : 'bg-gray-50 border-gray-200'
      }>
        <p className={`text-xs font-medium mb-0.5 ${
          valeurEcartTotal > 0 ? 'text-success'
          : valeurEcartTotal < 0 ? 'text-danger'
          : 'text-gray-500'
        }`}>
          💰 Impact valeur
        </p>
        <p className={`text-lg font-bold ${
          valeurEcartTotal > 0 ? 'text-success'
          : valeurEcartTotal < 0 ? 'text-danger'
          : 'text-gray-500'
        }`}>
          {valeurEcartTotal > 0 ? '+' : ''}
          {valeurEcartTotal.toLocaleString('fr-FR')} GNF
        </p>
      </Card>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function InventairePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const [inventaires, setInventaires] = useState<Inventaire[]>([])
  const [actif,   setActif]   = useState<Inventaire | null>(null) // EN_COURS — saisie
  const [lecture, setLecture] = useState<Inventaire | null>(null) // VALIDE   — lecture seule
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [sauvegardeProgression, setSauvegardeProgression] = useState(false)
  const [derniereSauvegarde, setDerniereSauvegarde] = useState<Date | null>(null)

  // Reserve aux admins (decision Nabe le 27/07/2026) — redirection cote
  // client en plus du lien cache dans la sidebar et du blocage API, au
  // cas ou un caissier arrive directement sur l'URL.
  useEffect(() => {
    if (
      status === 'authenticated' &&
      session?.user?.role === 'CAISSIER' &&
      !session.user.permissions?.includes('INVENTAIRE_COMPLET')
    ) {
      router.push('/dashboard')
    }
  }, [status, session, router])

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

  // Sauvegarde les quantites/motifs saisis SANS valider ni toucher au
  // stock — permet d'etaler un inventaire sur plusieurs jours sans
  // perdre la saisie en cours (demande de Nabe le 27/07/2026, suite a
  // l'audit Phase 5 : avant ce correctif, quitter la page sans valider
  // faisait perdre toute la saisie car rien n'etait persiste avant le
  // clic final sur "Valider").
  const sauvegarderProgression = async () => {
    if (!actif) return
    setSauvegardeProgression(true)
    const res = await fetch(`/api/inventaires/${actif.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'saisir', lignes: actif.lignes }),
    })
    if (res.ok) {
      setDerniereSauvegarde(new Date())
      showToast('Progression enregistrée — reprenez quand vous voulez', 'success')
    } else {
      const json = await res.json().catch(() => ({}))
      showToast(json.error || 'Erreur lors de la sauvegarde', 'error')
    }
    setSauvegardeProgression(false)
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

  if (loading) {
    return (
      <div className="p-8">
        <PageHeader title="Inventaire" />
        <Card padding="none" className="overflow-hidden">
          <div className="p-6">
            <SkeletonTable rows={6} cols={6} />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8">

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-4">
          {(actif || lecture) && (
            <button
              onClick={() => { setActif(null); setLecture(null) }}
              className="text-gray-500 hover:text-navy text-sm"
            >
              ← Liste
            </button>
          )}
          <h1 className="text-2xl font-semibold text-navy">
            {lecture ? `Inventaire du ${formatDateTime(lecture.createdAt)}` : 'Inventaire'}
          </h1>
          {lecture && <Badge variant="success">VALIDÉ · lecture seule</Badge>}
        </div>

        {!actif && !lecture && (
          <Button variant="primary" onClick={lancerInventaire} loading={saving}>
            Lancer un inventaire
          </Button>
        )}
      </div>

      {/* ── VUE SAISIE (EN_COURS) ────────────────────────────────────────── */}
      {actif && (
        <Card>
          <h2 className="font-semibold text-navy mb-4">
            Inventaire en cours — saisir les quantités réelles
          </h2>

          <CardsRapport {...rapport} />

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="text-left py-2 text-gray-500">Médicament</th>
                  <th className="text-right py-2 text-gray-500">Stock système</th>
                  <th className="text-right py-2 text-gray-500">Quantité réelle</th>
                  <th className="text-right py-2 text-gray-500 pr-4">
                    <span title="Quantité réelle saisie moins stock système. Positif = surplus, négatif = manque.">
                      Écart ⓘ
                    </span>
                  </th>
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
                      className={`border-b border-gray-100 last:border-0 transition-colors ${motifManquant ? 'bg-danger-bg' : ''}`}
                    >
                      <td className="py-2 pr-4">{ligne.medicament.nom}</td>
                      <td className="py-2 text-right text-gray-600">{stockSysteme}</td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          defaultValue={ligne.quantiteReelle}
                          onChange={(e) => mettreAJourQuantite(ligne.id, e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded-card text-right focus:outline-none focus:ring-2 focus:ring-mint/50 focus:border-mint"
                        />
                      </td>
                      <td className={`py-2 text-right font-medium pr-4 ${
                        ligne.ecart < 0 ? 'text-danger'
                        : ligne.ecart > 0 ? 'text-success'
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
                            className={`w-full px-3 py-1 border rounded-card focus:outline-none focus:ring-2 focus:ring-mint/50 text-sm ${
                              motifManquant
                                ? 'border-danger bg-surface ring-1 ring-danger/30'
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
            <Button
              variant="secondary"
              onClick={sauvegarderProgression}
              loading={sauvegardeProgression}
            >
              💾 Enregistrer la progression
            </Button>
            <Button
              variant="primary"
              onClick={validerInventaire}
              loading={saving}
              disabled={lignesAvecEcartSansMotif > 0}
            >
              Valider et ajuster le stock
            </Button>
            {derniereSauvegarde && (
              <p className="text-xs text-gray-400">
                Dernière sauvegarde : {derniereSauvegarde.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {lignesAvecEcartSansMotif > 0 && (
              <p className="text-sm text-danger">
                {lignesAvecEcartSansMotif} ligne{lignesAvecEcartSansMotif > 1 ? 's' : ''} avec
                écart nécessite{lignesAvecEcartSansMotif > 1 ? 'nt' : ''} un motif
              </p>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            "Enregistrer la progression" sauvegarde vos saisies sans toucher au stock — pratique
            pour étaler un inventaire sur plusieurs jours. Le stock n'est ajusté qu'au clic sur
            "Valider et ajuster le stock".
          </p>
        </Card>
      )}

      {/* ── VUE LECTURE SEULE (VALIDE) ───────────────────────────────────── */}
      {lecture && (
        <Card>
          <p className="text-sm text-gray-500 mb-4">
            Validé par{' '}
            <span className="font-medium text-navy">{lecture.user.nom}</span>
          </p>

          <CardsRapport {...rapport} />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
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
                    <tr key={ligne.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 pr-4 font-medium text-navy">{ligne.medicament.nom}</td>
                      <td className="py-3 text-right text-gray-600">{stockTheorique}</td>
                      <td className="py-3 text-right text-navy">{ligne.quantiteReelle}</td>
                      <td className={`py-3 text-right font-medium pr-4 ${
                        ligne.ecart < 0 ? 'text-danger'
                        : ligne.ecart > 0 ? 'text-success'
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
        </Card>
      )}

      {/* ── LISTE DES INVENTAIRES ────────────────────────────────────────── */}
      {!actif && !lecture && (
        <Card padding="none" className="overflow-hidden">
          {inventaires.length === 0 ? (
            <EmptyState
              icon="📋"
              title="Aucun inventaire pour l'instant"
              description="Lancez votre premier inventaire pour comparer le stock théorique au stock réel."
              action={<Button variant="primary" onClick={lancerInventaire} loading={saving}>Lancer un inventaire</Button>}
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-app-bg border-b border-gray-100">
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
                {inventaires.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-app-bg">
                    <td className="px-6 py-4">{formatDateTime(inv.createdAt)}</td>
                    <td className="px-6 py-4 text-gray-700">{inv.user.nom}</td>
                    <td className="px-6 py-4 text-center text-gray-500">{inv.nbLignes ?? '—'}</td>
                    <td className="px-6 py-4 text-center">
                      {inv.nbEcarts != null && inv.nbEcarts > 0 ? (
                        <span className="font-medium text-warning-text">{inv.nbEcarts}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={inv.statut === 'VALIDE' ? 'success' : 'warning'}>
                        {inv.statut}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => ouvrirInventaire(inv)}
                        className={`text-sm font-medium ${
                          inv.statut === 'VALIDE'
                            ? 'text-info-text hover:underline'
                            : 'text-mint-dark hover:underline'
                        }`}
                      >
                        {inv.statut === 'VALIDE' ? 'Revoir →' : 'Reprendre →'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

    </div>
  )
}
