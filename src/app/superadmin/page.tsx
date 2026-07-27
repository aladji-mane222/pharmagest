'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import { Card, PageHeader, Button, Badge, EmptyState, SkeletonTable } from '@/components/ui'

interface Pharmacie {
  id: string
  nom: string
  adresse: string | null
  telephone: string | null
  licenceActive: boolean
  licenceExpire: string | null
  createdAt: string
  _count: { users: number; medicaments: number; ventes: number }
}

interface BackupStatut {
  pharmacieId:  string
  pharmacieNom: string
  dernierSucces: { date: string; fichier: string | null; taille: number | null } | null
  dernierEchec:  { date: string; erreur: string | null } | null
}

export default function SuperAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pharmacies, setPharmacies] = useState<Pharmacie[]>([])
  const [backups,    setBackups]    = useState<BackupStatut[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'SUPER_ADMIN') {
      Promise.all([
        fetch('/api/superadmin/pharmacies').then((r) => r.json()),
        fetch('/api/superadmin/backups').then((r) => r.json()),
      ]).then(([pharmJson, backupJson]) => {
        setPharmacies(pharmJson.data || [])
        setBackups(backupJson.data || [])
        setLoading(false)
      })
    }
  }, [status, session])

  const toggleLicence = async (id: string, licenceActive: boolean) => {
    const res = await fetch(`/api/superadmin/pharmacies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenceActive: !licenceActive }),
    })
    if (res.ok) {
      setPharmacies(pharmacies.map((p) =>
        p.id === id ? { ...p, licenceActive: !licenceActive } : p
      ))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg p-8">
        <div className="max-w-6xl mx-auto">
          <PageHeader title="Super Admin" description="Gestion de toutes les pharmacies" />
          <Card padding="none" className="overflow-hidden">
            <div className="p-6">
              <SkeletonTable rows={6} cols={7} />
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app-bg p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader title="Super Admin" description="Gestion de toutes les pharmacies" />

        <div className="grid grid-cols-3 gap-6 mb-8">
          <Card>
            <p className="text-sm text-gray-500">Total pharmacies</p>
            <p className="text-3xl font-bold text-navy">{pharmacies.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Licences actives</p>
            <p className="text-3xl font-bold text-success">{pharmacies.filter((p) => p.licenceActive).length}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Licences inactives</p>
            <p className="text-3xl font-bold text-danger">{pharmacies.filter((p) => !p.licenceActive).length}</p>
          </Card>
        </div>

        <Card padding="none" className="overflow-hidden">
          {pharmacies.length === 0 ? (
            <EmptyState icon="🏥" title="Aucune pharmacie" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-app-bg border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-gray-600">Pharmacie</th>
                  <th className="text-left px-6 py-3 text-gray-600">Contact</th>
                  <th className="text-center px-6 py-3 text-gray-600">Users</th>
                  <th className="text-center px-6 py-3 text-gray-600">Medicaments</th>
                  <th className="text-center px-6 py-3 text-gray-600">Ventes</th>
                  <th className="text-center px-6 py-3 text-gray-600">Licence</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {pharmacies.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-app-bg">
                    <td className="px-6 py-4">
                      <p className="font-medium text-navy">{p.nom}</p>
                      <p className="text-gray-400 text-xs">{p.adresse || '-'}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{p.telephone || '-'}</td>
                    <td className="px-6 py-4 text-center">{p._count.users}</td>
                    <td className="px-6 py-4 text-center">{p._count.medicaments}</td>
                    <td className="px-6 py-4 text-center">{p._count.ventes}</td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={p.licenceActive ? 'success' : 'danger'}>
                        {p.licenceActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        variant={p.licenceActive ? 'danger' : 'primary'}
                        size="sm"
                        onClick={() => toggleLicence(p.id, p.licenceActive)}
                      >
                        {p.licenceActive ? 'Desactiver' : 'Activer'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* ── Tableau des sauvegardes ───────────────────────────────────────── */}
        <h2 className="text-xl font-semibold text-navy mt-10 mb-4">Sauvegardes B2</h2>
        <Card padding="none" className="overflow-hidden">
          {backups.length === 0 ? (
            <EmptyState icon="💾" title="Aucun backup enregistré" description="Le cron n'a pas encore tourné." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-app-bg border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-gray-600">Pharmacie</th>
                  <th className="text-left px-6 py-3 text-gray-600">Dernier backup réussi</th>
                  <th className="text-left px-6 py-3 text-gray-600">Taille</th>
                  <th className="text-left px-6 py-3 text-gray-600">Dernier échec</th>
                  <th className="text-center px-6 py-3 text-gray-600">Statut</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => {
                  const tailleKo = b.dernierSucces?.taille
                    ? Math.round((b.dernierSucces.taille as number) / 1024)
                    : null

                  const echecPlusRecent = b.dernierEchec && b.dernierSucces
                    ? new Date(b.dernierEchec.date) > new Date(b.dernierSucces.date)
                    : !!b.dernierEchec

                  return (
                    <tr key={b.pharmacieId} className="border-b border-gray-100 last:border-0 hover:bg-app-bg">
                      <td className="px-6 py-4 font-medium text-navy">{b.pharmacieNom}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {b.dernierSucces ? formatDateTime(b.dernierSucces.date) : '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {tailleKo !== null ? `${tailleKo} Ko` : '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {b.dernierEchec ? (
                          <span title={b.dernierEchec.erreur ?? ''} className="cursor-help">
                            {formatDateTime(b.dernierEchec.date)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {!b.dernierSucces && !b.dernierEchec ? (
                          <span className="text-gray-400 text-xs">Aucun backup</span>
                        ) : echecPlusRecent ? (
                          <Badge variant="danger">❌ Échec</Badge>
                        ) : (
                          <Badge variant="success">✅ OK</Badge>
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
    </div>
  )
}
