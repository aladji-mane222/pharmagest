'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatMontant, formatDateTime } from '@/lib/utils'
import { formaterNumeroClient } from '@/lib/numerotation'
import { Modal, useToast, Card, Button, Badge, Input, Select, EmptyState, Skeleton, SkeletonCard } from '@/components/ui'

interface LigneVente {
  id: string
  quantite: number
  prixUnitaire: number
  medicament: { nom: string }
}

interface Vente {
  id: string
  montantTotal: number
  montantPaye: number
  modePaiement: string
  statut: string
  createdAt: string
  lignes: LigneVente[]
}

interface Client {
  id: string
  numeroClient: number | null
  nom: string
  telephone: string | null
  email: string | null
  soldeCredit: number
  plafondCredit: number
  actif: boolean
  ventes: Vente[]
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const STATUT_BADGE: Record<string, BadgeVariant> = {
  COMPLETE:  'success',
  PARTIELLE: 'warning',
  ANNULEE:   'danger',
}

const STATUT_LABEL: Record<string, string> = {
  COMPLETE:  'Complète',
  PARTIELLE: 'Crédit',
  ANNULEE:   'Annulée',
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  const [client,  setClient]  = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur,  setErreur]  = useState<string | null>(null)

  // Remboursement
  const [montantRemb, setMontantRemb] = useState('')
  const [modeRemb,    setModeRemb]    = useState('ESPECES')
  const [noteRemb,    setNoteRemb]    = useState('')
  const [savingRemb,  setSavingRemb]  = useState(false)
  const [errRemb,     setErrRemb]     = useState<string | null>(null)
  const [okRemb,      setOkRemb]      = useState(false)

  // Modification
  const [showEdit,    setShowEdit]    = useState(false)
  const [formEdit,    setFormEdit]    = useState({ nom: '', telephone: '', email: '', plafondCredit: '' })
  const [savingEdit,  setSavingEdit]  = useState(false)
  const [errEdit,     setErrEdit]     = useState<string | null>(null)

  // Archivage
  const [archiving,   setArchiving]   = useState(false)
  const [errArch,     setErrArch]     = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setClient(json.data)
          setFormEdit({
            nom:           json.data.nom,
            telephone:     json.data.telephone ?? '',
            email:         json.data.email ?? '',
            plafondCredit: String(json.data.plafondCredit),
          })
        } else {
          setErreur('Client introuvable')
        }
        setLoading(false)
      })
      .catch(() => { setErreur('Erreur de chargement'); setLoading(false) })
  }, [id])

  const handleRembourser = async () => {
    setErrRemb(null)
    setOkRemb(false)
    const montant = parseFloat(montantRemb)
    if (!montant || montant <= 0) { setErrRemb('Montant invalide'); return }
    setSavingRemb(true)
    const res  = await fetch(`/api/clients/${id}/rembourser`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ montant, modePaiement: modeRemb, note: noteRemb }),
    })
    const json = await res.json()
    if (res.ok) {
      setClient((c) => c ? { ...c, soldeCredit: json.data.soldeCredit } : c)
      setMontantRemb('')
      setNoteRemb('')
      setOkRemb(true)
      setTimeout(() => setOkRemb(false), 3000)
    } else {
      setErrRemb(json.error || 'Erreur lors du remboursement')
    }
    setSavingRemb(false)
  }

  const handleModifier = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrEdit(null)
    setSavingEdit(true)
    const res  = await fetch(`/api/clients/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        nom:           formEdit.nom,
        telephone:     formEdit.telephone || null,
        email:         formEdit.email || null,
        plafondCredit: parseFloat(formEdit.plafondCredit),
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setClient((c) => c ? { ...c, ...json.data } : c)
      setShowEdit(false)
    } else {
      setErrEdit(json.error || 'Erreur lors de la modification')
    }
    setSavingEdit(false)
  }

  const [confirmArchive, setConfirmArchive] = useState(false)
  const { showToast } = useToast()

  const handleArchiver = async () => {
    setErrArch(null)
    setArchiving(true)
    const res  = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (res.ok) {
      setClient((c) => c ? { ...c, actif: false } : c)
      showToast('Client archivé', 'success')
    } else {
      setErrArch(json.error || 'Erreur lors de l\'archivage')
    }
    setArchiving(false)
    setConfirmArchive(false)
  }

  // Lien retour uniformisé avec le reste de l'app (Phase 5 — 3 styles
  // differents trouves sur clients/fournisseurs/ventes avant ce lot),
  // affiche systematiquement y compris pendant chargement/erreur.
  const lienRetour = (
    <Link href="/clients" className="text-sm text-gray-500 hover:text-mint-dark hover:underline mb-4 inline-block">
      ← Retour aux clients
    </Link>
  )

  if (loading) {
    return (
      <div className="p-8 max-w-3xl">
        {lienRetour}
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-2 gap-6 mb-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    )
  }

  if (erreur) {
    return (
      <div className="p-8">
        {lienRetour}
        <p className="text-danger">{erreur}</p>
      </div>
    )
  }

  if (!client) return null

  const pct = client.plafondCredit > 0
    ? Math.round((client.soldeCredit / client.plafondCredit) * 100)
    : 0
  const couleurBarre = pct > 80 ? 'bg-danger' : pct > 50 ? 'bg-warning' : 'bg-success'

  return (
    <div className="p-8 max-w-3xl">
      {lienRetour}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-navy">{client.nom}</h1>
          {formaterNumeroClient(client.numeroClient) && (
            <span className="text-gray-400 text-sm">{formaterNumeroClient(client.numeroClient)}</span>
          )}
          {!client.actif && <Badge variant="neutral">Archivé</Badge>}
        </div>
        {client.actif && (
          <div className="flex gap-2 items-center">
            {isAdmin ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setShowEdit(!showEdit)}>
                  Modifier
                </Button>
                {client.soldeCredit === 0 && (
                  <Button variant="danger" size="sm" onClick={() => setConfirmArchive(true)} loading={archiving}>
                    Archiver
                  </Button>
                )}
              </>
            ) : (
              <span title="Réservé aux administrateurs" className="text-gray-300 cursor-help text-lg">🔒</span>
            )}
          </div>
        )}
      </div>

      {errArch && <p className="text-danger text-sm mb-4">{errArch}</p>}

      {/* Formulaire modification */}
      {showEdit && (
        <Card className="mb-6">
          <form onSubmit={handleModifier} className="grid grid-cols-2 gap-4">
            <Input
              label="Nom"
              required
              value={formEdit.nom}
              onChange={(e) => setFormEdit({ ...formEdit, nom: e.target.value })}
            />
            <Input
              label="Téléphone"
              value={formEdit.telephone}
              onChange={(e) => setFormEdit({ ...formEdit, telephone: e.target.value })}
              placeholder="+224 xxx xxx xxx"
            />
            <Input
              label="Email"
              type="email"
              value={formEdit.email}
              onChange={(e) => setFormEdit({ ...formEdit, email: e.target.value })}
            />
            <Input
              label="Plafond crédit (GNF)"
              type="number"
              value={formEdit.plafondCredit}
              onChange={(e) => setFormEdit({ ...formEdit, plafondCredit: e.target.value })}
            />
            {errEdit && <p className="col-span-2 text-danger text-sm">{errEdit}</p>}
            <div className="col-span-2 flex gap-3">
              <Button type="submit" variant="primary" size="sm" loading={savingEdit}>
                Sauvegarder
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowEdit(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Carte infos + crédit */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Infos */}
        <Card>
          <h2 className="font-semibold text-navy mb-4">Informations</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Téléphone</span>
              <span className="font-medium">{client.telephone || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{client.email || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Ventes</span>
              <span className="font-medium">{client.ventes.length}</span>
            </div>
          </div>
        </Card>

        {/* Crédit */}
        <Card>
          <h2 className="font-semibold text-navy mb-4">Crédit</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Solde dû</span>
              <span className={`font-bold text-lg ${client.soldeCredit > 0 ? 'text-danger' : 'text-success'}`}>
                {formatMontant(client.soldeCredit)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Plafond</span>
              <span className="font-medium">{formatMontant(client.plafondCredit)}</span>
            </div>
            {client.plafondCredit > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Utilisation</span>
                  <span className={pct > 80 ? 'text-danger font-medium' : ''}>{pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${couleurBarre}`}
                    style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Section remboursement — ouverte a CAISSIER et ADMIN (decision
          Phase 5, RECAP-COMPLET.md : "le caissier est souvent seul sur
          place, doit pouvoir voir les credits, faire les relances et les
          remboursements"). Corrige le 06/08/2026 : cette section etait
          restee gatee isAdmin depuis le code d'origine (Session C,
          30/06/2026), la decision Phase 5 n'ayant debloque que le
          middleware de /credits, pas ce formulaire. */}
      {client.actif && client.soldeCredit > 0 && (
        <Card className="mb-6">
          <h2 className="font-semibold text-navy mb-4">Enregistrer un remboursement</h2>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label={`Montant (GNF) — max ${formatMontant(client.soldeCredit)}`}
              type="number"
              value={montantRemb}
              onChange={(e) => setMontantRemb(e.target.value)}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              max={client.soldeCredit}
              placeholder="0"
            />
            <div>
              <Select label="Mode de paiement" value={modeRemb} onChange={(e) => setModeRemb(e.target.value)}>
                <option value="ESPECES">Especes</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="ORANGE_MONEY">Orange Money</option>
                <option value="MTN_MONEY">MTN Money</option>
                <option value="PAIEMENT_MARCHAND">Paiement Marchand</option>
                <option value="CARTE">Carte</option>
              </Select>
              {modeRemb === 'ESPECES' && (
                <p className="text-xs text-gray-400 mt-1">Necessite une session caisse ouverte</p>
              )}
            </div>
            <Input
              label="Note (optionnel)"
              value={noteRemb}
              onChange={(e) => setNoteRemb(e.target.value)}
              placeholder="Ex: versement du 17/07"
            />
          </div>
          {errRemb && <p className="text-danger text-sm mt-2">{errRemb}</p>}
          {okRemb  && <p className="text-success text-sm mt-2">Remboursement enregistré ✓</p>}
          <Button variant="primary" size="sm" className="mt-3" onClick={handleRembourser} loading={savingRemb}>
            Enregistrer le remboursement
          </Button>
        </Card>
      )}

      {/* Historique ventes */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-app-bg flex justify-between items-center">
          <h2 className="font-semibold text-navy">20 dernières ventes</h2>
          <span className="text-xs text-gray-400">{client.ventes.length} vente{client.ventes.length > 1 ? 's' : ''}</span>
        </div>
        {client.ventes.length === 0 ? (
          <EmptyState icon="🧾" title="Aucune vente enregistrée" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Date</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Articles</th>
                <th className="text-right px-6 py-3 text-gray-500 font-medium">Montant</th>
                <th className="text-center px-6 py-3 text-gray-500 font-medium">Statut</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {client.ventes.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 last:border-0 hover:bg-app-bg">
                  <td className="px-6 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(v.createdAt)}</td>
                  <td className="px-6 py-3 text-gray-600 text-xs">
                    {v.lignes.slice(0, 2).map((l) => l.medicament.nom).join(', ')}
                    {v.lignes.length > 2 && ` +${v.lignes.length - 2}`}
                  </td>
                  <td className="px-6 py-3 text-right font-medium">{formatMontant(v.montantTotal)}</td>
                  <td className="px-6 py-3 text-center">
                    <Badge variant={STATUT_BADGE[v.statut] ?? 'neutral'}>
                      {STATUT_LABEL[v.statut] ?? v.statut}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    <Link href={`/ventes/${v.id}`} className="text-mint-dark hover:underline text-xs">
                      Voir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={handleArchiver}
        title={`Archiver ${client?.nom} ?`}
        description="Le client ne sera plus visible dans la liste active. Cette action est réversible depuis la base si besoin."
        variant="danger"
        confirmLabel="Archiver"
        loading={archiving}
      />
    </div>
  )
}