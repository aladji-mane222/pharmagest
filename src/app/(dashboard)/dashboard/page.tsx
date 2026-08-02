import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatMontant, formatDateTime } from '@/lib/utils'
import DashboardClient from '@/components/dashboard/DashboardClient'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, PageHeader, Button, Badge, EmptyState } from '@/components/ui'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const pharmacieId = session.user.pharmacieId
  const now = new Date()
  const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1)
  const dans90Jours = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  let ventesJour, ventesMois, ventesRecentes, medicamentsAvecStock, peremptionsRaw

  try {
    ;[ventesJour, ventesMois, ventesRecentes, medicamentsAvecStock, peremptionsRaw] = await Promise.all([
      prisma.vente.aggregate({
        where: { pharmacieId, createdAt: { gte: debutJour }, statut: 'COMPLETE' },
        _sum: { montantTotal: true },
      }),
      prisma.vente.aggregate({
        where: { pharmacieId, createdAt: { gte: debutMois }, statut: 'COMPLETE' },
        _sum: { montantTotal: true },
      }),
      prisma.vente.findMany({
        where: { pharmacieId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          montantTotal: true,
          createdAt: true,
          user: { select: { nom: true } },
        },
      }),
      prisma.medicament.findMany({
        where: { pharmacieId, actif: true },
        select: {
          id: true,
          nom: true,
          stockMinimum: true,
          lots: { where: { actif: true }, select: { quantite: true } },
        },
      }),
      prisma.lot.findMany({
        where: {
          actif: true,
          datePeremption: { lte: dans90Jours, gte: now },
          medicament: { pharmacieId },
        },
        include: { medicament: { select: { nom: true } } },
        orderBy: { datePeremption: 'asc' },
        take: 5,
      }),
    ])
  } catch (error) {
    // La base peut devenir injoignable a tout moment (coupures reseau
    // documentees, cote Guinee comme cote Supabase) — le tableau de bord
    // est la toute premiere page vue par la pharmacienne, elle ne doit
    // jamais planter avec un ecran d'erreur technique illisible.
    console.error('[dashboard] Base injoignable :', error)
    return (
      <div className="p-8">
        <Card className="text-center max-w-md mx-auto mt-12">
          <p className="text-3xl mb-3">📡</p>
          <h1 className="text-lg font-semibold text-navy mb-2">Connexion impossible</h1>
          <p className="text-gray-500 text-sm mb-6">
            Impossible de joindre le serveur pour le moment. Vérifie ta connexion internet,
            puis réessaie dans quelques instants.
          </p>
          <a
            href="/dashboard"
            className="inline-block bg-mint text-navy dark:text-[#0D2847] rounded-card px-4 py-2 text-sm font-medium hover:bg-mint-dark hover:text-white transition-colors"
          >
            Réessayer
          </a>
        </Card>
      </div>
    )
  }

  const stockBasList = medicamentsAvecStock
    .map(m => ({ ...m, stockTotal: m.lots.reduce((s, l) => s + l.quantite, 0) }))
    .filter(m => m.stockTotal < m.stockMinimum)

  const initialData = {
    caJour: ventesJour._sum.montantTotal ?? 0,
    caMois: ventesMois._sum.montantTotal ?? 0,
    stockBas: stockBasList.length,
    peremptions: peremptionsRaw.length,
  }

  return (
    <div className="p-8">

      <PageHeader
        title="Tableau de bord"
        actions={
          <>
            <Link href="/ventes"><Button variant="primary" size="sm">+ Nouvelle vente</Button></Link>
            <Link href="/caisse"><Button variant="primary" size="sm">Ma caisse</Button></Link>
            <Link href="/depenses"><Button variant="primary" size="sm">Saisir dépense</Button></Link>
          </>
        }
      />

      <DashboardClient initialData={initialData} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-8">

        {/* ── Alertes stock bas ── */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-navy flex items-center gap-2">
              ⚠️ Alertes Stock Bas
            </h2>
            <Link href="/stock" className="text-xs text-mint-dark hover:underline">
              Voir tout →
            </Link>
          </div>
          {stockBasList.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune alerte</p>
          ) : (
            <ul className="space-y-2">
              {stockBasList.slice(0, 5).map((med) => (
                <li key={med.id}>
                  <Link
                    href={`/medicaments/${med.id}`}
                    className="flex justify-between items-center text-sm p-2 hover:bg-app-bg rounded-card transition-colors"
                  >
                    <span className="text-navy font-medium">{med.nom}</span>
                    <Badge variant="warning">{med.stockTotal} unités</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Péremptions proches ── */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-navy flex items-center gap-2">
              📅 Péremptions proches
            </h2>
            <Link href="/stock" className="text-xs text-mint-dark hover:underline">
              Voir tout →
            </Link>
          </div>
          {peremptionsRaw.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune alerte</p>
          ) : (
            <ul className="space-y-2">
              {peremptionsRaw.map((lot) => {
                const jours = Math.ceil(
                  (new Date(lot.datePeremption).getTime() - now.getTime()) / 86400000
                )
                const urgent = jours <= 30
                return (
                  <li
                    key={lot.id}
                    className="flex justify-between items-center text-sm p-2 hover:bg-app-bg rounded-card transition-colors"
                  >
                    <span className="text-navy font-medium">{lot.medicament.nom}</span>
                    <Badge variant={urgent ? 'danger' : 'warning'}>J-{jours}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Ventes récentes ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-navy">🛒 Ventes récentes</h2>
          <Link href="/ventes/historique" className="text-xs text-mint-dark hover:underline">
            Voir tout →
          </Link>
        </div>
        {ventesRecentes.length === 0 ? (
          <EmptyState icon="🛒" title="Aucune vente pour le moment" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold">Caissier</th>
                  <th className="pb-3 text-right font-semibold">Montant</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {ventesRecentes.map((vente) => (
                  <tr
                    key={vente.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-app-bg transition-colors"
                  >
                    <td className="py-3 text-gray-600">{formatDateTime(vente.createdAt)}</td>
                    <td className="py-3 text-gray-600">{vente.user.nom}</td>
                    <td className="py-3 text-right font-bold text-success">
                      {formatMontant(vente.montantTotal)}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/ventes/${vente.id}`}
                        className="text-xs text-mint-dark hover:underline whitespace-nowrap"
                      >
                        Voir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  )
}
