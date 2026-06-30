'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  statut: string
  createdAt: string
  lignes: LigneVente[]
}

interface Client {
  id: string
  nom: string
  telephone: string | null
  email: string | null
  soldeCredit: number
  plafondCredit: number
  actif: boolean
  createdAt: string
  ventes: Vente[]
}

export default function FicheClientPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'
  const id = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editForm, setEditForm] = useState({ nom: '', telephone: '', email: '', plafondCredit: '' })
  const [saving, setSaving] = useState(false)

  const [montantRemb, setMontantRemb] = useState('')
  const [rembSaving, setRembSaving] = useState(false)
  const [rembError, setRembError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setClient(json.data)
          setEditForm({
            nom: json.data.nom,
            telephone: json.data.telephone || '',
            email: json.data.email || '',
            plafondCredit: String(json.data.plafondCredit),
          })
        }
        setLoading(false)
      })
  }, [id])

  const handleModifier = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: editForm.nom,
        telephone: editForm.telephone || null,
        email: editForm.email || null,
        plafondCredit: editForm.plafondCredit,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setClient((prev) => prev ? { ...prev, ...json.data } : null)
      setShowModal(false)
    } else {
      setErrorMsg(json.error || 'Erreur lors de la modification')
    }
    setSaving(false)
  }

  const handleArchiver = async () => {
    if (!confirm(`Archiver ${client?.nom} ? Cette action est irréversible.`)) return
    setErrorMsg(null)
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (res.ok) {
      router.push('/clients')
    } else {
      setErrorMsg(json.error || "Erreur lors de l'archivage")
    }
  }

  const handleRembourser = async (e: React.FormEvent) => {
    e.preventDefault()
    setRembError(null)
    setRembSaving(true)
    const res = await fetch(`/api/clients/${id}/rembourser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ montant: montantRemb }),
    })
    const json = await res.json()
    if (res.ok) {
      setClient((prev) => prev ? { ...prev, soldeCredit: json.data.soldeCredit } : null)
      setMontantRemb('')
    } else {
      setRembError(json.error || 'Erreur lors du remboursement')
    }
    setRembSaving(false)
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>
  if (!client) return <div className="p-8 text-red-500">Client introuvable.</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/clients" className="text-gray-500 hover:text-gray-800 text-sm">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">{client.nom}</h1>
        {!client.actif && (
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Archive</span>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {errorMsg}
        </div>
      )}

      {/* SECTION 1 — Infos client */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex justify-between items-start">
          <div className="grid grid-cols-2 gap-x-16 gap-y-4 text-sm">
            <div>
              <p className="text-gray-500">Telephone</p>
              <p className="font-medium text-gray-800 mt-0.5">{client.telephone || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              <p className="font-medium text-gray-800 mt-0.5">{client.email || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Solde credit</p>
              <p className={`font-bold text-xl mt-0.5 ${client.soldeCredit > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatMontant(client.soldeCredit)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Plafond credit</p>
              <p className="font-medium text-gray-800 mt-0.5">{formatMontant(client.plafondCredit)}</p>
            </div>
          </div>

          {isAdmin && client.actif && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setShowModal(true)}
                className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Modifier
              </button>
              <button
                onClick={handleArchiver}
                className="bg-gray-100 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                Archiver
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2 — Remboursement */}
      {client.soldeCredit > 0 && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Enregistrer un remboursement</h2>
          <form onSubmit={handleRembourser} className="flex items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant (GNF)
              </label>
              <input
                required
                type="number"
                min="1"
                max={client.soldeCredit}
                value={montantRemb}
                onChange={(e) => setMontantRemb(e.target.value)}
                placeholder={`Max ${formatMontant(client.soldeCredit)}`}
                className="w-60 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              type="submit"
              disabled={rembSaving}
              className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {rembSaving ? 'Enregistrement...' : 'Enregistrer remboursement'}
            </button>
          </form>
          {rembError && (
            <p className="text-red-600 text-sm mt-2">{rembError}</p>
          )}
        </div>
      )}

      {/* SECTION 3 — Historique des ventes */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-800">
            Historique des ventes
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({client.ventes.length} dernière{client.ventes.length !== 1 ? 's' : ''})
            </span>
          </h2>
        </div>
        {client.ventes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucune vente enregistree</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Date</th>
                <th className="text-right px-6 py-3 text-gray-600">Total</th>
                <th className="text-right px-6 py-3 text-gray-600">Paye</th>
                <th className="text-right px-6 py-3 text-gray-600">Reste</th>
                <th className="text-center px-6 py-3 text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody>
              {client.ventes.map((v) => {
                const reste = Math.max(0, v.montantTotal - v.montantPaye)
                return (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-600">{formatDateTime(v.createdAt)}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-800">
                      {formatMontant(v.montantTotal)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {formatMontant(v.montantPaye)}
                    </td>
                    <td className={`px-6 py-4 text-right font-medium ${reste > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {reste > 0 ? formatMontant(reste) : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        v.statut === 'COMPLETE'  ? 'bg-green-100 text-green-700' :
                        v.statut === 'PARTIELLE' ? 'bg-orange-100 text-orange-700' :
                                                   'bg-gray-100 text-gray-500'
                      }`}>
                        {v.statut}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal modification */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Modifier le client</h2>
            <form onSubmit={handleModifier} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  required
                  value={editForm.nom}
                  onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
                <input
                  value={editForm.telephone}
                  onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })}
                  placeholder="+224 xxx xxx xxx"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="email@client.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plafond credit (GNF)</label>
                <input
                  type="number"
                  min="0"
                  value={editForm.plafondCredit}
                  onChange={(e) => setEditForm({ ...editForm, plafondCredit: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setErrorMsg(null) }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
