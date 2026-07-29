import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

// GET — mes notifications recentes (50 max) + compteur non lues, pour la
// cloche dans la sidebar.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const [notifications, nonLues] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, lu: false },
    }),
  ])

  return apiSuccess({ notifications, nonLues })
}

// PATCH — marquer TOUTES mes notifications comme lues d'un coup
export async function PATCH() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  await prisma.notification.updateMany({
    where: { userId: session.user.id, lu: false },
    data: { lu: true },
  })

  return apiSuccess({ message: 'Notifications marquees comme lues' })
}
