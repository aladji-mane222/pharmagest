// CIBLE: src/app/(dashboard)/personnel/page.tsx

'use client'

import { useEffect, useState, Fragment } from 'react'
import { useSession } from 'next-auth/react'
import { formatDateTime } from '@/lib/utils'
import { Modal, useToast, Card, PageHeader, Button, Input, Select, Badge, EmptyState, SkeletonTable } from '@/components/ui'

interface User {
  id: string
  nom: string
  email: string
  role: string
  actif: boolean
  createdAt: string
}

interface PermissionSupplementaire {
  id: string
  type: string
  expireLe: string | null
  accordePar: { nom: string }
  createdAt: string
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const roleBadge = (role: string): BadgeVariant => {
  if (role === 'SUPER_ADMIN') return 'info'
  if (role === 'ADMIN')       return 'warning'
  return 'neutral'
}

// Les 4 droits accordables ponctuellement a un caissier, au-dela de ses
// droits de base — permanents ou temporaires selon la date d'expiration
// (vide = permanent). Demande de Nabe le 27/07/2026, avant la Phase 6.
const TYPES_PERMISSION: { type: string; label: string; description: string }[] = [
  { type: 'INVENTAIRE_COMPLET', label: 'Inventaire',            description: 'Lancer, saisir et valider un inventaire' },
  { type: 'ANNULER_VENTE',      label: 'Annuler une vente',     description: "Annuler une vente déjà encaissée" },
  { type: 'HISTORIQUE_COMPLET', label: "Voir tout l'historique",description: 'Voir les ventes de tous les caissiers, pas seulement les siennes' },
  { type: 'ACCES_RAPPORTS',     label: 'Accès rapports',        description: 'Consulter les rapports et le journal d\'activité' },
]

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

  // Réinitialisation de mot de passe (admin -> autre compte)
  const [resetPourUser, setResetPourUser] = useState<User | null>(null)
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [resetErreur, setResetErreur] = useState('')

  // Panneau permissions supplémentaires
  const [permissionsOuvertPour, setPermissionsOuvertPour] = useState<string | null>(null)
  const [permissionsActuelles, setPermissionsActuelles] = useState<PermissionSupplementaire[]>([])
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [permissionsForm, setPermissionsForm] = useState<Record<string, { active: boolean; expireLe: string }>>({})
  const [permissionsSaving, setPermissionsSaving] = useState(false)

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

  // ── Réinitialisation de mot de passe ──
  const reinitialiserMotDePasse = async () => {
    if (!resetPourUser) return
    setResetErreur('')
    if (nouveauMdp.length < 6) {
      setResetErreur('Le nouveau mot de passe doit contenir au moins 6 caractères')
      return
    }
    setResetSaving(true)
    const res = await fetch(`/api/users/${resetPourUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nouveauMotDePasse: nouveauMdp }),
    })
    const json = await res.json()
    if (res.ok) {
      showToast(`Mot de passe de ${resetPourUser.nom} réinitialisé`, 'success')
      setResetPourUser(null)
      setNouveauMdp('')
    } else {
      setResetErreur(json.error ?? 'Erreur lors de la réinitialisation')
    }
    setResetSaving(false)
  }

  // ── Permissions supplémentaires ──
  const ouvrirPermissions = async (u: User) => {
    if (permissionsOuvertPour === u.id) {
      setPermissionsOuvertPour(null)
      return
    }
    setPermissionsOuvertPour(u.id)
    setPermissionsLoading(true)
    const res = await fetch(`/api/users/${u.id}/permissions`)
    const json = await res.json()
    const actuelles: PermissionSupplementaire[] = json.data || []
    setPermissionsActuelles(actuelles)

    const initial: Record<string, { active: boolean; expireLe: string }> = {}
    for (const t of TYPES_PERMISSION) {
      const existante = actuelles.find((p) => p.type === t.type)
      initial[t.type] = {
        active: !!existante,
        expireLe: existante?.expireLe ? existante.expireLe.slice(0, 10) : '',
      }
    }
    setPermissionsForm(initial)
    setPermissionsLoading(false)
  }

  const sauvegarderPermissions = async (userId: string) => {
    setPermissionsSaving(true)
    try {
      for (const t of TYPES_PERMISSION) {
        const etatVoulu = permissionsForm[t.type]
        const existaitDeja = permissionsActuelles.some((p) => p.type === t.type)

        if (etatVoulu.active) {
          // Accorder ou mettre a jour (upsert cote API)
          await fetch(`/api/users/${userId}/permissions`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: t.type,
              expireLe: etatVoulu.expireLe || null,
            }),
          })
        } else if (existaitDeja) {
          // Etait accordee avant, decochee maintenant → revoquer
          await fetch(`/api/users/${userId}/permissions?type=${t.type}`, { method: 'DELETE' })
        }
      }
      showToast('Droits mis à jour', 'success')
      setPermissionsOuvertPour(null)
    } catch {
      showToast('Erreur lors de la mise à jour des droits', 'error')
    } finally {
      setPermissionsSaving(false)
    }
  }

  const DROITS = [
    { label: 'Faire une vente',       caissier: true,  admin: true  },
    { label: 'Voir son historique',   caissier: true,  admin: true  },
    { label: "Voir tout l'historique",caissier: false, admin: true  },
    { label: 'Gérer les médicaments', caissier: false, admin: true  },
    { label: 'Gérer les fournisseurs',caissier: false, admin: true  },
    { label: 'Archiver / annuler',    caissier: false, admin: true  },
    { label: 'Accès rapports',        caissier: false, admin: true  },
    { label: 'Gérer le personnel',    caissier: false, admin: true  },
    { label: 'Accès crédits',         caissier: false, admin: true  },
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
                    <th className="text-center px-6 py-3 text-gray-600 font-medium">ADMIN</th>
                  </tr>
                </thead>
                <tbody>
                  {DROITS.map((d) => (
                    <tr key={d.label} className="border-t border-gray-100">
                      <td className="px-6 py-3 text-gray-700">{d.label}</td>
                      <td className="px-6 py-3 text-center">{d.caissier  ? '✅' : '❌'}</td>
                      <td className="px-6 py-3 text-center">{d.admin     ? '✅' : '❌'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-6 py-3 text-xs text-gray-400 border-t border-gray-100">
                Un caissier peut recevoir des droits supplémentaires ponctuels (permanents ou
                temporaires) via le bouton "Droits" en face de son nom ci-dessous.
              </p>
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
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-app-bg border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 whitespace-nowrap">Nom</th>
                <th className="text-left px-6 py-3 text-gray-600 whitespace-nowrap">Email</th>
                <th className="text-left px-6 py-3 text-gray-600 whitespace-nowrap">Rôle</th>
                <th className="text-left px-6 py-3 text-gray-600 whitespace-nowrap">Créé le</th>
                <th className="text-center px-6 py-3 text-gray-600 whitespace-nowrap">Statut</th>
                <th className="text-right px-6 py-3 text-gray-600 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMoi      = u.id === moiId
                const isEditing  = editingId === u.id
                const permissionsOuvertes = permissionsOuvertPour === u.id

                return (
                  <Fragment key={u.id}>
                  <tr
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
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="primary" size="sm" onClick={() => saveEdit(u.id)} loading={editSaving}>
                            Sauvegarder
                          </Button>
                          <Button variant="secondary" size="sm" onClick={cancelEdit}>
                            Annuler
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          {u.role === 'CAISSIER' && u.actif && (
                            <Button
                              variant={permissionsOuvertes ? 'primary' : 'secondary'}
                              size="sm"
                              onClick={() => ouvrirPermissions(u)}
                            >
                              Droits
                            </Button>
                          )}
                          <Button variant="secondary" size="sm" onClick={() => startEdit(u)}>
                            Modifier
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => { setResetPourUser(u); setNouveauMdp(''); setResetErreur('') }}>
                            Mot de passe
                          </Button>
                          <Button variant={u.actif ? 'danger' : 'secondary'} size="sm" onClick={() => toggleActif(u)}>
                            {u.actif ? 'Désactiver' : 'Réactiver'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Panneau permissions supplémentaires */}
                  {permissionsOuvertes && (
                    <tr className="bg-app-bg border-b border-gray-100">
                      <td colSpan={6} className="px-6 py-5">
                        {permissionsLoading ? (
                          <p className="text-sm text-gray-400">Chargement...</p>
                        ) : (
                          <div>
                            <p className="text-sm font-medium text-navy mb-3">
                              Droits supplémentaires accordés à {u.nom}
                            </p>
                            <div className="space-y-3">
                              {TYPES_PERMISSION.map((t) => {
                                const etat = permissionsForm[t.type] || { active: false, expireLe: '' }
                                return (
                                  <div key={t.type} className="flex items-center gap-4 flex-wrap">
                                    <label className="flex items-center gap-2 min-w-[220px]">
                                      <input
                                        type="checkbox"
                                        checked={etat.active}
                                        onChange={(e) =>
                                          setPermissionsForm({
                                            ...permissionsForm,
                                            [t.type]: { ...etat, active: e.target.checked },
                                          })
                                        }
                                        className="w-4 h-4 rounded border-gray-300 text-mint focus:ring-mint"
                                      />
                                      <span className="text-sm font-medium text-navy">{t.label}</span>
                                    </label>
                                    <span className="text-xs text-gray-400 flex-1 min-w-[200px]">{t.description}</span>
                                    {etat.active && (
                                      <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-500">Expire le</label>
                                        <input
                                          type="date"
                                          value={etat.expireLe}
                                          min={new Date().toISOString().slice(0, 10)}
                                          onChange={(e) =>
                                            setPermissionsForm({
                                              ...permissionsForm,
                                              [t.type]: { ...etat, expireLe: e.target.value },
                                            })
                                          }
                                          className="px-2 py-1 border border-gray-300 rounded-card text-xs focus:outline-none focus:ring-1 focus:ring-mint"
                                        />
                                        <span className="text-xs text-gray-400">(vide = permanent)</span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                            <div className="flex gap-3 mt-4">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => sauvegarderPermissions(u.id)}
                                loading={permissionsSaving}
                              >
                                Enregistrer les droits
                              </Button>
                              <Button variant="secondary" size="sm" onClick={() => setPermissionsOuvertPour(null)}>
                                Fermer
                              </Button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!resetPourUser}
        onClose={() => setResetPourUser(null)}
        onConfirm={reinitialiserMotDePasse}
        title={`Réinitialiser le mot de passe de ${resetPourUser?.nom ?? ''}`}
        description="Le nouveau mot de passe prend effet immédiatement — pense à le communiquer à la personne concernée."
        variant="default"
        confirmLabel="Réinitialiser"
        loading={resetSaving}
      >
        <Input
          label="Nouveau mot de passe"
          type="password"
          value={nouveauMdp}
          onChange={(e) => setNouveauMdp(e.target.value)}
          placeholder="Minimum 6 caractères"
        />
        {resetErreur && <p className="text-danger text-sm mt-2">{resetErreur}</p>}
      </Modal>
    </div>
  )
}
