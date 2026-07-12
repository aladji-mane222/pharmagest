'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatMontant, formatDate } from '@/lib/utils'
import { Modal, useToast } from '@/components/ui'

interface Lot {
  id: string
  numeroLot: string | null
  datePeremption: string
  quantite: number
  prixAchat: number | null
}

interface Medicament {
  id: string
  nom: string
  categorie: string | null
  description: string | null
  unite: string
  prixVente: number
  prixAchat: number | null
  stockMinimum: number
  stockTotal: number
  lots: Lot[]
}

export default function FicheMedicamentPage() {
  const { id } = useParams()
  const router = useRouter()
  const [med, setMed] = useState<Medicament | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/medicaments/${id}`)
      .then((res) => res.json())
      .then((json) => {
        setMed(json.data)
        setLoading(false)
      })
  }, [id])

  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const { showToast } = useToast()

  const handleArchiver = async () => {
    setArchiving(true)
    try {
      const res = await fetch(`/api/medicaments/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        showToast(json.error || 'Erreur lors de l\'archivage', 'error')
        return
      }
      showToast('Médicament archivé', 'success')
      router.push('/medicaments')
    } finally {
      setArchiving(false)
      setConfirmArchive(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>
  if (!med) return <div className="p-8 text-red-500">Medicament non trouve</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{med.nom}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/medicaments/${id}/modifier`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Modifier
          </button>
          <button
            onClick={() => setConfirmArchive(true)}
            className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200"
          >
            Archiver
          </button>
        </div>
      </div>

      {med.lots.some((lot) => lot.prixAchat !== null && lot.prixAchat > med.prixVente) && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          ⚠️ Au moins un lot a été acheté plus cher que le prix de vente actuel ({formatMontant(med.prixVente)}) —
          vérifie le tableau des lots ci-dessous : soit une erreur de saisie, soit le prix de vente doit être augmenté.
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Informations</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Categorie</dt>
              <dd className="font-medium">{med.categorie || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Unite</dt>
              <dd className="font-medium">{med.unite}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Prix de vente</dt>
              <dd className="font-medium text-green-600">{formatMontant(med.prixVente)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Prix d achat</dt>
              <dd className="font-medium">{med.prixAchat ? formatMontant(med.prixAchat) : '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Stock minimum</dt>
              <dd className="font-medium">{med.stockMinimum}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Stock actuel</h2>
          <p className={`text-4xl font-bold ${med.stockTotal < med.stockMinimum ? 'text-red-500' : 'text-green-600'}`}>
            {med.stockTotal}
          </p>
          <p className="text-gray-500 text-sm mt-1">{med.unite}s en stock</p>
          {med.stockTotal < med.stockMinimum && (
            <p className="text-red-500 text-sm mt-2">Stock bas — reapprovisionner</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold text-gray-700 mb-4">Lots actifs</h2>
        {med.lots.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucun lot actif</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 text-gray-500">Numero lot</th>
                <th className="text-left py-2 text-gray-500">Peremption</th>
                <th className="text-right py-2 text-gray-500">Quantite</th>
                <th className="text-right py-2 text-gray-500">Prix d&apos;achat</th>
              </tr>
            </thead>
            <tbody>
              {med.lots.map((lot) => {
                // Signale un prix d'achat de lot anormal : soit superieur au
                // prix de vente (perte garantie sur ce lot), soit nettement
                // au-dessus du prix de reference du medicament (>20%) — aide
                // a repérer une erreur de saisie ou une vraie hausse
                // fournisseur a traiter (ajuster le prix de vente ou verifier
                // aupres du fournisseur).
                const prixAchatSuperieurVente = lot.prixAchat !== null && lot.prixAchat > med.prixVente
                const prixAchatEleve =
                  !prixAchatSuperieurVente &&
                  lot.prixAchat !== null &&
                  med.prixAchat !== null &&
                  lot.prixAchat > med.prixAchat * 1.2
                return (
                  <tr key={lot.id} className="border-b last:border-0">
                    <td className="py-2">{lot.numeroLot || '-'}</td>
                    <td className="py-2">{formatDate(lot.datePeremption)}</td>
                    <td className="py-2 text-right font-medium">{lot.quantite}</td>
                    <td className="py-2 text-right">
                      {lot.prixAchat === null ? (
                        <span className="text-gray-400">-</span>
                      ) : (
                        <span
                          className={
                            prixAchatSuperieurVente
                              ? 'text-danger font-medium'
                              : prixAchatEleve
                              ? 'text-warning font-medium'
                              : 'text-gray-700'
                          }
                          title={
                            prixAchatSuperieurVente
                              ? `Superieur au prix de vente (${formatMontant(med.prixVente)}) — perte garantie sur ce lot`
                              : prixAchatEleve
                              ? `Plus de 20% au-dessus du prix d'achat de reference (${formatMontant(med.prixAchat!)})`
                              : undefined
                          }
                        >
                          {formatMontant(lot.prixAchat)}
                          {(prixAchatSuperieurVente || prixAchatEleve) && ' ⚠️'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={handleArchiver}
        title="Archiver ce médicament ?"
        description="Il ne sera plus visible dans les listes actives. Cette action peut être annulée par un administrateur depuis la base si besoin."
        variant="danger"
        confirmLabel="Archiver"
        loading={archiving}
      />
    </div>
  )
}