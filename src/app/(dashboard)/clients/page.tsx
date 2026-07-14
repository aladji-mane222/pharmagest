'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatMontant } from '@/lib/utils'
import ImportModal, { ImportField } from '@/components/ui/ImportModal'
import { useToast } from '@/components/ui/Toast'
import { formaterNumeroClient } from '@/lib/numerotation'

interface Client {
  id: string
  numeroClient: number | null
  nom: string
  telephone: string | null
  email: string | null
  soldeCredit: number
  plafondCredit: number
}

const CHAMPS_IMPORT_CLIENTS: ImportField[] = [
  { key: 'nom', label: 'Nom', required: true, guessKeywords: ['nom', 'client', 'designation'] },
  { key: 'telephone', label: 'Telephone', guessKeywords: ['telephone', 'tel', 'phone', 'contact'] },
  { key: 'email', label: 'Email', guessKeywords: ['email', 'mail'] },
  { key: 'plafondCredit', label: 'Plafond de credit', guessKeywords: ['plafond', 'credit', 'limite'] },
]

export default function ClientsPage() {
  const { data: sessionData } = useSession()
  const isAdmin = sessionData?.user?.role === 'ADMIN' || sessionData?.user?.role === 'SUPER_ADMIN'

  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nom: '', telephone: '', email: '', plafondCredit: '50000' })
  const [importOuvert, setImportOuvert] = useState(false)
  const { showToast } = useToast()

  const chargerClients = () => {
    fetch(`/api/clients?search=${search}`)
      .then((res) => res.json())
      .then((json) => {
        setClients(json.data || [])
        setLoading(false)
      })
  }

  useEffect(() => {
    const timer = setTimeout(chargerClients, 300)
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
    } else {
      showToast(json.error || 'Erreur lors de la creation du client', 'error')
    }
    setSaving(false)
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Clients</h1>
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
            + Nouveau client
          </button>
        </div>
      </div>

      <ImportModal
        open={importOuvert}
        onClose={() => setImportOuvert(false)}
        title="Importer des clients"
        fields={CHAMPS_IMPORT_CLIENTS}
        apiEndpoint="/api/clients/import"
        templateHref="/modeles/clients-modele.xlsx"
        onImported={() => chargerClients()}
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
              placeholder="Nom du client"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
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
              placeholder="email@client.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plafond credit (GNF)</label>
            <input
              type="number"
              value={form.plafondCredit}
              onChange={(e) => setForm({ ...form, plafondCredit: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="col-span-2 flex gap-3">
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

      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
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
                <th className="text-left px-6 py-3 text-gray-600">Utilisation</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const pct = c.plafondCredit > 0
                  ? Math.min(100, (c.soldeCredit / c.plafondCredit) * 100)
                  : c.soldeCredit > 0 ? 100 : 0
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {c.nom}
                      {formaterNumeroClient(c.numeroClient) && (
                        <span className="text-xs text-gray-400 font-normal ml-2">{formaterNumeroClient(c.numeroClient)}</span>
                      )}
                      {c.soldeCredit > 0 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-medium ml-2">
                          Crédit
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{c.telephone || '-'}</td>
                    <td className={`px-6 py-4 text-right font-medium ${c.soldeCredit > 0 ? 'text-red-500' : 'text-gray-600'}`}>
                      {formatMontant(c.soldeCredit)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {formatMontant(c.plafondCredit)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-24 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-orange-400' : 'bg-green-500'}`}
                          style={{ width: pct + '%' }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/clients/${c.id}`}
                        className="text-green-600 hover:text-green-800 text-xs font-medium whitespace-nowrap"
                      >
                        Voir fiche →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}