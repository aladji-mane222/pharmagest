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

  // Optimisation : Requêtes SQL brutes pour les calculs de stock bas (très performant)
  const [
    ventesJour,
    ventesMois,
    totalMedicaments,
    ventesRecentes,
    stockBasStats,
    peremptionsStats
  ] = await Promise.all([
    // CA du jour
    prisma.vente.aggregate({
      where: { pharmacieId, createdAt: { gte: debutJour }, statut: 'COMPLETE' },
      _sum: { montantTotal: true },
    }),
    // CA du mois
    prisma.vente.aggregate({
      where: { pharmacieId, createdAt: { gte: debutMois }, statut: 'COMPLETE' },
      _sum: { montantTotal: true },
    }),
    // Total médicaments
    prisma.medicament.count({ where: { pharmacieId, actif: true } }),
    // Ventes récentes (limité aux champs nécessaires)
    prisma.vente.findMany({
      where: { pharmacieId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        montantTotal: true,
        createdAt: true,
        user: { select: { nom: true } }
      }
    }),
    // Stock bas (SQL pour éviter de charger tous les produits en mémoire)
    prisma.$queryRaw<any[]>`
      SELECT m.id, m.nom, m."stockMinimum", COALESCE(SUM(l.quantite), 0)::int as "stockTotal"
      FROM "Medicament" m
      LEFT JOIN "Lot" l ON l."medicamentId" = m.id AND l.actif = true
      WHERE m."pharmacieId" = ${pharmacieId} AND m.actif = true
      GROUP BY m.id, m.nom, m."stockMinimum"
      HAVING COALESCE(SUM(l.quantite), 0) < m."stockMinimum"
    `,
    // Péremptions proches (SQL)
    prisma.$queryRaw<any[]>`
      SELECT l.id, l."datePeremption", m.nom as "medicamentNom"
      FROM "Lot" l
      JOIN "Medicament" m ON m.id = l."medicamentId"
      WHERE m."pharmacieId" = ${pharmacieId} AND l.actif = true
      AND l."datePeremption" <= ${dans90Jours} AND l."datePeremption" >= ${now}
      ORDER BY l."datePeremption" ASC
      LIMIT 5
    `
  ])

  return apiSuccess({
    caJour: ventesJour._sum.montantTotal ?? 0,
    caMois: ventesMois._sum.montantTotal ?? 0,
    stockBas: stockBasStats.length,
    stockBasDetails: stockBasStats.slice(0, 5).map(m => ({
      id: m.id,
      nom: m.nom,
      lots: [{ quantite: m.stockTotal }]
    })),
    peremptions: peremptionsStats.length,
    peremptionsDetails: peremptionsStats.map(l => ({
      id: l.id,
      datePeremption: l.datePeremption,
      medicament: { nom: l.medicamentNom }
    })),
    totalMedicaments,
    ventesRecentes,
  })
}
