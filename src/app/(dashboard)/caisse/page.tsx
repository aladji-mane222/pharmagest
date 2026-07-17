// CIBLE: src/app/(dashboard)/caisse/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { formatMontant, formatDateTime } from '@/lib/utils'
import { Modal, useToast, Button, Card, Badge, PageHeader, EmptyState } from '@/components/ui'

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
  const [suggestionOuverture, setSuggestionOuverture] = useState<{ montant: number; nomUser: string; date: string } | null>(null)
  const [montantCloture, setMontantCloture] = useState('')
  const [totalEncaisse, setTotalEncaisse] = useState(0)
  const [parMode, setParMode] = useState<{ modePaiement: string; total: number }[]>([])
  const [confirmFermer, setConfirmFermer] = useState(false)
  const { showToast } = useToast()

  // Chargement initial
  useEffect(() => {
    fetch('/api/caisse')
      .then((res) => res.json())
      .then((json) => {
        setSessionActive(json.data?.sessionActive || null)
        setHistorique(json.data?.historique || [])
        const derniere = json.data?.derniereSessionFermee
        if (derniere && derniere.montantCloture !== null) {
          setSuggestionOuverture({
            montant: derniere.montantCloture,
            nomUser: derniere.user?.nom || 'un autre utilisateur',
            date: derniere.dateCloture,
          })
          // Pre-rempli mais reste un champ texte normal, entierement modifiable —
          // le caissier compte l'argent reel et corrige si besoin.
          setMontantOuverture(String(derniere.montantCloture))
        }
        setLoading(false)
      })
  }, [])

  // Fetch total encaissé dès qu'une session active est connue
  useEffect(() => {
    if (!sessionActive?.id) {
      setTotalEncaisse(0)
      setParMode([])
      return
    }
    fetch(`/api/ventes?sessionCaisseId=${sessionActive.id}`)
      .then((res) => res.json())
      .then((json) => {
        setTotalEncaisse(json.data?.totalEncaisse ?? 0)
        setParMode(json.data?.parMode ?? [])
      })
  }, [sessionActive?.id])

  // Le tiroir ne contient physiquement que les especes — le mobile money,
  // la carte, etc. sont recus mais jamais dans la caisse. Compter tous les
  // modes dans le "total attendu en especes" aurait cree un faux "manque"
  // a chaque vente payee en mobile money.
  const totalEspeces = parMode.find((m) => m.modePaiement === 'ESPECES')?.total ?? 0
  const totalAttendu = (sessionActive?.montantOuverture ?? 0) + totalEspeces
  const montantClotureNum = parseFloat(montantCloture) || 0
  const ecart = montantCloture !== '' ? montantClotureNum - totalAttendu : null

  const libelleModePaiement = (mode: string) => {
    const libelles: Record<string, string> = {
      ESPECES: 'Especes',
      MOBILE_MONEY: 'Mobile Money',
      ORANGE_MONEY: 'Orange Money',
      MTN_MONEY: 'MTN Money',
      PAIEMENT_MARCHAND: 'Paiement Marchand',
      CARTE: 'Carte',
    }
    return libelles[mode] || mode
  }

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
      showToast(json.error ?? 'Erreur lors de l\'ouverture', 'error')
    }
    setSaving(false)
  }

  const doFermerSession = async () => {
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
      showToast(json.error ?? 'Erreur lors de la fermeture', 'error')
    }
    setSaving(false)
    setConfirmFermer(false)
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8">
      <PageHeader title="Caisse" description="Ouverture, cloture et suivi des sessions" />

      <div className="grid grid-cols-2 gap-6 mb-8">

        {/* ── Session actuelle ── */}
        <Card>
          <h2 className="font-semibold text-navy mb-4">Session actuelle</h2>

          {sessionActive ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="success">● Session ouverte</Badge>
              </div>

              <div className="space-y-1 mb-4 text-sm text-gray-500">
                <p>Ouverte par : <span className="font-medium text-gray-700">{sessionActive.user.nom}</span></p>
                <p>Depuis : <span className="font-medium text-gray-700">{formatDateTime(sessionActive.dateOuverture)}</span></p>
                <p>Montant ouverture : <span className="font-medium text-gray-700">{formatMontant(sessionActive.montantOuverture)}</span></p>
              </div>

              {/* Totaux encaissé / attendu */}
              <div className="bg-app-bg rounded-card p-3 mb-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total encaissé (tous modes)</span>
                  <span className="font-semibold text-green-600">{formatMontant(totalEncaisse)}</span>
                </div>
                {parMode.length > 0 && (
                  <div className="pl-3 space-y-0.5 border-l-2 border-gray-200 ml-1">
                    {parMode.map((m) => (
                      <div key={m.modePaiement} className="flex justify-between text-gray-400">
                        <span>{libelleModePaiement(m.modePaiement)}</span>
                        <span>{formatMontant(m.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between pt-1">
                  <span className="text-gray-500">Total attendu en especes</span>
                  <span className="font-semibold text-blue-600">{formatMontant(totalAttendu)}</span>
                </div>
                <p className="text-xs text-gray-400">
                  Ouverture + especes recues uniquement — le mobile money et la carte ne sont
                  jamais dans le tiroir.
                </p>
              </div>

              {/* Clôture */}
              <div className="flex gap-3 mb-3">
                <input
                  type="number"
                  placeholder="Montant compté en caisse"
                  value={montantCloture}
                  onChange={(e) => setMontantCloture(e.target.value)}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <Button variant="danger" onClick={() => setConfirmFermer(true)} loading={saving}>
                  Fermer
                </Button>
              </div>

              {/* Écart en temps réel — seuil : 0 = équilibré, jusqu'à 5000 GNF = petit écart
                  (marge d'erreur typique de comptage manuel), au-dela = écart important a
                  investiguer. Pas encore configurable par pharmacie (prevu Phase 6). */}
              {ecart !== null && (() => {
                const SEUIL_PETIT_ECART = 5000
                const abs = Math.abs(ecart)
                const niveau =
                  abs === 0 ? 'equilibre' : abs <= SEUIL_PETIT_ECART ? 'petit' : 'important'
                const styleTokens = {
                  equilibre: 'bg-success-bg text-success-text',
                  petit: 'bg-warning-bg text-warning-text',
                  important: 'bg-danger-bg text-danger-text',
                }[niveau]
                const texte =
                  niveau === 'equilibre'
                    ? '✓ Caisse équilibrée'
                    : ecart > 0
                      ? `▲ Excédent : +${formatMontant(ecart)}${niveau === 'important' ? ' — écart important' : ''}`
                      : `▼ Manque : ${formatMontant(ecart)}${niveau === 'important' ? ' — écart important' : ''}`
                return (
                  <div className={`text-sm font-medium px-3 py-2 rounded-card ${styleTokens}`}>
                    {texte}
                  </div>
                )
              })()}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="neutral">Aucune session ouverte</Badge>
              </div>
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="Montant d'ouverture"
                  value={montantOuverture}
                  onChange={(e) => setMontantOuverture(e.target.value)}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-card focus:outline-none focus:ring-2 focus:ring-mint/50 focus:border-mint"
                />
                <Button variant="primary" onClick={ouvrirSession} loading={saving}>
                  Ouvrir
                </Button>
              </div>
              {suggestionOuverture && (
                <p className="text-xs text-gray-400 mt-2">
                  Suggestion : {formatMontant(suggestionOuverture.montant)} — montant compte a la
                  derniere fermeture ({suggestionOuverture.nomUser}, {formatDateTime(suggestionOuverture.date)}).
                  Comptez le tiroir et corrigez si besoin, ce n&apos;est qu&apos;une proposition.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* ── Historique ── */}
        <Card>
          <h2 className="font-semibold text-navy mb-4">Historique sessions</h2>
          {historique.length === 0 ? (
            <EmptyState icon="🗒️" title="Aucune session" description="L'historique des sessions caisse apparaitra ici." />
          ) : (
            <ul className="space-y-3">
              {historique.slice(0, 5).map((s) => (
                <li key={s.id} className="border border-gray-100 rounded-card p-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-navy">{s.user.nom}</span>
                    <Badge variant={!s.dateCloture ? 'success' : 'neutral'}>
                      {!s.dateCloture ? 'OUVERTE' : 'FERMÉE'}
                    </Badge>
                  </div>
                  <p className="text-gray-500">{formatDateTime(s.dateOuverture)}</p>
                  {s.montantCloture != null && (
                    <p className="text-blue-600 font-medium">{formatMontant(s.montantCloture)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

      </div>

      <Modal
        open={confirmFermer}
        onClose={() => setConfirmFermer(false)}
        onConfirm={doFermerSession}
        title="Fermer la session caisse ?"
        description="Cette action clôturera la session en cours. Vérifiez que le montant compté est correct avant de confirmer."
        variant="danger"
        confirmLabel="Fermer la session"
        loading={saving}
      />
    </div>
  )
}