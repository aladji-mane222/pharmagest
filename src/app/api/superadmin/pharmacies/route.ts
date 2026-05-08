import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role !== 'SUPER_ADMIN') return apiError('Acces refuse', 403)

  const pharmacies = await prisma.pharmacie.findMany({
    include: {
      _count: { select: { users: true, medicaments: true, ventes: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return apiSuccess(pharmacies)
}
