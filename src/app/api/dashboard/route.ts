import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const now = new Date()
  const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1)
  const dans90Jours = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const [
    ventesJour,
    ventesMois,
    totalMedicaments,
    ventesRecentes,
    medicamentsAvecStock,
    peremptionsStats,
  ] = await Promise.all([
    prisma.vente.aggregate({
      where: { pharmacieId, createdAt: { gte: debutJour }, statut: 'COMPLETE' },
      _sum: { montantTotal: true },
    }),
    prisma.vente.aggregate({
      where: { pharmacieId, createdAt: { gte: debutMois }, statut: 'COMPLETE' },
      _sum: { montantTotal: true },
    }),
    prisma.medicament.count({ where: { pharmacieId, actif: true } }),
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

  const stockBasStats = medicamentsAvecStock
    .map(m => ({ ...m, stockTotal: m.lots.reduce((s, l) => s + l.quantite, 0) }))
    .filter(m => m.stockTotal < m.stockMinimum)

  return apiSuccess({
    caJour: ventesJour._sum.montantTotal ?? 0,
    caMois: ventesMois._sum.montantTotal ?? 0,
    stockBas: stockBasStats.length,
    stockBasDetails: stockBasStats.slice(0, 5).map(m => ({
      id: m.id,
      nom: m.nom,
      lots: [{ quantite: m.stockTotal }],
    })),
    peremptions: peremptionsStats.length,
    peremptionsDetails: peremptionsStats.map(l => ({
      id: l.id,
      datePeremption: l.datePeremption,
      medicament: { nom: l.medicament.nom },
    })),
    totalMedicaments,
    ventesRecentes,
  })
}
