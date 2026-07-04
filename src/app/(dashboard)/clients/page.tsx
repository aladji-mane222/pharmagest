'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatMontant } from '@/lib/utils'
import { PageHeader, Card, Badge, EmptyState, Input, Button } from '@/components/ui'

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
      <PageHeader
        title="Clients"
        description="Gérez vos clients et leurs crédits"
        actions={
          <Button onClick={() => setShowForm(!showForm)}>
            + Nouveau client
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <Input
              label="Nom" required
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Nom du client"
            />
            <Input
              label="Téléphone"
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              placeholder="+224 xxx xxx xxx"
            />
            <Input
              label="Email" type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@client.com"
            />
            <Input
              label="Plafond crédit (GNF)" type="number"
              value={form.plafondCredit}
              onChange={(e) => setForm({ ...form, plafondCredit: e.target.value })}
            />
            <div className="col-span-2 flex gap-3">
              <Button type="submit" loading={saving}>Enregistrer</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-4">
        <Input
          type="text" placeholder="Rechercher un client..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon="👥"
            title="Aucun client pour l'instant"
            description="Les clients apparaîtront ici une fois ajoutés."
            action={<Button onClick={() => setShowForm(true)}>Ajouter le premier client</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-app-bg border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Nom</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Téléphone</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Crédit</th>
                <th className="text-right px-6 py-3 text-gray-600 font-semibold">Solde / Plafond</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const ratio = c.plafondCredit > 0
                  ? Math.min(100, Math.round((c.soldeCredit / c.plafondCredit) * 100))
                  : 0
                return (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-app-bg transition-colors">
                    <td className="px-6 py-4 font-medium text-navy">{c.nom}</td>
                    <td className="px-6 py-4 text-gray-600">{c.telephone || '-'}</td>
                    <td className="px-6 py-4">
                      {c.soldeCredit > 0 ? (
                        <Badge variant="danger">Crédit</Badge>
                      ) : (
                        <Badge variant="neutral">Aucun</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-medium ${c.soldeCredit > 0 ? 'text-danger' : 'text-gray-600'}`}>
                          {formatMontant(c.soldeCredit)} / {formatMontant(c.plafondCredit)}
                        </span>
                        <div className="w-32 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${ratio >= 90 ? 'bg-danger' : ratio >= 60 ? 'bg-warning' : 'bg-mint'}`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/clients/${c.id}`} className="text-xs text-mint-dark hover:underline font-medium">
                        Voir fiche →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
