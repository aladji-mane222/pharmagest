import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId

  // Optimisation SQL : Calculs de stock directement en base pour éviter les allers-retours
  const stock = await prisma.$queryRaw<any[]>`
    SELECT 
      m.*,
      COALESCE(SUM(l.quantite), 0)::int as "stockTotal",
      COUNT(l.id) FILTER (WHERE l."datePeremption" <= (CURRENT_DATE + INTERVAL '90 days'))::int as "lotsCritiques"
    FROM "Medicament" m
    LEFT JOIN "Lot" l ON l."medicamentId" = m.id AND l.actif = true
    WHERE m."pharmacieId" = ${pharmacieId} AND m.actif = true
    GROUP BY m.id
    ORDER BY m.nom ASC
  `

  const stockFormatte = stock.map(med => ({
    ...med,
    stockBas: med.stockTotal < med.stockMinimum
  }))

  const valeurTotale = stockFormatte.reduce((sum, med) => sum + (med.stockTotal * (med.prixAchat || 0)), 0)

  return apiSuccess({ stock: stockFormatte, valeurTotale })
}
