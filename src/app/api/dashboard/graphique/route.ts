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

  const ventes = await prisma.vente.findMany({
    where: {
      pharmacieId,
      createdAt: { gte: sevenDaysAgo },
      statut: 'COMPLETE',
    },
    select: { montantTotal: true, createdAt: true },
  })

  const result = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]

    const dayVentes = ventes.filter(v =>
      v.createdAt.toISOString().split('T')[0] === dateStr
    )

    return {
      date: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      ca: dayVentes.reduce((sum, v) => sum + v.montantTotal, 0),
      ventes: dayVentes.length,
    }
  })

  return apiSuccess(result)
}
