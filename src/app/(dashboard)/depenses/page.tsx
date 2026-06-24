'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatMontant, formatDateTime } from '@/lib/utils'

interface Depense {
  id: string
  libelle: string
  montant: number
  categorie: string | null
  createdAt: string
  user?: { nom: string } | null
}

const CATEGORIES_STANDARD = [
  'Salaires',
  'Loyer',
  'Électricité & eau',
  'Impôts & taxes',
  'Fournitures & matériel',
  'Réparations & entretien',
  'Autres charges',
]

export default function DepensesPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  const [depenses, setDepenses] = useState<Depense[]>([])
  const [totalMontant, setTotalMontant] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [mois, setMois] = useState(() => new Date().toISOString().slice(0, 7))
  const [categorieFiltre, setCategorieFiltre] = useState('')
  const [form, setForm] = useState({ libelle: '', montant: '', categorie: '' })

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ mois })
    if (categorieFiltre) params.set('categorie', categorieFiltre)

    fetch(`/api/depenses?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setDepenses(json.data?.depenses || [])
        setTotalMontant(json.data?.totalMontant || 0)
        setLoading(false)
      })
  }, [mois, categorieFiltre])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/depenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (res.ok) {
      setDepenses([json.data, ...depenses])
      setTotalMontant(totalMontant + json.data.montant)
      setForm({ libelle: '', montant: '', categorie: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  const handleArchiver = async (id: string, montant: number) => {
    if (!confirm('Archiver cette depense ? Elle ne sera plus visible dans la liste.')) return

    setArchivingId(id)
    const res = await fetch(`/api/depenses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setDepenses(depenses.filter((d) => d.id !== id))
      setTotalMontant(totalMontant - montant)
    }
    setArchivingId(null)
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Depenses</h1>
          <p className="text-gray-500 text-sm mt-1">
            Total : <span className="font-semibold text-red-600">{formatMontant(totalMontant)}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={categorieFiltre}
            onChange={(e) => setCategorieFiltre(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Toutes categories</option>
            {CATEGORIES_STANDARD.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="month"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button onClick={() => setShowForm(!showForm)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
            + Nouvelle depense
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-6 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Libelle *</label>
            <input required value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Ex: Facture electricite Juin" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant (GNF) *</label>
            <input required type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
            <select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Choisir...</option>
              {CATEGORIES_STANDARD.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="col-span-3 flex gap-3">
            <button type="submit" disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200">
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : depenses.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucune depense ce mois</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Date</th>
                <th className="text-left px-6 py-3 text-gray-600">Libelle</th>
                <th className="text-left px-6 py-3 text-gray-600">Categorie</th>
                <th className="text-left px-6 py-3 text-gray-600">Saisie par</th>
                <th className="text-right px-6 py-3 text-gray-600">Montant</th>
                {isAdmin && <th className="text-right px-6 py-3 text-gray-600">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {depenses.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600">{formatDateTime(d.createdAt)}</td>
                  <td className="px-6 py-4 font-medium text-gray-800">{d.libelle}</td>
                  <td className="px-6 py-4 text-gray-600">{d.categorie || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">{d.user?.nom || '-'}</td>
                  <td className="px-6 py-4 text-right font-medium text-red-600">{formatMontant(d.montant)}</td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleArchiver(d.id, d.montant)}
                        disabled={archivingId === d.id}
                        className="text-gray-500 hover:text-red-600 text-xs font-medium disabled:opacity-50"
                      >
                        {archivingId === d.id ? 'Archivage...' : 'Archiver'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}