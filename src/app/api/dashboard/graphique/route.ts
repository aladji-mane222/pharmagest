import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const now = new Date()

  const jours = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (6 - i))
    return date
  })

  const donnees = await Promise.all(
    jours.map(async (jour) => {
      const debut = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate())
      const fin = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate() + 1)

      const result = await prisma.vente.aggregate({
        where: {
          pharmacieId,
          createdAt: { gte: debut, lt: fin },
          statut: 'COMPLETE',
        },
        _sum: { montantTotal: true },
        _count: true,
      })

      return {
        date: jour.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        ca: result._sum.montantTotal ?? 0,
        ventes: result._count,
      }
    })
  )

  return apiSuccess(donnees)
}
