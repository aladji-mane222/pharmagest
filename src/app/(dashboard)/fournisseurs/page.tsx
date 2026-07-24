'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import ImportModal, { ImportField } from '@/components/ui/ImportModal'
import { formaterNumeroFournisseur } from '@/lib/numerotation'

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

const STYLES_FIABILITE: Record<string, { classe: string; label: string }> = {
  fiable:               { classe: 'bg-green-100 text-green-700',  label: 'Fiable' },
  generalement_fiable:  { classe: 'bg-orange-100 text-orange-700', label: 'Généralement fiable' },
  souvent_en_retard:    { classe: 'bg-red-100 text-red-700',       label: 'Souvent en retard' },
  insuffisant:          { classe: 'bg-gray-100 text-gray-500',     label: 'Historique insuffisant' },
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Fournisseurs</h1>
        <div className="flex gap-3">
          {isAdmin && (
            <button
              onClick={() => setImportOuvert(true)}
              className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              Importer
            </button>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            + Nouveau fournisseur
          </button>
        </div>
      </div>

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
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              required
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Nom du fournisseur"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Nom du contact"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="+224 xxx xxx xxx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="email@fournisseur.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Délai livraison (jours)</label>
            <input
              type="number"
              value={form.delaiLivraison}
              onChange={(e) => setForm({ ...form, delaiLivraison: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="3"
            />
          </div>
          <div className="flex items-end gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : fournisseurs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucun fournisseur</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
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
                <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">
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
                        <span
                          title={titre}
                          className={`px-2 py-1 rounded-full text-xs font-medium ${style.classe}`}
                        >
                          {style.label}
                          {fiab?.pourcentageATemps !== null && fiab?.pourcentageATemps !== undefined && (
                            <> ({fiab.pourcentageATemps}%)</>
                          )}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/fournisseurs/${f.id}`}
                        className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Détail
                      </Link>
                      {isAdmin && (
                        <button
                          onClick={() => archiver(f.id)}
                          disabled={archivingId === f.id}
                          className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          {archivingId === f.id ? '...' : 'Archiver'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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