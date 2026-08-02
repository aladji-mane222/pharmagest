import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

// GET — mes notifications, pour la cloche (appel simple, 50 max, comme
// avant) ET pour la page /notifications complete (avec pagination et
// filtre via ?page=&limite=&filtre=non_lues|lues). Sans parametres,
// comportement identique a avant (retro-compatible avec la cloche).
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limite = Math.min(100, parseInt(searchParams.get('limite') || '50', 10) || 50)
  const filtre = searchParams.get('filtre') // 'non_lues' | 'lues' | null

  const where = {
    userId: session.user.id,
    ...(filtre === 'non_lues' && { lu: false }),
    ...(filtre === 'lues' && { lu: true }),
  }

  const [notifications, nonLues, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limite,
      skip: (page - 1) * limite,
    }),
    prisma.notification.count({ where: { userId: session.user.id, lu: false } }),
    prisma.notification.count({ where }),
  ])

  return apiSuccess({ notifications, nonLues, total, totalPages: Math.max(1, Math.ceil(total / limite)) })
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

// DELETE — supprimer plusieurs notifications d'un coup : ?portee=lues
// (toutes les lues) ou ?portee=tout (absolument toutes). Utilise par la
// page /notifications ("Supprimer les lues" / "Tout supprimer").
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const { searchParams } = new URL(request.url)
  const portee = searchParams.get('portee')
  if (portee !== 'lues' && portee !== 'tout') {
    return apiError('Parametre "portee" requis : "lues" ou "tout"', 400)
  }

  const { count } = await prisma.notification.deleteMany({
    where: { userId: session.user.id, ...(portee === 'lues' && { lu: true }) },
  })

  return apiSuccess({ message: `${count} notification(s) supprimee(s)` })
}
