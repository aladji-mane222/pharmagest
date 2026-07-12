'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatDateTime } from '@/lib/utils'
import { Modal, useToast } from '@/components/ui'

interface Commande {
  id: string
  statut: string
  montantTotal: number
  createdAt: string
}

interface Fournisseur {
  id: string
  nom: string
  contact: string | null
  telephone: string | null
  email: string | null
  delaiLivraison: number | null
  actif: boolean
  commandes: Commande[]
}

const STATUT_STYLE: Record<string, string> = {
  BROUILLON: 'bg-gray-100 text-gray-600',
  ENVOYEE:   'bg-blue-100 text-blue-700',
  RECUE:     'bg-green-100 text-green-700',
  ANNULEE:   'bg-red-100 text-red-700',
}

const STATUT_LABEL: Record<string, string> = {
  BROUILLON: 'Brouillon',
  ENVOYEE:   'Envoyée',
  RECUE:     'Reçue',
  ANNULEE:   'Annulée',
}

export default function FournisseurDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'
  const { showToast } = useToast()

  const [fournisseur, setFournisseur] = useState<Fournisseur | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const [modeEdition, setModeEdition] = useState(false)
  const [form, setForm] = useState({ nom: '', contact: '', telephone: '', email: '', delaiLivraison: '' })
  const [saving, setSaving] = useState(false)
  const [confirmArchiver, setConfirmArchiver] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const charger = () => {
    setLoading(true)
    fetch(`/api/fournisseurs/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Introuvable')
        return res.json()
      })
      .then((json) => {
        const f = json.data as Fournisseur
        setFournisseur(f)
        setForm({
          nom: f.nom,
          contact: f.contact || '',
          telephone: f.telephone || '',
          email: f.email || '',
          delaiLivraison: f.delaiLivraison?.toString() || '',
        })
        setLoading(false)
      })
      .catch(() => {
        setErreur('Fournisseur introuvable')
        setLoading(false)
      })
  }

  useEffect(() => {
    if (id) charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const enregistrer = async () => {
    if (!form.nom.trim()) {
      showToast('Le nom est requis', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/fournisseurs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error || 'Erreur lors de la modification', 'error')
        return
      }
      showToast('Fournisseur modifié', 'success')
      setModeEdition(false)
      charger()
    } catch {
      showToast('Erreur réseau', 'error')
    } finally {
      setSaving(false)
    }
  }

  const archiver = async () => {
    setArchiving(true)
    try {
      const res = await fetch(`/api/fournisseurs/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        showToast(json.error || 'Erreur lors de l\'archivage', 'error')
        return
      }
      showToast('Fournisseur archivé', 'success')
      router.push('/fournisseurs')
    } catch {
      showToast('Erreur réseau', 'error')
    } finally {
      setArchiving(false)
      setConfirmArchiver(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>
  if (erreur || !fournisseur) {
    return (
      <div className="p-8">
        <p className="text-danger mb-4">{erreur || 'Fournisseur introuvable'}</p>
        <Link href="/fournisseurs" className="text-mint-dark hover:underline">← Retour aux fournisseurs</Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/fournisseurs" className="text-sm text-gray-500 hover:underline mb-4 inline-block">
        ← Retour aux fournisseurs
      </Link>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            {fournisseur.nom}
            {!fournisseur.actif && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-normal">Archivé</span>
            )}
          </h1>
        </div>
        {isAdmin && fournisseur.actif && (
          <div className="flex gap-2">
            {!modeEdition && (
              <button
                onClick={() => setModeEdition(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Modifier
              </button>
            )}
            <button
              onClick={() => setConfirmArchiver(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-danger hover:bg-red-100"
            >
              Archiver
            </button>
          </div>
        )}
      </div>

      <Modal
        open={confirmArchiver}
        onClose={() => setConfirmArchiver(false)}
        onConfirm={archiver}
        title="Archiver ce fournisseur ?"
        description="Il ne sera plus visible dans les listes actives ni proposé lors de nouvelles commandes. Cette action est réversible en base si besoin (aucune suppression physique)."
        variant="danger"
        confirmLabel="Archiver"
        loading={archiving}
      />

      <div className="bg-white rounded-card shadow p-6 mb-6">
        {modeEdition ? (
          <div className="space-y-4">
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact</label>
              <input
                type="text"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                <input
                  type="text"
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="text"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Délai de livraison habituel (jours)</label>
              <input
                type="number"
                value={form.delaiLivraison}
                onChange={(e) => setForm({ ...form, delaiLivraison: e.target.value })}
                className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={enregistrer}
                disabled={saving}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={() => { setModeEdition(false); charger() }}
                className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Contact</p>
              <p className="text-gray-800">{fournisseur.contact || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Téléphone</p>
              <p className="text-gray-800">{fournisseur.telephone || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Email</p>
              <p className="text-gray-800">{fournisseur.email || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Délai de livraison habituel</p>
              <p className="text-gray-800">{fournisseur.delaiLivraison ? `${fournisseur.delaiLivraison} jour(s)` : '—'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-card shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Commandes récentes</h2>
        {fournisseur.commandes.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune commande pour ce fournisseur pour l&apos;instant.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                <th className="text-left py-2 text-gray-500 font-medium">Statut</th>
                <th className="text-right py-2 text-gray-500 font-medium">Montant</th>
              </tr>
            </thead>
            <tbody>
              {fournisseur.commandes.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 text-gray-600">{formatDateTime(c.createdAt)}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUT_STYLE[c.statut] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUT_LABEL[c.statut] || c.statut}
                    </span>
                  </td>
                  <td className="py-2 text-right text-gray-800">{c.montantTotal.toLocaleString('fr-FR')} GNF</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Link
          href={`/fournisseurs/commandes?fournisseurId=${fournisseur.id}`}
          className="inline-block mt-4 text-sm text-mint-dark hover:underline"
        >
          Voir toutes les commandes →
        </Link>
      </div>
    </div>
  )
}