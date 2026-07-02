'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
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
  modePaiement: string
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
  ventes: Vente[]
}

const STATUT_STYLE: Record<string, string> = {
  COMPLETE:  'bg-green-100 text-green-700',
  PARTIELLE: 'bg-orange-100 text-orange-700',
  ANNULEE:   'bg-red-100 text-red-700',
}

const STATUT_LABEL: Record<string, string> = {
  COMPLETE:  'Complète',
  PARTIELLE: 'Crédit',
  ANNULEE:   'Annulée',
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  const [client,  setClient]  = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur,  setErreur]  = useState<string | null>(null)

  // Remboursement
  const [montantRemb, setMontantRemb] = useState('')
  const [noteRemb,    setNoteRemb]    = useState('')
  const [savingRemb,  setSavingRemb]  = useState(false)
  const [errRemb,     setErrRemb]     = useState<string | null>(null)
  const [okRemb,      setOkRemb]      = useState(false)

  // Modification
  const [showEdit,    setShowEdit]    = useState(false)
  const [formEdit,    setFormEdit]    = useState({ nom: '', telephone: '', email: '', plafondCredit: '' })
  const [savingEdit,  setSavingEdit]  = useState(false)
  const [errEdit,     setErrEdit]     = useState<string | null>(null)

  // Archivage
  const [archiving,   setArchiving]   = useState(false)
  const [errArch,     setErrArch]     = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setClient(json.data)
          setFormEdit({
            nom:           json.data.nom,
            telephone:     json.data.telephone ?? '',
            email:         json.data.email ?? '',
            plafondCredit: String(json.data.plafondCredit),
          })
        } else {
          setErreur('Client introuvable')
        }
        setLoading(false)
      })
      .catch(() => { setErreur('Erreur de chargement'); setLoading(false) })
  }, [id])

  const handleRembourser = async () => {
    setErrRemb(null)
    setOkRemb(false)
    const montant = parseFloat(montantRemb)
    if (!montant || montant <= 0) { setErrRemb('Montant invalide'); return }
    setSavingRemb(true)
    const res  = await fetch(`/api/clients/${id}/rembourser`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ montant, note: noteRemb }),
    })
    const json = await res.json()
    if (res.ok) {
      setClient((c) => c ? { ...c, soldeCredit: json.data.soldeCredit } : c)
      setMontantRemb('')
      setNoteRemb('')
      setOkRemb(true)
      setTimeout(() => setOkRemb(false), 3000)
    } else {
      setErrRemb(json.error || 'Erreur lors du remboursement')
    }
    setSavingRemb(false)
  }

  const handleModifier = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrEdit(null)
    setSavingEdit(true)
    const res  = await fetch(`/api/clients/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        nom:           formEdit.nom,
        telephone:     formEdit.telephone || null,
        email:         formEdit.email || null,
        plafondCredit: parseFloat(formEdit.plafondCredit),
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setClient((c) => c ? { ...c, ...json.data } : c)
      setShowEdit(false)
    } else {
      setErrEdit(json.error || 'Erreur lors de la modification')
    }
    setSavingEdit(false)
  }

  const handleArchiver = async () => {
    if (!confirm(`Archiver ${client?.nom} ? Cette action est irréversible si le solde est à zéro.`)) return
    setErrArch(null)
    setArchiving(true)
    const res  = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (res.ok) {
      setClient((c) => c ? { ...c, actif: false } : c)
    } else {
      setErrArch(json.error || 'Erreur lors de l\'archivage')
    }
    setArchiving(false)
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>
  if (erreur)  return (
    <div className="p-8">
      <p className="text-red-500 mb-4">{erreur}</p>
      <Link href="/clients" className="text-green-600 hover:underline text-sm">← Retour aux clients</Link>
    </div>
  )
  if (!client) return null

  const pct = client.plafondCredit > 0
    ? Math.round((client.soldeCredit / client.plafondCredit) * 100)
    : 0
  const couleurBarre = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-orange-400' : 'bg-green-500'

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/clients" className="text-gray-400 hover:text-gray-700 text-sm">← Clients</Link>
          <h1 className="text-2xl font-bold text-gray-800">{client.nom}</h1>
          {!client.actif && (
            <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">Archivé</span>
          )}
        </div>
        {isAdmin && client.actif && (
          <div className="flex gap-2">
            <button onClick={() => setShowEdit(!showEdit)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
              Modifier
            </button>
            {client.soldeCredit === 0 && (
              <button onClick={handleArchiver} disabled={archiving}
                className="px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50">
                {archiving ? 'Archivage...' : 'Archiver'}
              </button>
            )}
          </div>
        )}
      </div>

      {errArch && <p className="text-red-500 text-sm mb-4">{errArch}</p>}

      {/* Formulaire modification */}
      {showEdit && (
        <form onSubmit={handleModifier}
          className="bg-white rounded-xl shadow p-6 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input required value={formEdit.nom}
              onChange={(e) => setFormEdit({ ...formEdit, nom: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input value={formEdit.telephone}
              onChange={(e) => setFormEdit({ ...formEdit, telephone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="+224 xxx xxx xxx" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={formEdit.email}
              onChange={(e) => setFormEdit({ ...formEdit, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plafond crédit (GNF)</label>
            <input type="number" value={formEdit.plafondCredit}
              onChange={(e) => setFormEdit({ ...formEdit, plafondCredit: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          {errEdit && <p className="col-span-2 text-red-500 text-sm">{errEdit}</p>}
          <div className="col-span-2 flex gap-3">
            <button type="submit" disabled={savingEdit}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm">
              {savingEdit ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            <button type="button" onClick={() => setShowEdit(false)}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 text-sm">
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Carte infos + crédit */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Infos */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Informations</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Téléphone</span>
              <span className="font-medium">{client.telephone || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{client.email || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Ventes</span>
              <span className="font-medium">{client.ventes.length}</span>
            </div>
          </div>
        </div>

        {/* Crédit */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Crédit</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Solde dû</span>
              <span className={`font-bold text-lg ${client.soldeCredit > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatMontant(client.soldeCredit)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Plafond</span>
              <span className="font-medium">{formatMontant(client.plafondCredit)}</span>
            </div>
            {client.plafondCredit > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Utilisation</span>
                  <span className={pct > 80 ? 'text-red-500 font-medium' : ''}>{pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${couleurBarre}`}
                    style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section remboursement */}
      {isAdmin && client.actif && client.soldeCredit > 0 && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">Enregistrer un remboursement</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant (GNF) — max {formatMontant(client.soldeCredit)}
              </label>
              <input
                type="number"
                value={montantRemb}
                onChange={(e) => setMontantRemb(e.target.value)}
                max={client.soldeCredit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optionnel)</label>
              <input
                value={noteRemb}
                onChange={(e) => setNoteRemb(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ex: versement espèces" />
            </div>
          </div>
          {errRemb && <p className="text-red-500 text-sm mt-2">{errRemb}</p>}
          {okRemb  && <p className="text-green-600 text-sm mt-2">Remboursement enregistré ✓</p>}
          <button onClick={handleRembourser} disabled={savingRemb}
            className="mt-3 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
            {savingRemb ? 'Enregistrement...' : 'Enregistrer le remboursement'}
          </button>
        </div>
      )}

      {/* Historique ventes */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">20 dernières ventes</h2>
          <span className="text-xs text-gray-400">{client.ventes.length} vente{client.ventes.length > 1 ? 's' : ''}</span>
        </div>
        {client.ventes.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Aucune vente enregistrée</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Date</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Articles</th>
                <th className="text-right px-6 py-3 text-gray-500 font-medium">Montant</th>
                <th className="text-center px-6 py-3 text-gray-500 font-medium">Statut</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {client.ventes.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(v.createdAt)}</td>
                  <td className="px-6 py-3 text-gray-600 text-xs">
                    {v.lignes.slice(0, 2).map((l) => l.medicament.nom).join(', ')}
                    {v.lignes.length > 2 && ` +${v.lignes.length - 2}`}
                  </td>
                  <td className="px-6 py-3 text-right font-medium">{formatMontant(v.montantTotal)}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_STYLE[v.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUT_LABEL[v.statut] ?? v.statut}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <Link href={`/ventes/${v.id}`}
                      className="text-green-600 hover:underline text-xs">
                      Voir
                    </Link>
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