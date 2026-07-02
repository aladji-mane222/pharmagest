'use client'

import { useEffect, useState } from 'react'

interface Fournisseur {
  id: string
  nom: string
  contact: string | null
  telephone: string | null
  email: string | null
  delaiLivraison: number | null
  actif: boolean
}

export default function FournisseursPage() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [archivingId,  setArchivingId]  = useState<string | null>(null)
  const [erreur,       setErreur]       = useState<string | null>(null)
  const [form, setForm] = useState({ nom: '', contact: '', telephone: '', email: '', delaiLivraison: '' })

  useEffect(() => {
    fetch('/api/fournisseurs')
      .then((res) => res.json())
      .then((json) => {
        setFournisseurs(json.data || [])
        setLoading(false)
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur(null)
    setSaving(true)
    const res  = await fetch('/api/fournisseurs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    const json = await res.json()
    if (res.ok) {
      setFournisseurs([json.data, ...fournisseurs])
      setForm({ nom: '', contact: '', telephone: '', email: '', delaiLivraison: '' })
      setShowForm(false)
    } else {
      setErreur(json.error || 'Erreur lors de la création')
    }
    setSaving(false)
  }

  const handleArchiver = async (id: string, nom: string) => {
    if (!confirm(`Archiver ${nom} ? Il ne sera plus visible dans la liste.`)) return
    setErreur(null)
    setArchivingId(id)
    const res  = await fetch(`/api/fournisseurs/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (res.ok) {
      setFournisseurs(fournisseurs.filter((f) => f.id !== id))
    } else {
      setErreur(json.error || 'Erreur lors de l\'archivage')
    }
    setArchivingId(null)
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Fournisseurs</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
          + Nouveau fournisseur
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow p-6 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input required value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Nom du fournisseur" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <input value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Nom du contact" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="+224 xxx xxx xxx" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="email@fournisseur.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Délai livraison (jours)</label>
            <input type="number" value={form.delaiLivraison}
              onChange={(e) => setForm({ ...form, delaiLivraison: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="3" />
          </div>
          <div className="flex items-end gap-3">
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

      {erreur && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {erreur}
        </div>
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
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {fournisseurs.map((f) => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{f.nom}</td>
                  <td className="px-6 py-4 text-gray-600">{f.contact || '—'}</td>
                  <td className="px-6 py-4 text-gray-600">{f.telephone || '—'}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {f.delaiLivraison ? `${f.delaiLivraison} jours` : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleArchiver(f.id, f.nom)}
                      disabled={archivingId === f.id}
                      className="text-gray-400 hover:text-red-600 text-xs font-medium disabled:opacity-50 transition-colors">
                      {archivingId === f.id ? 'Archivage...' : 'Archiver'}
                    </button>
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