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
    stockBas,
    peremptions,
    totalMedicaments,
    ventesRecentes,
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
    // Stock bas
    prisma.medicament.findMany({
      where: { pharmacieId, actif: true },
      include: { lots: { where: { actif: true } } },
    }),
    // Péremptions dans 90 jours
    prisma.lot.findMany({
      where: {
        actif: true,
        datePeremption: { lte: dans90Jours, gte: now },
        medicament: { pharmacieId },
      },
      include: { medicament: true },
    }),
    // Total médicaments
    prisma.medicament.count({ where: { pharmacieId, actif: true } }),
    // Ventes récentes
    prisma.vente.findMany({
      where: { pharmacieId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { user: true, lignes: true },
    }),
  ])

  // Calculer stock bas
  const medicamentsStockBas = stockBas.filter((med) => {
    const stockTotal = med.lots.reduce((sum, lot) => sum + lot.quantite, 0)
    return stockTotal < med.stockMinimum
  })

  const response = apiSuccess({
    caJour: ventesJour._sum.montantTotal ?? 0,
    caMois: ventesMois._sum.montantTotal ?? 0,
    stockBas: medicamentsStockBas.length,
    stockBasDetails: medicamentsStockBas.slice(0, 5),
    peremptions: peremptions.length,
    peremptionsDetails: peremptions.slice(0, 5),
    totalMedicaments,
    ventesRecentes,
  })
  response.headers.set('Cache-Control', 'private, max-age=60')
  return response
}
