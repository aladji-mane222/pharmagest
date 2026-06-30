'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { formatMontant, formatDateTime } from '@/lib/utils'

interface LigneVente {
  id: string
  quantite: number
  prixUnitaire: number
  medicament: { nom: string }
}

interface Vente {
  id: string
  montantTotal: number
  montantPaye: number
  monnaie: number
  remise: number
  modePaiement: string
  statut: string
  createdAt: string
  user: { nom: string }
  client: { id: string; nom: string } | null
  lignes: LigneVente[]
}

const LABEL_MODE: Record<string, string> = {
  ESPECES: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  ORANGE_MONEY: 'Orange Money',
  MTN_MONEY: 'MTN Money',
  PAIEMENT_MARCHAND: 'Paiement Marchand',
  CARTE: 'Carte',
  CREDIT: 'Crédit',
}

export default function DetailVentePage() {
  const params = useParams()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'
  const id = params.id as string

  const [vente, setVente] = useState<Vente | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [motif, setMotif] = useState('')
  const [annulSaving, setAnnulSaving] = useState(false)
  const [annulError, setAnnulError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/ventes/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setVente(json.data)
        else setErrorMsg(json.error || 'Vente introuvable')
        setLoading(false)
      })
  }, [id])

  const handleAnnuler = async () => {
    setAnnulSaving(true)
    setAnnulError(null)
    const res = await fetch(`/api/ventes/${id}/annuler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motif }),
    })
    const json = await res.json()
    if (res.ok) {
      setVente((prev) => prev ? { ...prev, statut: 'ANNULEE' } : null)
      setShowModal(false)
      setMotif('')
    } else {
      setAnnulError(json.error || "Erreur lors de l'annulation")
    }
    setAnnulSaving(false)
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>
  if (!vente) return <div className="p-8 text-red-500">{errorMsg || 'Vente introuvable.'}</div>

  const sommeLignes = vente.montantTotal + vente.remise
  const resteADu = Math.max(0, vente.montantTotal - vente.montantPaye)

  const statutStyle =
    vente.statut === 'COMPLETE'  ? 'bg-green-100 text-green-700' :
    vente.statut === 'PARTIELLE' ? 'bg-orange-100 text-orange-700' :
                                   'bg-red-100 text-red-700'

  return (
    <div className="p-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/ventes/historique" className="text-gray-500 hover:text-gray-800 text-sm">
            ← Retour à l'historique
          </Link>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statutStyle}`}>
            {vente.statut}
          </span>
        </div>
        {isAdmin && vente.statut !== 'ANNULEE' && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg hover:bg-red-100 border border-red-200"
          >
            Annuler la vente
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {errorMsg}
        </div>
      )}

      {/* SECTION 1 — En-tête */}
      <div className="bg-white rounded-xl shadow p-6 mb-4">
        <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
          <div>
            <p className="text-gray-500">Date</p>
            <p className="font-medium text-gray-800 mt-0.5">{formatDateTime(vente.createdAt)}</p>
          </div>
          <div>
            <p className="text-gray-500">Mode de paiement</p>
            <p className="font-medium text-gray-800 mt-0.5">
              {LABEL_MODE[vente.modePaiement] || vente.modePaiement}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Caissier</p>
            <p className="font-medium text-gray-800 mt-0.5">{vente.user.nom}</p>
          </div>
        </div>
      </div>

      {/* SECTION 2 — Détail financier */}
      <div className="bg-white rounded-xl shadow p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Détail financier</h2>
        <div className="space-y-2 text-sm">
          {vente.remise > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Sous-total</span>
              <span>{formatMontant(sommeLignes)}</span>
            </div>
          )}
          {vente.remise > 0 && (
            <div className="flex justify-between text-red-500">
              <span>Remise</span>
              <span>-{formatMontant(vente.remise)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-gray-800 border-t pt-2">
            <span>Total</span>
            <span>{formatMontant(vente.montantTotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Montant payé</span>
            <span>{formatMontant(vente.montantPaye)}</span>
          </div>
          {resteADu > 0 && (
            <div className="flex justify-between font-medium text-orange-600">
              <span>Reste à payer</span>
              <span>{formatMontant(resteADu)}</span>
            </div>
          )}
          {vente.monnaie > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Monnaie rendue</span>
              <span>{formatMontant(vente.monnaie)}</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3 — Lignes de vente */}
      <div className="bg-white rounded-xl shadow overflow-hidden mb-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-800">
            Articles
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({vente.lignes.length} ligne{vente.lignes.length !== 1 ? 's' : ''})
            </span>
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-gray-600">Médicament</th>
              <th className="text-center px-6 py-3 text-gray-600">Quantité</th>
              <th className="text-right px-6 py-3 text-gray-600">Prix unitaire</th>
              <th className="text-right px-6 py-3 text-gray-600">Sous-total</th>
            </tr>
          </thead>
          <tbody>
            {vente.lignes.map((l) => (
              <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{l.medicament.nom}</td>
                <td className="px-6 py-4 text-center text-gray-600">{l.quantite}</td>
                <td className="px-6 py-4 text-right text-gray-600">{formatMontant(l.prixUnitaire)}</td>
                <td className="px-6 py-4 text-right font-medium text-gray-800">
                  {formatMontant(l.quantite * l.prixUnitaire)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SECTION 4 — Client (si crédit) */}
      {vente.client && (
        <div className="bg-white rounded-xl shadow p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Client</h2>
          <div className="flex justify-between items-center text-sm">
            <div>
              <p className="text-gray-500">Nom</p>
              <Link
                href={`/clients/${vente.client.id}`}
                className="font-medium text-green-600 hover:text-green-800 mt-0.5 block"
              >
                {vente.client.nom} →
              </Link>
            </div>
            {resteADu > 0 && (
              <div className="text-right">
                <p className="text-gray-500">Mis en crédit</p>
                <p className="font-semibold text-orange-600 mt-0.5">{formatMontant(resteADu)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal annulation */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Annuler la vente</h2>
            <p className="text-sm text-gray-500 mb-4">
              Le stock sera remis en place et le crédit client annulé si applicable.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motif d'annulation (optionnel)
              </label>
              <input
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex: Erreur de saisie, produit rendu..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            {annulError && (
              <p className="text-red-600 text-sm mb-3">{annulError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleAnnuler}
                disabled={annulSaving}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {annulSaving ? 'Annulation...' : 'Confirmer l\'annulation'}
              </button>
              <button
                onClick={() => { setShowModal(false); setAnnulError(null); setMotif('') }}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
              >
                Retour
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
