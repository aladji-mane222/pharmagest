import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

// PATCH — marquer UNE notification comme lue (au clic dessus)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const notif = await prisma.notification.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!notif) return apiError('Notification non trouvee', 404)

  const updated = await prisma.notification.update({
    where: { id: params.id },
    data: { lu: true },
  })

  return apiSuccess(updated)
}
