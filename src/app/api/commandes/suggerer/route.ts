import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId

  // Calcul du stockTotal en base via agrégation SQL pour éviter N+1
  // HAVING filtre directement les médicaments sous seuil
  const resultats = await prisma.$queryRaw<{
    medicamentId: string
    nom: string
    stockMinimum: number
    stockActuel: number
  }[]>`
    SELECT
      m.id          AS "medicamentId",
      m.nom,
      m."stockMinimum",
      COALESCE(SUM(l.quantite), 0)::int AS "stockActuel"
    FROM "Medicament" m
    LEFT JOIN "Lot" l ON l."medicamentId" = m.id AND l.actif = true
    WHERE m."pharmacieId" = ${pharmacieId}
      AND m.actif = true
    GROUP BY m.id, m.nom, m."stockMinimum"
    HAVING COALESCE(SUM(l.quantite), 0) < m."stockMinimum"
    ORDER BY COALESCE(SUM(l.quantite), 0) ASC
  `

  // Formule plan Session E : Math.max(stockMinimum * 2 - stockActuel, stockMinimum)
  const suggestions = resultats.map((m) => ({
    medicamentId:     m.medicamentId,
    nom:              m.nom,
    stockActuel:      m.stockActuel,
    stockMinimum:     m.stockMinimum,
    quantiteSuggeree: Math.max(m.stockMinimum * 2 - m.stockActuel, m.stockMinimum),
  }))

  return apiSuccess(suggestions)
}
