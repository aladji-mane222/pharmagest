'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatDateTime } from '@/lib/utils'
import { formaterNumeroFournisseur } from '@/lib/numerotation'
import { Modal, useToast, Card, Button, Badge, BadgeStatutCommande, Input, EmptyState, Skeleton, SkeletonCard } from '@/components/ui'

interface Commande {
  id: string
  statut: string
  montantTotal: number
  createdAt: string
}

interface Fournisseur {
  id: string
  numeroFournisseur: number | null
  nom: string
  contact: string | null
  telephone: string | null
  email: string | null
  delaiLivraison: number | null
  actif: boolean
  commandes: Commande[]
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

  // Lien retour uniformisé (Phase 5) — meme style que clients/[id] et
  // medicaments/[id], affiche systematiquement.
  const lienRetour = (
    <Link href="/fournisseurs" className="text-sm text-gray-500 hover:text-mint-dark hover:underline mb-4 inline-block">
      ← Retour aux fournisseurs
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

  if (erreur || !fournisseur) {
    return (
      <div className="p-8">
        {lienRetour}
        <p className="text-danger">{erreur || 'Fournisseur introuvable'}</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      {lienRetour}

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-navy flex items-center gap-2">
            {fournisseur.nom}
            {formaterNumeroFournisseur(fournisseur.numeroFournisseur) && (
              <span className="text-sm text-gray-400 font-normal">{formaterNumeroFournisseur(fournisseur.numeroFournisseur)}</span>
            )}
            {!fournisseur.actif && <Badge variant="neutral">Archivé</Badge>}
          </h1>
        </div>
        {isAdmin && fournisseur.actif && (
          <div className="flex gap-2">
            {!modeEdition && (
              <Button variant="secondary" size="sm" onClick={() => setModeEdition(true)}>
                Modifier
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => setConfirmArchiver(true)}>
              Archiver
            </Button>
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

      <Card className="mb-6">
        {modeEdition ? (
          <div className="space-y-4">
            <Input
              label="Nom"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
            />
            <Input
              label="Contact"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Téléphone"
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              />
              <Input
                label="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <Input
              label="Délai de livraison habituel (jours)"
              type="number"
              value={form.delaiLivraison}
              onChange={(e) => setForm({ ...form, delaiLivraison: e.target.value })}
              className="w-40"
            />
            <div className="flex gap-3 pt-2">
              <Button variant="primary" onClick={enregistrer} loading={saving}>
                Enregistrer
              </Button>
              <Button variant="secondary" onClick={() => { setModeEdition(false); charger() }}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Contact</p>
              <p className="text-navy">{fournisseur.contact || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Téléphone</p>
              <p className="text-navy">{fournisseur.telephone || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Email</p>
              <p className="text-navy">{fournisseur.email || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Délai de livraison habituel</p>
              <p className="text-navy">{fournisseur.delaiLivraison ? `${fournisseur.delaiLivraison} jour(s)` : '—'}</p>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-navy mb-4">Commandes récentes</h2>
        {fournisseur.commandes.length === 0 ? (
          <EmptyState icon="📦" title="Aucune commande pour l'instant" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                <th className="text-left py-2 text-gray-500 font-medium">Statut</th>
                <th className="text-right py-2 text-gray-500 font-medium">Montant</th>
              </tr>
            </thead>
            <tbody>
              {fournisseur.commandes.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 text-gray-600">{formatDateTime(c.createdAt)}</td>
                  <td className="py-2">
                    <BadgeStatutCommande statut={c.statut} />
                  </td>
                  <td className="py-2 text-right text-navy">{c.montantTotal.toLocaleString('fr-FR')} GNF</td>
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
      </Card>
    </div>
  )
}