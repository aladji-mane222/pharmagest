'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatDateTime } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

interface User {
  id: string
  nom: string
  email: string
  role: string
  actif: boolean
  createdAt: string
}

const roleCouleur = (role: string) => {
  if (role === 'SUPER_ADMIN') return 'bg-purple-100 text-purple-700'
  if (role === 'ADMIN')       return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-700'
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

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

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

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Personnel</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          + Nouveau compte
        </button>
      </div>

      {/* Tableau des droits — visible ADMIN uniquement */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow mb-6 overflow-hidden">
          <button
            onClick={() => setShowDroits((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>Droits par rôle</span>
            <span className="text-gray-400">{showDroits ? '▲' : '▼'}</span>
          </button>
          {showDroits && (
            <div className="border-t overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-gray-600 font-medium">Fonctionnalité</th>
                    <th className="text-center px-6 py-3 text-gray-600 font-medium">CAISSIER</th>
                    <th className="text-center px-6 py-3 text-gray-600 font-medium">PHARMACIEN</th>
                    <th className="text-center px-6 py-3 text-gray-600 font-medium">ADMIN</th>
                  </tr>
                </thead>
                <tbody>
                  {DROITS.map((d) => (
                    <tr key={d.label} className="border-t">
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
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              required
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Nom complet"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="email@pharmacie.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Minimum 8 caractères"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="CAISSIER">Caissier</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          {formError && <p className="col-span-2 text-red-500 text-sm">{formError}</p>}
          <div className="col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Création...' : 'Créer le compte'}
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

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
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
                  className={`border-b last:border-0 transition-colors ${
                    !u.actif ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Nom */}
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {isEditing ? (
                      <input
                        value={editDraft.nom}
                        onChange={(e) => setEditDraft({ ...editDraft, nom: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                    ) : (
                      <>
                        {u.nom}
                        {isMoi && (
                          <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-xs font-medium">
                            moi
                          </span>
                        )}
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
                        className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                      >
                        <option value="CAISSIER">Caissier</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleCouleur(u.role)}`}>
                        {u.role}
                      </span>
                    )}
                  </td>

                  {/* Date création */}
                  <td className="px-6 py-4 text-gray-600">{formatDateTime(u.createdAt)}</td>

                  {/* Statut */}
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {u.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    {isMoi ? (
                      <span className="text-xs text-gray-300 italic">—</span>
                    ) : isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(u.id)}
                          disabled={editSaving}
                          className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {editSaving ? '...' : 'Sauvegarder'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(u)}
                          className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => toggleActif(u)}
                          className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                            u.actif
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                        >
                          {u.actif ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
