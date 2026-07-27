'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatDateTime } from '@/lib/utils'
import { useToast, Card, PageHeader, Button, Input, Select, Badge, EmptyState, SkeletonTable } from '@/components/ui'

interface User {
  id: string
  nom: string
  email: string
  role: string
  actif: boolean
  createdAt: string
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const roleBadge = (role: string): BadgeVariant => {
  if (role === 'SUPER_ADMIN') return 'info'
  if (role === 'ADMIN')       return 'warning'
  return 'neutral'
}

export default function PersonnelPage() {
  const { data: sessionData } = useSession()
  const moiId   = sessionData?.user?.id
  const isAdmin = sessionData?.user?.role === 'ADMIN' || sessionData?.user?.role === 'SUPER_ADMIN'
  const { showToast } = useToast()

  const [showDroits, setShowDroits] = useState(false)

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nom: '', email: '', password: '', role: 'CAISSIER' })
  const [formError, setFormError] = useState('')

  // Édition inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ nom: '', role: '' })
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((json) => {
        setUsers(json.data || [])
        setLoading(false)
      })
  }, [])

  // ── Création ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (res.ok) {
      setUsers([json.data, ...users])
      setForm({ nom: '', email: '', password: '', role: 'CAISSIER' })
      setShowForm(false)
    } else {
      setFormError(json.error)
    }
    setSaving(false)
  }

  // ── Édition inline ──
  const startEdit = (u: User) => {
    setEditingId(u.id)
    setEditDraft({ nom: u.nom, role: u.role })
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (id: string) => {
    setEditSaving(true)
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: editDraft.nom, role: editDraft.role }),
    })
    const json = await res.json()
    if (res.ok) {
      setUsers(users.map((u) => u.id === id ? { ...u, nom: json.data.nom, role: json.data.role } : u))
      setEditingId(null)
    } else {
      showToast(json.error ?? 'Erreur lors de la modification', 'error')
    }
    setEditSaving(false)
  }

  // ── Activer / Désactiver ──
  const toggleActif = async (u: User) => {
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif: !u.actif }),
    })
    const json = await res.json()
    if (res.ok) {
      setUsers(users.map((usr) => usr.id === u.id ? { ...usr, actif: json.data.actif } : usr))
    } else {
      showToast(json.error ?? 'Erreur lors de la mise à jour', 'error')
    }
  }

  const DROITS = [
    { label: 'Faire une vente',       caissier: true,  pharmacien: true,  admin: true  },
    { label: 'Voir son historique',   caissier: true,  pharmacien: true,  admin: true  },
    { label: "Voir tout l'historique",caissier: false, pharmacien: true,  admin: true  },
    { label: 'Gérer les médicaments', caissier: false, pharmacien: true,  admin: true  },
    { label: 'Gérer les fournisseurs',caissier: false, pharmacien: true,  admin: true  },
    { label: 'Archiver / annuler',    caissier: false, pharmacien: false, admin: true  },
    { label: 'Accès rapports',        caissier: false, pharmacien: true,  admin: true  },
    { label: 'Gérer le personnel',    caissier: false, pharmacien: false, admin: true  },
    { label: 'Accès crédits',         caissier: false, pharmacien: true,  admin: true  },
  ]

  if (loading) {
    return (
      <div className="p-8">
        <PageHeader title="Personnel" />
        <Card padding="none" className="overflow-hidden">
          <div className="p-6">
            <SkeletonTable rows={5} cols={6} />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Personnel"
        actions={
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            + Nouveau compte
          </Button>
        }
      />

      {/* Tableau des droits — visible ADMIN uniquement */}
      {isAdmin && (
        <Card padding="none" className="mb-6 overflow-hidden">
          <button
            onClick={() => setShowDroits((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-navy hover:bg-app-bg transition-colors"
          >
            <span>Droits par rôle</span>
            <span className="text-gray-400">{showDroits ? '▲' : '▼'}</span>
          </button>
          {showDroits && (
            <div className="border-t border-gray-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-app-bg">
                  <tr>
                    <th className="text-left px-6 py-3 text-gray-600 font-medium">Fonctionnalité</th>
                    <th className="text-center px-6 py-3 text-gray-600 font-medium">CAISSIER</th>
                    <th className="text-center px-6 py-3 text-gray-600 font-medium">PHARMACIEN</th>
                    <th className="text-center px-6 py-3 text-gray-600 font-medium">ADMIN</th>
                  </tr>
                </thead>
                <tbody>
                  {DROITS.map((d) => (
                    <tr key={d.label} className="border-t border-gray-100">
                      <td className="px-6 py-3 text-gray-700">{d.label}</td>
                      <td className="px-6 py-3 text-center">{d.caissier  ? '✅' : '❌'}</td>
                      <td className="px-6 py-3 text-center">{d.pharmacien ? '✅' : '❌'}</td>
                      <td className="px-6 py-3 text-center">{d.admin     ? '✅' : '❌'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <Input
              label="Nom"
              required
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Nom complet"
            />
            <Input
              label="Email"
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@pharmacie.com"
            />
            <Input
              label="Mot de passe"
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimum 8 caractères"
            />
            <Select
              label="Rôle"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="CAISSIER">Caissier</option>
              <option value="ADMIN">Admin</option>
            </Select>
            {formError && <p className="col-span-2 text-danger text-sm">{formError}</p>}
            <div className="col-span-2 flex gap-3">
              <Button type="submit" variant="primary" loading={saving}>
                Créer le compte
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card padding="none" className="overflow-hidden">
        {users.length === 0 ? (
          <EmptyState icon="👤" title="Aucun compte" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-app-bg border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Nom</th>
                <th className="text-left px-6 py-3 text-gray-600">Email</th>
                <th className="text-left px-6 py-3 text-gray-600">Rôle</th>
                <th className="text-left px-6 py-3 text-gray-600">Créé le</th>
                <th className="text-center px-6 py-3 text-gray-600">Statut</th>
                <th className="text-right px-6 py-3 text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMoi      = u.id === moiId
                const isEditing  = editingId === u.id

                return (
                  <tr
                    key={u.id}
                    className={`border-b border-gray-100 last:border-0 transition-colors ${
                      !u.actif ? 'opacity-50 bg-app-bg' : 'hover:bg-app-bg'
                    }`}
                  >
                    {/* Nom */}
                    <td className="px-6 py-4 font-medium text-navy">
                      {isEditing ? (
                        <input
                          value={editDraft.nom}
                          onChange={(e) => setEditDraft({ ...editDraft, nom: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded-card focus:outline-none focus:ring-1 focus:ring-mint"
                        />
                      ) : (
                        <>
                          {u.nom}
                          {isMoi && <Badge variant="info" className="ml-2">moi</Badge>}
                        </>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-gray-600">{u.email}</td>

                    {/* Rôle */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <select
                          value={editDraft.role}
                          onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value })}
                          disabled={isMoi}
                          className="px-2 py-1 border border-gray-300 rounded-card focus:outline-none focus:ring-1 focus:ring-mint disabled:opacity-50"
                        >
                          <option value="CAISSIER">Caissier</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      ) : (
                        <Badge variant={roleBadge(u.role)}>{u.role}</Badge>
                      )}
                    </td>

                    {/* Date création */}
                    <td className="px-6 py-4 text-gray-600">{formatDateTime(u.createdAt)}</td>

                    {/* Statut */}
                    <td className="px-6 py-4 text-center">
                      <Badge variant={u.actif ? 'success' : 'danger'}>
                        {u.actif ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      {isMoi ? (
                        <span className="text-xs text-gray-300 italic">—</span>
                      ) : isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="primary" size="sm" onClick={() => saveEdit(u.id)} loading={editSaving}>
                            Sauvegarder
                          </Button>
                          <Button variant="secondary" size="sm" onClick={cancelEdit}>
                            Annuler
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => startEdit(u)}>
                            Modifier
                          </Button>
                          <Button variant={u.actif ? 'danger' : 'secondary'} size="sm" onClick={() => toggleActif(u)}>
                            {u.actif ? 'Désactiver' : 'Réactiver'}
                          </Button>
                        </div>
                      )}
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
