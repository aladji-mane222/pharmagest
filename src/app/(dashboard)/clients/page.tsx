'use client'

import { useEffect, useState } from 'react'
import { formatMontant } from '@/lib/utils'

interface Client {
  id: string
  nom: string
  telephone: string | null
  email: string | null
  soldeCredit: number
  plafondCredit: number
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nom: '', telephone: '', email: '', plafondCredit: '50000' })

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/clients?search=${search}`)
        .then((res) => res.json())
        .then((json) => {
          setClients(json.data || [])
          setLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (res.ok) {
      setClients([...clients, json.data])
      setForm({ nom: '', telephone: '', email: '', plafondCredit: '50000' })
      setShowForm(false)
    }
    setSaving(false)
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Clients</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
          + Nouveau client
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Nom du client" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
            <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="+224 xxx xxx xxx" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="email@client.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plafond credit (GNF)</label>
            <input type="number" value={form.plafondCredit} onChange={(e) => setForm({ ...form, plafondCredit: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="col-span-2 flex gap-3">
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

      <div className="mb-4">
        <input type="text" placeholder="Rechercher un client..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucun client</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Nom</th>
                <th className="text-left px-6 py-3 text-gray-600">Telephone</th>
                <th className="text-right px-6 py-3 text-gray-600">Solde credit</th>
                <th className="text-right px-6 py-3 text-gray-600">Plafond</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{c.nom}</td>
                  <td className="px-6 py-4 text-gray-600">{c.telephone || '-'}</td>
                  <td className={`px-6 py-4 text-right font-medium ${c.soldeCredit > 0 ? 'text-red-500' : 'text-gray-600'}`}>
                    {formatMontant(c.soldeCredit)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">{formatMontant(c.plafondCredit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
