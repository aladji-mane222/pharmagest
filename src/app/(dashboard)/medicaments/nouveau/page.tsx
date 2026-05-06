'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NouveauMedicamentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nom: '',
    description: '',
    categorie: '',
    unite: 'comprime',
    prixVente: '',
    prixAchat: '',
    stockMinimum: '10',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/medicaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.error || 'Erreur lors de la creation')
      setLoading(false)
    } else {
      router.push('/medicaments')
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Nouveau medicament</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
          <input
            type="text"
            required
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Ex: Paracetamol 500mg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
          <input
            type="text"
            value={form.categorie}
            onChange={(e) => setForm({ ...form, categorie: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Ex: Analgesique"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (GNF) *</label>
            <input
              type="number"
              required
              value={form.prixVente}
              onChange={(e) => setForm({ ...form, prixVente: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix d achat (GNF)</label>
            <input
              type="number"
              value={form.prixAchat}
              onChange={(e) => setForm({ ...form, prixAchat: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unite</label>
            <select
              value={form.unite}
              onChange={(e) => setForm({ ...form, unite: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="comprime">Comprime</option>
              <option value="flacon">Flacon</option>
              <option value="ampoule">Ampoule</option>
              <option value="boite">Boite</option>
              <option value="sachet">Sachet</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock minimum</label>
            <input
              type="number"
              value={form.stockMinimum}
              onChange={(e) => setForm({ ...form, stockMinimum: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            rows={3}
            placeholder="Description optionnelle"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}
