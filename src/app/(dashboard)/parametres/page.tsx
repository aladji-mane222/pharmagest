'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/ui'

interface Pharmacie {
  id: string
  nom: string
  adresse: string | null
  telephone: string | null
  email: string | null
  formatRecu: 'A4' | 'THERMIQUE_58' | 'THERMIQUE_80'
  dureeMaxSessionCaisseH: number | null
}

export default function ParametresPage() {
  const { data: session } = useSession()
  const { showToast } = useToast()
  const estAdmin = session?.user?.role !== 'CAISSIER'
  const [, setPharmacie] = useState<Pharmacie | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ nom: '', adresse: '', telephone: '', email: '', formatRecu: 'A4', dureeMaxSessionCaisseH: '' })

  useEffect(() => {
    fetch('/api/parametres')
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setPharmacie(json.data)
          setForm({
            nom: json.data.nom || '',
            adresse: json.data.adresse || '',
            telephone: json.data.telephone || '',
            email: json.data.email || '',
            formatRecu: json.data.formatRecu || 'A4',
            dureeMaxSessionCaisseH: json.data.dureeMaxSessionCaisseH != null ? String(json.data.dureeMaxSessionCaisseH) : '',
          })
        }
        setLoading(false)
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent, champs: Record<string, unknown>) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/parametres', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(champs),
    })
    if (res.ok) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } else {
      const json = await res.json().catch(() => ({}))
      showToast(json.error || 'Erreur lors de la sauvegarde des parametres', 'error')
    }
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Parametres</h1>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">Informations de la pharmacie</h2>
        {!estAdmin && (
          <div className="bg-orange-50 text-orange-700 text-sm rounded-lg px-4 py-3 mb-4">
            Reserve aux administrateurs — tu peux consulter mais pas modifier ces reglages.
          </div>
        )}
        <fieldset disabled={!estAdmin} className="contents">
        <form onSubmit={(e) => handleSubmit(e, { nom: form.nom, adresse: form.adresse, telephone: form.telephone, email: form.email })} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la pharmacie</label>
            <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
            <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          {success && <p className="text-green-600 text-sm">Parametres sauvegardes !</p>}
          <button type="submit" disabled={saving}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </form>
        </fieldset>
      </div>

      {/* Format de recu — separe du bloc admin ci-dessus : modifiable par
          TOUS les roles (besoin operationnel du quotidien), contrairement
          aux infos administratives de la pharmacie. Decision confirmee
          par Nabe le 23/07/2026. Envoi cible : seul formatRecu part dans
          le PATCH, jamais les champs admin-only. */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">Format de reçu</h2>
        <form onSubmit={(e) => handleSubmit(e, { formatRecu: form.formatRecu })} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Format d&apos;impression du recu</label>
            <select
              value={form.formatRecu}
              onChange={(e) => setForm({ ...form, formatRecu: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="A4">Feuille A4 / PDF standard</option>
              <option value="THERMIQUE_58">Imprimante thermique 58mm</option>
              <option value="THERMIQUE_80">Imprimante thermique 80mm</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Determine la mise en page du recu imprime depuis la caisse.
            </p>
          </div>
          {success && <p className="text-green-600 text-sm">Parametres sauvegardes !</p>}
          <button type="submit" disabled={saving}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">Securite caisse</h2>
        {!estAdmin && (
          <div className="bg-orange-50 text-orange-700 text-sm rounded-lg px-4 py-3 mb-4">
            Reserve aux administrateurs — tu peux consulter mais pas modifier ce reglage.
          </div>
        )}
        <fieldset disabled={!estAdmin} className="contents">
          <form onSubmit={(e) => handleSubmit(e, { dureeMaxSessionCaisseH: form.dureeMaxSessionCaisseH })} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duree max d&apos;une session caisse (heures)
              </label>
              <input
                type="number"
                min={1}
                value={form.dureeMaxSessionCaisseH}
                onChange={(e) => setForm({ ...form, dureeMaxSessionCaisseH: e.target.value })}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                placeholder="Illimite si vide"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Au-dela de cette duree, une alerte s&apos;affiche sur la page Caisse pour rappeler
                de fermer la session — utile pour reperer une session oubliee ouverte ou un
                caissier trop longtemps sur la meme session. Laisser vide pour aucune limite.
              </p>
            </div>
            {success && <p className="text-green-600 text-sm">Parametres sauvegardes !</p>}
            <button type="submit" disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </form>
        </fieldset>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold text-gray-700 mb-4">Mon compte</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Nom</span>
            <span className="font-medium">{session?.user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="font-medium">{session?.user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Role</span>
            <span className="font-medium">{session?.user?.role}</span>
          </div>
        </div>
      </div>
    </div>
  )
}