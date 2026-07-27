'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatMontant, formatDateTime } from '@/lib/utils'
import { useToast, Modal, Card, PageHeader, Button, Badge, Skeleton, SkeletonCard } from '@/components/ui'
import { ouvrirRecuPDF, telechargerRecuPDF, construireMessageWhatsApp, DonneesRecu } from '@/lib/recu'

interface LigneVente {
  id: string
  quantite: number
  prixUnitaire: number
  medicament: { nom: string; unite: string }
}

interface Vente {
  id: string
  numeroFacture: string | null
  montantTotal: number
  montantPaye: number
  monnaie: number
  remise: number
  modePaiement: string
  paiements?: { modePaiement: string; montant: number }[]
  statut: string
  motifAnnulation: string | null
  createdAt: string
  user: { nom: string }
  client: { id: string; nom: string; telephone: string | null } | null
  lignes: LigneVente[]
}

const MODE_LABELS: Record<string, string> = {
  ESPECES:           'Espèces',
  MOBILE_MONEY:      'Mobile Money',
  ORANGE_MONEY:      'Orange Money',
  MTN_MONEY:         'MTN Money',
  PAIEMENT_MARCHAND: 'Paiement Marchand',
  CARTE:             'Carte',
  CREDIT:            'Crédit',
  MIXTE:             'Mixte',
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral'

const STATUT_BADGE: Record<string, BadgeVariant> = {
  COMPLETE:  'success',
  PARTIELLE: 'warning',
  ANNULEE:   'danger',
}

const STATUT_LABEL: Record<string, string> = {
  COMPLETE:  'Complète',
  PARTIELLE: 'Partielle (crédit)',
  ANNULEE:   'Annulée',
}

export default function VenteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'
  const peutAnnuler = isAdmin || !!session?.user?.permissions?.includes('ANNULER_VENTE')
  const { showToast } = useToast()

  const [vente,   setVente]   = useState<Vente | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur,  setErreur]  = useState<string | null>(null)

  const [nomPharmacie, setNomPharmacie] = useState('Ma Pharmacie')
  const [formatRecu, setFormatRecu] = useState<'A4' | 'THERMIQUE_58' | 'THERMIQUE_80'>('A4')
  const [showRecu, setShowRecu] = useState(false)
  const [whatsappOuvert, setWhatsappOuvert] = useState(false)
  const [whatsappNumero, setWhatsappNumero] = useState('')

  // Modal annulation
  const [showModal, setShowModal] = useState(false)
  const [motif,     setMotif]     = useState('')
  const [annulation, setAnnulation] = useState(false)
  const [erreurAnnulation, setErreurAnnulation] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/ventes/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setVente(json.data)
        else setErreur('Vente introuvable')
        setLoading(false)
      })
      .catch(() => { setErreur('Erreur de chargement'); setLoading(false) })

    fetch('/api/parametres')
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.nom) setNomPharmacie(json.data.nom)
        if (json.data?.formatRecu) setFormatRecu(json.data.formatRecu)
      })
      .catch(() => {})
  }, [id])

  const annulerVente = async () => {
    if (!motif.trim()) { setErreurAnnulation('Le motif est obligatoire'); return }
    setAnnulation(true)
    setErreurAnnulation(null)
    const res  = await fetch(`/api/ventes/${id}/annuler`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ motif }),
    })
    const json = await res.json()
    if (res.ok) {
      setVente((v) => v ? { ...v, statut: 'ANNULEE' } : v)
      setShowModal(false)
      setMotif('')
    } else {
      setErreurAnnulation(json.error || 'Erreur lors de l\'annulation')
    }
    setAnnulation(false)
  }

  const lienRetour = (
    <Link href="/ventes/historique" className="text-sm text-gray-500 hover:text-mint-dark hover:underline mb-4 inline-block">
      ← Retour à l'historique
    </Link>
  )

  if (loading) {
    return (
      <div className="p-8 max-w-3xl">
        {lienRetour}
        <Skeleton className="h-8 w-64 mb-6" />
        <SkeletonCard />
      </div>
    )
  }
  if (erreur)  return (
    <div className="p-8">
      {lienRetour}
      <p className="text-danger">{erreur}</p>
    </div>
  )
  if (!vente) return null

  const resteADu = Math.max(0, vente.montantTotal - vente.montantPaye)

  const donneesRecuPourImpression = (): DonneesRecu => ({
    nomPharmacie,
    numero: vente.numeroFacture || vente.id,
    date: formatDateTime(vente.createdAt),
    lignes: vente.lignes.map((l) => ({ nom: l.medicament.nom, quantite: l.quantite, prixUnitaire: l.prixUnitaire })),
    montantTotal: vente.montantTotal,
    paiements: vente.paiements && vente.paiements.length > 0
      ? vente.paiements
      : vente.montantPaye > 0 ? [{ modePaiement: vente.modePaiement, montant: vente.montantPaye }] : [],
    monnaie: vente.monnaie,
    resteADu,
    clientNom: vente.client?.nom || null,
    formatRecu,
  })

  return (
    <div className="p-8 max-w-3xl">
      {lienRetour}

      {/* Header */}
      <PageHeader
        title={`Détail de la vente${vente.numeroFacture ? ` — ${vente.numeroFacture}` : ''}`}
        actions={
          <>
            {vente.statut !== 'ANNULEE' && (
              <Button variant="secondary" size="sm" onClick={() => setShowRecu(true)}>
                🖨️ Imprimer / Envoyer
              </Button>
            )}
            {peutAnnuler && vente.statut !== 'ANNULEE' && (
              <Button variant="danger" size="sm" onClick={() => setShowModal(true)}>
                Annuler la vente
              </Button>
            )}
          </>
        }
      />

      {/* Carte infos générales */}
      <Card className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-gray-500">Date</p>
            <p className="font-medium text-navy">{formatDateTime(vente.createdAt)}</p>
          </div>
          <Badge variant={STATUT_BADGE[vente.statut] ?? 'neutral'}>
            {STATUT_LABEL[vente.statut] ?? vente.statut}
          </Badge>
        </div>
        {vente.statut === 'ANNULEE' && vente.motifAnnulation && (
          <p className="text-sm text-gray-500 mb-2">Motif : {vente.motifAnnulation}</p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Caissier</p>
            <p className="font-medium text-navy">{vente.user.nom}</p>
          </div>
          <div>
            <p className="text-gray-500">Mode de paiement</p>
            <p className="font-medium text-navy">{MODE_LABELS[vente.modePaiement] ?? vente.modePaiement}</p>
            {vente.modePaiement === 'MIXTE' && vente.paiements && vente.paiements.length > 0 && (
              <ul className="text-sm text-gray-500 mt-1">
                {vente.paiements.map((p, i) => (
                  <li key={i}>{MODE_LABELS[p.modePaiement] ?? p.modePaiement} : {formatMontant(p.montant)}</li>
                ))}
              </ul>
            )}
          </div>
          {vente.client && (
            <div>
              <p className="text-gray-500">Client</p>
              <Link href={`/clients/${vente.client.id}`}
                className="font-medium text-mint-dark hover:underline">
                {vente.client.nom}
              </Link>
              {vente.client.telephone && (
                <p className="text-gray-400 text-xs mt-0.5">{vente.client.telephone}</p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Lignes de vente */}
      <Card padding="none" className="overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 bg-app-bg">
          <h2 className="font-semibold text-navy">Articles vendus</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100">
            <tr>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Médicament</th>
              <th className="text-center px-6 py-3 text-gray-500 font-medium">Qté</th>
              <th className="text-right px-6 py-3 text-gray-500 font-medium">Prix unit.</th>
              <th className="text-right px-6 py-3 text-gray-500 font-medium">Sous-total</th>
            </tr>
          </thead>
          <tbody>
            {vente.lignes.map((ligne) => (
              <tr key={ligne.id} className="border-b border-gray-100 last:border-0 hover:bg-app-bg">
                <td className="px-6 py-3 font-medium text-navy">
                  {ligne.medicament.nom}
                  <span className="ml-1 text-xs text-gray-400">{ligne.medicament.unite}</span>
                </td>
                <td className="px-6 py-3 text-center text-gray-600">{ligne.quantite}</td>
                <td className="px-6 py-3 text-right text-gray-600">{formatMontant(ligne.prixUnitaire)}</td>
                <td className="px-6 py-3 text-right font-medium">{formatMontant(ligne.prixUnitaire * ligne.quantite)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Récapitulatif financier */}
      <Card>
        <h2 className="font-semibold text-navy mb-4">Récapitulatif</h2>
        <div className="space-y-2 text-sm max-w-xs ml-auto">
          {vente.remise > 0 && (
            <>
              <div className="flex justify-between text-gray-500">
                <span>Sous-total</span>
                <span>{formatMontant(vente.montantTotal + vente.remise)}</span>
              </div>
              <div className="flex justify-between text-warning-text">
                <span>Remise</span>
                <span>−{formatMontant(vente.remise)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2">
            <span>Total</span>
            <span className="text-navy">{formatMontant(vente.montantTotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Montant payé</span>
            <span className="text-success font-medium">{formatMontant(vente.montantPaye)}</span>
          </div>
          {vente.monnaie > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Monnaie rendue</span>
              <span>{formatMontant(vente.monnaie)}</span>
            </div>
          )}
          {resteADu > 0 && (
            <div className="flex justify-between font-medium text-danger border-t border-gray-100 pt-2">
              <span>Reste dû (crédit)</span>
              <span>{formatMontant(resteADu)}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Modal annulation */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setMotif(''); setErreurAnnulation(null) }}
        onConfirm={annulerVente}
        title="Annuler la vente"
        variant="danger"
        confirmLabel="Confirmer l'annulation"
        loading={annulation}
      >
        <p className="text-sm text-gray-600 mb-4">
          Le stock sera remis à jour automatiquement.
          {resteADu > 0 && ` Le crédit de ${formatMontant(resteADu)} sera déduit du solde client.`}
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Motif <span className="text-danger">*</span>
        </label>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-card focus:outline-none focus:ring-2 focus:ring-danger/40 text-sm resize-none"
          placeholder="Ex: Erreur de saisie, retour client..."
        />
        {erreurAnnulation && (
          <p className="text-danger text-sm mt-2">{erreurAnnulation}</p>
        )}
      </Modal>
      {/* Modal recu — impression / WhatsApp depuis l'historique, meme logique
          que juste apres la vente (Corrige le 17/07 : avant, on ne pouvait
          imprimer ou renvoyer un recu que juste apres l'avoir encaissee). */}
      {showRecu && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card shadow-lg p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div>
              <div className="text-center mb-4">
                <p className="font-bold text-lg text-navy">{nomPharmacie}</p>
                <p className="text-xs text-gray-400 mt-1">Recu {vente.numeroFacture || vente.id}</p>
                <p className="text-xs text-gray-400">{formatDateTime(vente.createdAt)}</p>
              </div>
              <div className="border-t pt-2 mb-2 space-y-2">
                {vente.lignes.map((l) => (
                  <div key={l.id}>
                    <p className="leading-snug">{l.medicament.nom}</p>
                    <div className="flex justify-between text-gray-500">
                      <span>{l.quantite} x {formatMontant(l.prixUnitaire)}</span>
                      <span className="font-medium text-gray-800">
                        {formatMontant(l.prixUnitaire * l.quantite)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 space-y-1 text-sm">
                <div className="flex justify-between font-bold text-success">
                  <span>Total</span>
                  <span>{formatMontant(vente.montantTotal)}</span>
                </div>
                {vente.paiements && vente.paiements.length > 0 ? (
                  vente.paiements.map((p, i) => (
                    <div key={i} className="flex justify-between text-gray-600">
                      <span>{MODE_LABELS[p.modePaiement] ?? p.modePaiement}</span>
                      <span>{formatMontant(p.montant)}</span>
                    </div>
                  ))
                ) : (
                  vente.montantPaye > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>{MODE_LABELS[vente.modePaiement] ?? vente.modePaiement}</span>
                      <span>{formatMontant(vente.montantPaye)}</span>
                    </div>
                  )
                )}
                {vente.monnaie > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Monnaie</span>
                    <span>{formatMontant(vente.monnaie)}</span>
                  </div>
                )}
                {resteADu > 0 && (
                  <div className="flex justify-between text-danger font-medium">
                    <span>Reste a payer (credit{vente.client ? ` — ${vente.client.nom}` : ''})</span>
                    <span>{formatMontant(resteADu)}</span>
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-gray-400 mt-4">Merci de votre confiance !</p>
            </div>

            <div className="mt-6 space-y-3">
              <p className="text-xs text-gray-400 text-center">
                Format actif : {formatRecu === 'A4' ? 'A4' : formatRecu === 'THERMIQUE_58' ? 'Thermique 58mm' : 'Thermique 80mm'}
                {' '}(<Link href="/parametres" className="underline hover:text-mint">changer</Link>)
                {' '}— la taille est fixee dans le fichier PDF genere, fiable quelle que soit l'imprimante.
              </p>
              <button
                onClick={async () => {
                  try {
                    await ouvrirRecuPDF(donneesRecuPourImpression())
                  } catch {
                    showToast('Fenetre bloquee — autorise les pop-ups pour ce site puis reessaie', 'error')
                  }
                }}
                className="w-full bg-mint text-navy px-6 py-2.5 rounded-card font-medium hover:opacity-90 transition-opacity">
                📄 Ouvrir le recu (PDF)
              </button>
              <button
                onClick={async () => {
                  try {
                    await telechargerRecuPDF(donneesRecuPourImpression())
                  } catch {
                    showToast('Erreur lors de la generation du PDF', 'error')
                  }
                }}
                className="w-full bg-white text-navy border border-navy/20 px-6 py-2.5 rounded-card font-medium hover:bg-navy/5 transition-colors">
                ⬇️ Telecharger le PDF
              </button>
              <button
                onClick={() => {
                  setWhatsappNumero(vente.client?.telephone || '')
                  setWhatsappOuvert(true)
                }}
                className="w-full bg-[#25D366] text-white px-6 py-2.5 rounded-card font-medium hover:opacity-90 transition-opacity">
                📱 Envoyer par WhatsApp
              </button>
              <button onClick={() => setShowRecu(false)}
                className="w-full bg-gray-100 text-gray-700 px-6 py-2.5 rounded-card font-medium hover:bg-gray-200">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={whatsappOuvert}
        onClose={() => setWhatsappOuvert(false)}
        title="Envoyer le recu par WhatsApp"
        onConfirm={() => {
          if (!whatsappNumero.trim()) {
            showToast('Entre un numero WhatsApp', 'error')
            return
          }
          const message = construireMessageWhatsApp(donneesRecuPourImpression())
          window.open(`https://wa.me/${whatsappNumero.trim()}?text=${message}`, '_blank')
          setWhatsappOuvert(false)
        }}
        confirmLabel="Envoyer"
      >
        <label className="block text-sm font-medium text-gray-700 mb-1">Numero WhatsApp du client</label>
        <input
          type="tel"
          autoFocus
          value={whatsappNumero}
          onChange={(e) => setWhatsappNumero(e.target.value)}
          placeholder="Ex: 224620000000"
          className="w-full px-4 py-2 border border-gray-300 rounded-card focus:outline-none focus:ring-2 focus:ring-mint/50 focus:border-mint"
        />
        {vente.client?.telephone && (
          <p className="text-xs text-gray-400 mt-1">Pre-rempli avec le numero de {vente.client.nom} — modifiable si besoin.</p>
        )}
      </Modal>
    </div>
  )
}