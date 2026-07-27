
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import ImportModal, { ImportField } from '@/components/ui/ImportModal'
import { formaterNumeroFournisseur } from '@/lib/numerotation'
import { Modal, useToast, Button, Card, PageHeader, EmptyState, Badge, Input, SkeletonTable } from '@/components/ui'

interface Fournisseur {
  id: string
  numeroFournisseur: number | null
  nom: string
  contact: string | null
  telephone: string | null
  email: string | null
  delaiLivraison: number | null
  fiabilite?: {
    totalCommandesRecues: number
    commandesATemps: number
    pourcentageATemps: number | null
    niveau: 'fiable' | 'generalement_fiable' | 'souvent_en_retard' | 'insuffisant'
  }
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral'

const STYLES_FIABILITE: Record<string, { variant: BadgeVariant; label: string }> = {
  fiable:               { variant: 'success', label: 'Fiable' },
  generalement_fiable:  { variant: 'warning', label: 'Généralement fiable' },
  souvent_en_retard:    { variant: 'danger',  label: 'Souvent en retard' },
  insuffisant:          { variant: 'neutral', label: 'Historique insuffisant' },
}

const CHAMPS_IMPORT_FOURNISSEURS: ImportField[] = [
  { key: 'nom', label: 'Nom', required: true, guessKeywords: ['nom', 'fournisseur', 'designation', 'raison sociale'] },
  { key: 'contact', label: 'Contact', guessKeywords: ['contact', 'responsable', 'interlocuteur'] },
  { key: 'telephone', label: 'Telephone', guessKeywords: ['telephone', 'tel', 'phone'] },
  { key: 'email', label: 'Email', guessKeywords: ['email', 'mail'] },
  { key: 'delaiLivraison', label: 'Delai de livraison (jours)', guessKeywords: ['delai', 'livraison'] },
]

export default function FournisseursPage() {
  const { data: sessionData } = useSession()
  const isAdmin = sessionData?.user?.role === 'ADMIN' || sessionData?.user?.role === 'SUPER_ADMIN'

  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nom: '', contact: '', telephone: '', email: '', delaiLivraison: '' })
  const [saving, setSaving] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [confirmArchiverId, setConfirmArchiverId] = useState<string | null>(null)
  const [importOuvert, setImportOuvert] = useState(false)
  const [avertissementNom, setAvertissementNom] = useState<string | null>(null)
  const { showToast } = useToast()

  const chargerFournisseurs = () => {
    fetch('/api/fournisseurs')
      .then((res) => res.json())
      .then((json) => {
        setFournisseurs(json.data || [])
        setLoading(false)
      })
  }

  useEffect(() => {
    chargerFournisseurs()
  }, [])

  const soumettreFournisseur = async (forcerCreation: boolean) => {
    setSaving(true)
    const res = await fetch('/api/fournisseurs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, forcerCreation }),
    })
    const json = await res.json()
    if (res.ok) {
      setFournisseurs([...fournisseurs, json.data])
      setForm({ nom: '', contact: '', telephone: '', email: '', delaiLivraison: '' })
      setShowForm(false)
      setAvertissementNom(null)
    } else if (json.details?.avertissement) {
      // Pas un vrai blocage — juste un nom proche d'un fournisseur
      // existant (ex: avec/sans "SARL"). On demande confirmation plutot
      // que de bloquer, meme principe que l'avertissement nom-seul deja
      // utilise pour les clients.
      setAvertissementNom(json.details.nomSimilaire)
    } else {
      showToast(json.error || 'Erreur lors de la creation du fournisseur', 'error')
    }
    setSaving(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    soumettreFournisseur(false)
  }

  const archiver = (id: string) => {
    setConfirmArchiverId(id)
  }

  const doArchiver = async () => {
    if (!confirmArchiverId) return
    setArchivingId(confirmArchiverId)
    const res = await fetch(`/api/fournisseurs/${confirmArchiverId}`, { method: 'DELETE' })
    if (res.ok) {
      setFournisseurs(fournisseurs.filter((f) => f.id !== confirmArchiverId))
    } else {
      const json = await res.json()
      showToast(json.error || 'Erreur lors de l\'archivage', 'error')
    }
    setArchivingId(null)
    setConfirmArchiverId(null)
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Fournisseurs"
        actions={
          <>
            {isAdmin && (
              <Button variant="secondary" onClick={() => setImportOuvert(true)}>
                Importer
              </Button>
            )}
            <Button variant="primary" onClick={() => setShowForm(!showForm)}>
              + Nouveau fournisseur
            </Button>
          </>
        }
      />

      <ImportModal
        open={importOuvert}
        onClose={() => setImportOuvert(false)}
        title="Importer des fournisseurs"
        fields={CHAMPS_IMPORT_FOURNISSEURS}
        apiEndpoint="/api/fournisseurs/import"
        templateHref="/modeles/fournisseurs-modele.xlsx"
        onImported={() => chargerFournisseurs()}
      />

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <Input
              label="Nom"
              required
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Nom du fournisseur"
            />
            <Input
              label="Contact"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="Nom du contact"
            />
            <Input
              label="Téléphone"
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              placeholder="+224 xxx xxx xxx"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@fournisseur.com"
            />
            <Input
              label="Délai livraison (jours)"
              type="number"
              value={form.delaiLivraison}
              onChange={(e) => setForm({ ...form, delaiLivraison: e.target.value })}
              placeholder="3"
            />
            <div className="flex items-end gap-3">
              <Button type="submit" variant="primary" loading={saving}>
                Enregistrer
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={6} cols={6} />
          </div>
        ) : fournisseurs.length === 0 ? (
          <EmptyState
            icon="🚚"
            title="Aucun fournisseur pour l'instant"
            description="Ajoutez votre premier fournisseur pour passer des commandes."
            action={<Button variant="primary" onClick={() => setShowForm(true)}>+ Ajouter le premier fournisseur</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-app-bg border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Nom</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Contact</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Téléphone</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Délai</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Fiabilité</th>
                <th className="text-right px-6 py-3 text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fournisseurs.map((f) => (
                <tr key={f.id} className="border-b border-gray-100 last:border-0 hover:bg-app-bg">
                  <td className="px-6 py-4 font-medium text-navy">
                    <Link href={`/fournisseurs/${f.id}`} className="hover:underline hover:text-mint-dark">
                      {f.nom}
                    </Link>
                    {formaterNumeroFournisseur(f.numeroFournisseur) && (
                      <span className="text-xs text-gray-400 ml-2">{formaterNumeroFournisseur(f.numeroFournisseur)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{f.contact || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">{f.telephone || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {f.delaiLivraison ? `${f.delaiLivraison} jours` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const fiab = f.fiabilite
                      const style = STYLES_FIABILITE[fiab?.niveau || 'insuffisant']
                      const titre =
                        fiab && fiab.niveau !== 'insuffisant'
                          ? `${fiab.commandesATemps} livraison(s) à temps sur ${fiab.totalCommandesRecues} reçue(s) (90 derniers jours)`
                          : `Moins de 3 commandes reçues avec date prévue sur les 90 derniers jours`
                      return (
                        <span title={titre}>
                          <Badge variant={style.variant}>
                            {style.label}
                            {fiab?.pourcentageATemps !== null && fiab?.pourcentageATemps !== undefined && (
                              <> ({fiab.pourcentageATemps}%)</>
                            )}
                          </Badge>
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/fournisseurs/${f.id}`}>
                        <Button variant="secondary" size="sm">Détail</Button>
                      </Link>
                      {isAdmin && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => archiver(f.id)}
                          loading={archivingId === f.id}
                        >
                          Archiver
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={!!confirmArchiverId}
        onClose={() => setConfirmArchiverId(null)}
        onConfirm={doArchiver}
        title="Archiver ce fournisseur ?"
        description="Il n'apparaîtra plus dans les listes actives. Ses commandes existantes restent consultables."
        variant="danger"
        confirmLabel="Archiver"
        loading={!!archivingId}
      />

      <Modal
        open={!!avertissementNom}
        onClose={() => setAvertissementNom(null)}
        onConfirm={() => soumettreFournisseur(true)}
        title="Nom de fournisseur proche d'un existant"
        description={`Un fournisseur au nom proche existe déjà : "${avertissementNom}". Vérifie que ce n'est pas le même avant de continuer.`}
        variant="default"
        confirmLabel="Créer quand même"
        loading={saving}
      />
    </div>
  )
}