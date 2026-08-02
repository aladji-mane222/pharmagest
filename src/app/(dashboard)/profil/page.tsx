'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatDate } from '@/lib/utils'
import { useToast, Card, PageHeader, Button, Input, Badge, Skeleton } from '@/components/ui'

interface Permission {
  type: string
  expireLe: string | null
}

interface Profil {
  id: string
  nom: string
  email: string
  role: string
  createdAt: string
  permissions: Permission[]
}

const LABELS_PERMISSION: Record<string, string> = {
  INVENTAIRE_COMPLET: 'Inventaire',
  ANNULER_VENTE: 'Annuler une vente',
  HISTORIQUE_COMPLET: "Voir tout l'historique",
  ACCES_RAPPORTS: 'Accès rapports',
}

const LABELS_ROLE: Record<string, string> = {
  SUPER_ADMIN: 'Super administrateur',
  ADMIN: 'Administrateur',
  CAISSIER: 'Caissier',
}

export default function ProfilPage() {
  const { update: updateSession } = useSession()
  const { showToast } = useToast()

  const [profil, setProfil] = useState<Profil | null>(null)
  const [loading, setLoading] = useState(true)

  // Formulaire nom
  const [nom, setNom] = useState('')
  const [savingNom, setSavingNom] = useState(false)

  // Formulaire email
  const [email, setEmail] = useState('')
  const [mdpPourEmail, setMdpPourEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [erreurEmail, setErreurEmail] = useState('')

  // Formulaire mot de passe
  const [ancienMdp, setAncienMdp] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmMdp, setConfirmMdp] = useState('')
  const [savingMdp, setSavingMdp] = useState(false)
  const [erreurMdp, setErreurMdp] = useState('')

  const charger = () => {
    fetch('/api/users/me')
      .then((res) => res.json())
      .then((json) => {
        setProfil(json.data)
        setNom(json.data.nom)
        setEmail(json.data.email)
        setLoading(false)
      })
  }

  useEffect(() => {
    charger()
  }, [])

  const enregistrerNom = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingNom(true)
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom }),
    })
    const json = await res.json()
    if (res.ok) {
      showToast('Nom mis à jour', 'success')
      setProfil((p) => p ? { ...p, nom: json.data.nom } : p)
      // Rafraichit la session pour que le nom affiche a jour immediatement
      // dans la sidebar sans attendre une reconnexion.
      await updateSession()
    } else {
      showToast(json.error || 'Erreur lors de la mise à jour', 'error')
    }
    setSavingNom(false)
  }

  const enregistrerEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreurEmail('')
    setSavingEmail(true)
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ancienMotDePasse: mdpPourEmail }),
    })
    const json = await res.json()
    if (res.ok) {
      showToast('Email mis à jour', 'success')
      setProfil((p) => p ? { ...p, email: json.data.email } : p)
      setMdpPourEmail('')
    } else {
      setErreurEmail(json.error || 'Erreur lors de la mise à jour')
    }
    setSavingEmail(false)
  }

  const enregistrerMotDePasse = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreurMdp('')
    if (nouveauMdp !== confirmMdp) {
      setErreurMdp('Les deux mots de passe ne correspondent pas')
      return
    }
    if (nouveauMdp.length < 6) {
      setErreurMdp('Le nouveau mot de passe doit contenir au moins 6 caractères')
      return
    }
    setSavingMdp(true)
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ancienMotDePasse: ancienMdp, nouveauMotDePasse: nouveauMdp }),
    })
    const json = await res.json()
    if (res.ok) {
      showToast('Mot de passe modifié', 'success')
      setAncienMdp('')
      setNouveauMdp('')
      setConfirmMdp('')
    } else {
      setErreurMdp(json.error || 'Erreur lors de la modification')
    }
    setSavingMdp(false)
  }

  if (loading) {
    return (
      <div className="p-8 max-w-2xl">
        <PageHeader title="Mon profil" />
        <Skeleton className="h-40 mb-6" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  if (!profil) return null

  return (
    <div className="p-8 max-w-2xl">
      <PageHeader title="Mon profil" />

      <Card className="mb-6">
        <h2 className="font-semibold text-navy mb-4">Informations</h2>
        <form onSubmit={enregistrerNom} className="space-y-4">
          <Input label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
          <div>
            <p className="text-gray-500 text-sm mb-1">Rôle</p>
            <p className="text-navy text-sm">{LABELS_ROLE[profil.role] ?? profil.role}</p>
          </div>
          <p className="text-xs text-gray-400">
            Compte créé le {formatDate(profil.createdAt)}. Le rôle n'est jamais modifiable
            soi-même, y compris pour un administrateur — contacte un autre administrateur ou le
            support si besoin.
          </p>
          <Button type="submit" variant="primary" size="sm" loading={savingNom}>
            Enregistrer le nom
          </Button>
        </form>
      </Card>

      <Card className="mb-6">
        <h2 className="font-semibold text-navy mb-4">Email de connexion</h2>
        <form onSubmit={enregistrerEmail} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Mot de passe actuel (pour confirmer)"
            type="password"
            value={mdpPourEmail}
            onChange={(e) => setMdpPourEmail(e.target.value)}
            required
          />
          {erreurEmail && <p className="text-danger text-sm">{erreurEmail}</p>}
          <p className="text-xs text-gray-400">
            C'est cet email qui te sert à te connecter — pense à bien le retenir après l'avoir changé.
          </p>
          <Button type="submit" variant="primary" size="sm" loading={savingEmail}>
            Enregistrer l'email
          </Button>
        </form>
      </Card>

      <Card className="mb-6">
        <h2 className="font-semibold text-navy mb-4">Mot de passe</h2>
        <form onSubmit={enregistrerMotDePasse} className="space-y-4">
          <Input
            label="Mot de passe actuel"
            type="password"
            value={ancienMdp}
            onChange={(e) => setAncienMdp(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nouveau mot de passe"
              type="password"
              value={nouveauMdp}
              onChange={(e) => setNouveauMdp(e.target.value)}
              placeholder="Minimum 6 caractères"
              required
            />
            <Input
              label="Confirmer le nouveau mot de passe"
              type="password"
              value={confirmMdp}
              onChange={(e) => setConfirmMdp(e.target.value)}
              required
            />
          </div>
          {erreurMdp && <p className="text-danger text-sm">{erreurMdp}</p>}
          <Button type="submit" variant="primary" size="sm" loading={savingMdp}>
            Modifier le mot de passe
          </Button>
        </form>
      </Card>

      {profil.role === 'CAISSIER' && (
        <Card>
          <h2 className="font-semibold text-navy mb-1">Mes droits supplémentaires</h2>
          <p className="text-xs text-gray-400 mb-4">
            Droits accordés par un administrateur, en plus de tes droits habituels de caissier.
          </p>
          {profil.permissions.length === 0 ? (
            <p className="text-gray-400 text-sm">
              Aucun droit supplémentaire pour l'instant.
            </p>
          ) : (
            <ul className="space-y-2">
              {profil.permissions.map((p) => (
                <li key={p.type} className="flex items-center justify-between text-sm">
                  <span className="text-navy font-medium">{LABELS_PERMISSION[p.type] ?? p.type}</span>
                  {p.expireLe ? (
                    <Badge variant="warning">Jusqu'au {formatDate(p.expireLe)}</Badge>
                  ) : (
                    <Badge variant="success">Permanent</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
