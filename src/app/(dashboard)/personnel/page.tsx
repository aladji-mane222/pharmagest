'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatDateTime } from '@/lib/utils'
import { Modal, useToast } from '@/components/ui'

interface User {
  id: string
  nom: string
  email: string
  role: string
  actif: boolean
  createdAt: string
}

const ROLE_STYLE: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN:       'bg-blue-100 text-blue-700',
  CAISSIER:    'bg-gray-100 text-gray-700',
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN:       'Admin',
  CAISSIER:    'Caissier',
}

export default function PersonnelPage() {
  const { data: sessionAuth } = useSession()
  const moi = sessionAuth?.user?.id

  const [users,      setUsers]      = useState<User[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [erreur,     setErreur]     = useState<string | null>(null)

  // Formulaire création
  const [form, setForm] = useState({ nom: '', email: '', password: '', role: 'CAISSIER' })

  // Modification inline
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editNom,  setEditNom]  = useState('')
  const [editRole, setEditRole] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((json) => {
        setUsers(json.data || [])
        setLoading(false)
      })
  }, [])

  const handleCreer = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur(null)
    setSaving(true)
    const res  = await fetch('/api/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    const json = await res.json()
    if (res.ok) {
      setUsers([json.data, ...users])
      setForm({ nom: '', email: '', password: '', role: 'CAISSIER' })
      setShowForm(false)
    } else {
      setErreur(json.error || 'Erreur lors de la création')
    }
    setSaving(false)
  }

  const ouvrirEdition = (u: User) => {
    setEditId(u.id)
    setEditNom(u.nom)
    setEditRole(u.role)
    setErreur(null)
  }

  const sauvegarderEdition = async (id: string) => {
    setErreur(null)
    setSavingEdit(true)
    const res  = await fetch(`/api/users/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nom: editNom, role: editRole }),
    })
    const json = await res.json()
    if (res.ok) {
      setUsers(users.map((u) => u.id === id ? json.data : u))
      setEditId(null)
    } else {
      setErreur(json.error || 'Erreur lors de la modification')
    }
    setSavingEdit(false)
  }

  const [confirmToggle, setConfirmToggle] = useState<User | null>(null)
  const [toggling, setToggling] = useState(false)
  const { showToast } = useToast()

  const toggleActif = async () => {
    if (!confirmToggle) return
    const u = confirmToggle
    setToggling(true)
    setErreur(null)
    const res  = await fetch(`/api/users/${u.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ actif: !u.actif }),
    })
    const json = await res.json()
    if (res.ok) {
      setUsers(users.map((usr) => usr.id === u.id ? json.data : usr))
      showToast(u.actif ? 'Compte désactivé' : 'Compte réactivé', 'success')
    } else {
      setErreur(json.error || `Erreur lors de la mise à jour`)
    }
    setToggling(false)
    setConfirmToggle(null)
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Personnel</h1>
        <button onClick={() => { setShowForm(!showForm); setErreur(null) }}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
          + Nouveau compte
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreer}
          className="bg-white rounded-xl shadow p-6 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input required value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Nom complet" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input required type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="email@pharmacie.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
            <input required type="password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Minimum 8 caractères" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
            <select value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="CAISSIER">Caissier</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          {erreur && <p className="col-span-2 text-red-500 text-sm">{erreur}</p>}
          <div className="col-span-2 flex gap-3">
            <button type="submit" disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Création...' : 'Créer le compte'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200">
              Annuler
            </button>
          </div>
        </form>
      )}

      {erreur && !showForm && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {erreur}
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-gray-600 font-medium">Nom</th>
              <th className="text-left px-6 py-3 text-gray-600 font-medium">Email</th>
              <th className="text-left px-6 py-3 text-gray-600 font-medium">Rôle</th>
              <th className="text-left px-6 py-3 text-gray-600 font-medium">Créé le</th>
              <th className="text-center px-6 py-3 text-gray-600 font-medium">Statut</th>
              <th className="text-right px-6 py-3 text-gray-600 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-b last:border-0 ${!u.actif ? 'opacity-50' : 'hover:bg-gray-50'}`}>
                <td className="px-6 py-4 font-medium text-gray-800">
                  {editId === u.id ? (
                    <input value={editNom}
                      onChange={(e) => setEditNom(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm w-36 focus:outline-none focus:ring-2 focus:ring-green-500" />
                  ) : (
                    <span>{u.nom} {u.id === moi && <span className="text-xs text-gray-400">(moi)</span>}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-600">{u.email}</td>
                <td className="px-6 py-4">
                  {editId === u.id ? (
                    <select value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      <option value="CAISSIER">Caissier</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_STYLE[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-500 text-xs">{formatDateTime(u.createdAt)}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {u.id !== moi && (
                    <div className="flex items-center justify-end gap-3">
                      {editId === u.id ? (
                        <>
                          <button onClick={() => sauvegarderEdition(u.id)} disabled={savingEdit}
                            className="text-green-600 hover:text-green-800 text-xs font-medium disabled:opacity-50">
                            {savingEdit ? 'Sauvegarde...' : 'Sauvegarder'}
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="text-gray-400 hover:text-gray-600 text-xs">
                            Annuler
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => ouvrirEdition(u)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                            Modifier
                          </button>
                          <button onClick={() => setConfirmToggle(u)}
                            className={`text-xs font-medium ${u.actif ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}>
                            {u.actif ? 'Désactiver' : 'Réactiver'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={toggleActif}
        title={confirmToggle ? `${confirmToggle.actif ? 'Désactiver' : 'Réactiver'} le compte de ${confirmToggle.nom} ?` : ''}
        description={confirmToggle?.actif
          ? "L'employé ne pourra plus se connecter tant que le compte n'est pas réactivé."
          : "L'employé pourra à nouveau se connecter normalement."}
        variant={confirmToggle?.actif ? 'danger' : 'default'}
        confirmLabel={confirmToggle?.actif ? 'Désactiver' : 'Réactiver'}
        loading={toggling}
      />
    </div>
  )
}