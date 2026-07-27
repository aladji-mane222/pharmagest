'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatMontant, formatDateTime } from '@/lib/utils'
import { Modal, useToast, Card, PageHeader, Button, Input, Select, EmptyState, SkeletonTable } from '@/components/ui'

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

  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
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
    } else {
      setErrorMsg(json.error || 'Une erreur est survenue')
    }
    setSaving(false)
  }

  const [confirmArchiver, setConfirmArchiver] = useState<{ id: string; montant: number } | null>(null)
  const { showToast } = useToast()

  const handleArchiver = async () => {
    if (!confirmArchiver) return
    const { id, montant } = confirmArchiver
    setErrorMsg(null)
    setArchivingId(id)
    const res = await fetch(`/api/depenses/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (res.ok) {
      setDepenses(depenses.filter((d) => d.id !== id))
      setTotalMontant(totalMontant - montant)
      showToast('Dépense archivée', 'success')
    } else {
      setErrorMsg(json.error || 'Erreur lors de l\'archivage')
    }
    setArchivingId(null)
    setConfirmArchiver(null)
  }

  const repartitionParCategorie = Object.entries(
    depenses.reduce<Record<string, number>>((acc, d) => {
      if (d.categorie) acc[d.categorie] = (acc[d.categorie] || 0) + d.montant
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  return (
    <div className="p-8">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <PageHeader
            title="Dépenses"
            description={`Total : ${formatMontant(totalMontant)}`}
          />
          {depenses.length > 0 && (
            <div className="-mt-4 flex flex-wrap gap-x-4 gap-y-0.5">
              {repartitionParCategorie.map(([cat, total]) => (
                <span key={cat} className="text-xs text-gray-400">
                  {cat} : <span className="font-medium text-gray-600">{formatMontant(total)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <select
            value={categorieFiltre}
            onChange={(e) => setCategorieFiltre(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-card focus:outline-none focus:ring-2 focus:ring-mint/50 focus:border-mint bg-white text-gray-700"
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
            className="px-4 py-2 border border-gray-300 rounded-card focus:outline-none focus:ring-2 focus:ring-mint/50 focus:border-mint"
          />
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            + Nouvelle dépense
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
            <Input
              label="Libellé"
              required
              value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })}
              placeholder="Ex: Facture electricite Juin"
            />
            <Input
              label="Montant (GNF)"
              required
              type="number"
              value={form.montant}
              onChange={(e) => setForm({ ...form, montant: e.target.value })}
              placeholder="0"
            />
            <Select
              label="Catégorie"
              value={form.categorie}
              onChange={(e) => setForm({ ...form, categorie: e.target.value })}
            >
              <option value="">Choisir...</option>
              {CATEGORIES_STANDARD.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
            <div className="col-span-3 flex gap-3">
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

      {errorMsg && (
        <div className="bg-danger-bg border border-danger/20 text-danger px-4 py-3 rounded-card mb-4">
          {errorMsg}
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={6} cols={6} />
          </div>
        ) : depenses.length === 0 ? (
          <EmptyState
            icon="💸"
            title="Aucune dépense ce mois"
            description="Enregistrez vos charges (loyer, salaires, factures...) pour suivre le bénéfice net."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-app-bg border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Date</th>
                <th className="text-left px-6 py-3 text-gray-600">Libelle</th>
                <th className="text-left px-6 py-3 text-gray-600">Categorie</th>
                <th className="text-left px-6 py-3 text-gray-600">Saisie par</th>
                <th className="text-right px-6 py-3 text-gray-600">Montant</th>
                <th className="text-right px-6 py-3 text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {depenses.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 last:border-0 hover:bg-app-bg">
                  <td className="px-6 py-4 text-gray-600">{formatDateTime(d.createdAt)}</td>
                  <td className="px-6 py-4 font-medium text-navy">{d.libelle}</td>
                  <td className="px-6 py-4 text-gray-600">{d.categorie || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">{d.user?.nom || '-'}</td>
                  <td className="px-6 py-4 text-right font-medium text-danger">{formatMontant(d.montant)}</td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmArchiver({ id: d.id, montant: d.montant })}
                        loading={archivingId === d.id}
                      >
                        Archiver
                      </Button>
                    ) : (
                      <span title="Réservé aux administrateurs" className="text-gray-300 cursor-help">🔒</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={!!confirmArchiver}
        onClose={() => setConfirmArchiver(null)}
        onConfirm={handleArchiver}
        title="Archiver cette dépense ?"
        description="Elle ne sera plus visible dans la liste des dépenses actives."
        variant="danger"
        confirmLabel="Archiver"
        loading={!!archivingId}
      />
    </div>
  )
}
