'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatMontant } from '@/lib/utils'
import ImportModal, { ImportField } from '@/components/ui/ImportModal'
import { formaterNumeroClient } from '@/lib/numerotation'
import { useToast, Button, Card, PageHeader, EmptyState, Badge, Input, SkeletonTable } from '@/components/ui'

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
      <PageHeader
        title="Clients"
        actions={
          <>
            {isAdmin && (
              <Button variant="secondary" onClick={() => setImportOuvert(true)}>
                Importer
              </Button>
            )}
            <Button variant="primary" onClick={() => setShowForm(!showForm)}>
              + Nouveau client
            </Button>
          </>
        }
      />

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
        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <Input
              label="Nom"
              required
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
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@client.com"
            />
            <Input
              label="Plafond crédit (GNF)"
              type="number"
              value={form.plafondCredit}
              onChange={(e) => setForm({ ...form, plafondCredit: e.target.value })}
            />
            <div className="col-span-2 flex gap-3">
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

      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher par nom ou numéro client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-card focus:outline-none focus:ring-2 focus:ring-mint/50 focus:border-mint"
        />
      </div>

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={6} cols={6} />
          </div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon="👥"
            title={search.trim() ? 'Aucun client ne correspond' : 'Aucun client pour l’instant'}
            description={search.trim() ? 'Essayez une autre recherche.' : 'Ajoutez votre premier client pour suivre ses achats et son crédit.'}
            action={!search.trim() && (
              <Button variant="primary" onClick={() => setShowForm(true)}>+ Ajouter le premier client</Button>
            )}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-app-bg border-b border-gray-100">
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
                  <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-app-bg">
                    <td className="px-6 py-4 font-medium text-navy">
                      {c.nom}
                      {formaterNumeroClient(c.numeroClient) && (
                        <span className="text-xs text-gray-400 font-normal ml-2">{formaterNumeroClient(c.numeroClient)}</span>
                      )}
                      {c.soldeCredit > 0 && (
                        <Badge variant="danger" className="ml-2">Crédit</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{c.telephone || '-'}</td>
                    <td className={`px-6 py-4 text-right font-medium ${c.soldeCredit > 0 ? 'text-danger' : 'text-gray-600'}`}>
                      {formatMontant(c.soldeCredit)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {formatMontant(c.plafondCredit)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-24 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${pct > 80 ? 'bg-danger' : pct > 50 ? 'bg-warning' : 'bg-success'}`}
                          style={{ width: pct + '%' }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/clients/${c.id}`}
                        className="text-mint-dark hover:underline text-xs font-medium whitespace-nowrap"
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
      </Card>
    </div>
  )
}
