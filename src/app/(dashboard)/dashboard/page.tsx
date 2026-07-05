import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatMontant, formatDateTime } from '@/lib/utils'
import DashboardClient from '@/components/dashboard/DashboardClient'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const pharmacieId = session.user.pharmacieId
  const now = new Date()
  const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1)
  const dans90Jours = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const [
    ventesJour,
    ventesMois,
    ventesRecentes,
    medicamentsAvecStock,
    peremptionsRaw,
  ] = await Promise.all([
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

      {/* ── En-tête + raccourcis rapides ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tableau de bord</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/ventes"
            className="bg-green-600 text-white rounded-lg px-3 py-1 text-sm hover:bg-green-700 transition-colors"
          >
            + Nouvelle vente
          </Link>
          <Link
            href="/caisse"
            className="bg-green-600 text-white rounded-lg px-3 py-1 text-sm hover:bg-green-700 transition-colors"
          >
            Ma caisse
          </Link>
          <Link
            href="/depenses"
            className="bg-green-600 text-white rounded-lg px-3 py-1 text-sm hover:bg-green-700 transition-colors"
          >
            Saisir dépense
          </Link>
        </div>
      </div>

      <DashboardClient initialData={initialData} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-8">

        {/* ── Alertes stock bas ── */}
        <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              ⚠️ Alertes Stock Bas
            </h2>
            <Link href="/stock" className="text-xs text-green-600 hover:underline">
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
                    className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <span className="text-gray-700 font-medium">{med.nom}</span>
                    <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded font-bold text-xs">
                      {med.stockTotal} unités
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Péremptions proches ── */}
        <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              📅 Péremptions proches
            </h2>
            <Link href="/stock" className="text-xs text-green-600 hover:underline">
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
                    className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <span className="text-gray-700 font-medium">{lot.medicament.nom}</span>
                    <span
                      className={`px-2 py-1 rounded font-bold text-xs ${
                        urgent
                          ? 'bg-red-100 text-red-600'
                          : 'bg-orange-100 text-orange-600'
                      }`}
                    >
                      J-{jours}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Ventes récentes ── */}
      <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">🛒 Ventes récentes</h2>
          <Link href="/ventes/historique" className="text-xs text-green-600 hover:underline">
            Voir tout →
          </Link>
        </div>
        {ventesRecentes.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucune vente pour le moment</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
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
                    className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 text-gray-600">{formatDateTime(vente.createdAt)}</td>
                    <td className="py-3 text-gray-600">{vente.user.nom}</td>
                    <td className="py-3 text-right font-bold text-green-600">
                      {formatMontant(vente.montantTotal)}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/ventes/${vente.id}`}
                        className="text-xs text-green-600 hover:underline whitespace-nowrap"
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
      </div>

    </div>
  )
}
