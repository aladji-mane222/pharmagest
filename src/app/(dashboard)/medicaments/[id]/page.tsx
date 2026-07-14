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
  codeBarre: string | null
  dci: string | null
  ordonnanceObligatoire: boolean
  lots: Lot[]
}

export default function FicheMedicamentPage() {
  const { id } = useParams()
  const router = useRouter()
  const { showToast } = useToast()

  const [med, setMed] = useState<Medicament | null>(null)
  const [loading, setLoading] = useState(true)

  const [modeEdition, setModeEdition] = useState(false)
  const [form, setForm] = useState({
    nom: '',
    description: '',
    categorie: '',
    unite: 'comprime',
    prixVente: '',
    prixAchat: '',
    stockMinimum: '10',
    codeBarre: '',
    dci: '',
    ordonnanceObligatoire: false,
  })
  const [saving, setSaving] = useState(false)
  const [erreurEdition, setErreurEdition] = useState('')

  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const charger = () => {
    setLoading(true)
    fetch(`/api/medicaments/${id}`)
      .then((res) => res.json())
      .then((json) => {
        const m = json.data as Medicament
        setMed(m)
        setForm({
          nom: m.nom || '',
          description: m.description || '',
          categorie: m.categorie || '',
          unite: m.unite || 'comprime',
          prixVente: m.prixVente?.toString() || '',
          prixAchat: m.prixAchat?.toString() || '',
          stockMinimum: m.stockMinimum?.toString() || '10',
          codeBarre: m.codeBarre || '',
          dci: m.dci || '',
          ordonnanceObligatoire: !!m.ordonnanceObligatoire,
        })
        setLoading(false)
      })
  }

  useEffect(() => {
    if (id) charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const enregistrer = async () => {
    if (!form.nom.trim() || !form.prixVente) {
      setErreurEdition('Nom et prix de vente requis')
      return
    }
    setSaving(true)
    setErreurEdition('')
    try {
      const res = await fetch(`/api/medicaments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        setErreurEdition(json.error || 'Erreur lors de la modification')
        return
      }
      showToast('Médicament modifié', 'success')
      setModeEdition(false)
      charger()
    } catch {
      setErreurEdition('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

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
          {!modeEdition && (
            <button
              onClick={() => setModeEdition(true)}
              className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Modifier
            </button>
          )}
          <button
            onClick={() => setConfirmArchive(true)}
            className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200 text-sm font-medium"
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

          {modeEdition ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categorie</label>
                <input
                  type="text"
                  value={form.categorie}
                  onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prix de vente (GNF) *</label>
                  <input
                    type="number"
                    value={form.prixVente}
                    onChange={(e) => setForm({ ...form, prixVente: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prix d achat (GNF)</label>
                  <input
                    type="number"
                    value={form.prixAchat}
                    onChange={(e) => setForm({ ...form, prixAchat: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unite</label>
                  <select
                    value={form.unite}
                    onChange={(e) => setForm({ ...form, unite: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="comprime">Comprime</option>
                    <option value="flacon">Flacon</option>
                    <option value="ampoule">Ampoule</option>
                    <option value="boite">Boite</option>
                    <option value="sachet">Sachet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Stock minimum</label>
                  <input
                    type="number"
                    value={form.stockMinimum}
                    onChange={(e) => setForm({ ...form, stockMinimum: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Code-barres</label>
                  <input
                    type="text"
                    value={form.codeBarre}
                    onChange={(e) => setForm({ ...form, codeBarre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Scanner ou saisir le code"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">DCI (nom generique)</label>
                  <input
                    type="text"
                    value={form.dci}
                    onChange={(e) => setForm({ ...form, dci: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Ex: Paracetamol"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ordonnanceObligatoire"
                  checked={form.ordonnanceObligatoire}
                  onChange={(e) => setForm({ ...form, ordonnanceObligatoire: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="ordonnanceObligatoire" className="text-xs font-medium text-gray-600">
                  Vente sur ordonnance uniquement
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={3}
                />
              </div>

              {erreurEdition && <p className="text-red-500 text-xs">{erreurEdition}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={enregistrer}
                  disabled={saving}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  onClick={() => { setModeEdition(false); setErreurEdition(''); charger() }}
                  className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
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
              <div className="flex justify-between">
                <dt className="text-gray-500">Code-barres</dt>
                <dd className="font-medium">{med.codeBarre || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">DCI</dt>
                <dd className="font-medium">{med.dci || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Ordonnance</dt>
                <dd className="font-medium">{med.ordonnanceObligatoire ? 'Obligatoire' : 'Libre'}</dd>
              </div>
            </dl>
          )}
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