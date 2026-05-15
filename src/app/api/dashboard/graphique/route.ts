import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  // Optimisation : Une seule requête pour les 7 derniers jours
  const stats = await prisma.$queryRaw<any[]>`
    SELECT 
      DATE_TRUNC('day', "createdAt") as date,
      COALESCE(SUM("montantTotal"), 0) as ca,
      COUNT(*)::int as ventes
    FROM "Vente"
    WHERE "pharmacieId" = ${pharmacieId} 
    AND "createdAt" >= ${sevenDaysAgo}
    AND "statut" = 'COMPLETE'
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY date ASC
  `

  // Mapper les résultats pour s'assurer que tous les jours sont présents même s'il n'y a pas de vente
  const result = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    
    const dayStats = stats.find(s => 
      new Date(s.date).toISOString().split('T')[0] === dateStr
    )

    return {
      date: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      ca: dayStats ? Number(dayStats.ca) : 0,
      ventes: dayStats ? Number(dayStats.ventes) : 0,
    }
  })

  return apiSuccess(result)
}
