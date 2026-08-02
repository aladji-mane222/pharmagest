import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

// PATCH — marquer une notification comme lue OU non lue (bascule). Sans
// corps de requete = marquer comme lue (comportement historique, utilise
// par la cloche). Avec { lu: false } = remarquer comme non lue (utilise
// par la page /notifications complete).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const notif = await prisma.notification.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!notif) return apiError('Notification non trouvee', 404)

  const body = await request.json().catch(() => ({}))
  const lu = typeof body.lu === 'boolean' ? body.lu : true

  const updated = await prisma.notification.update({
    where: { id: params.id },
    data: { lu },
  })

  return apiSuccess(updated)
}

// DELETE — supprimer une notification precise
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const notif = await prisma.notification.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!notif) return apiError('Notification non trouvee', 404)

  await prisma.notification.delete({ where: { id: params.id } })

  return apiSuccess({ message: 'Notification supprimee' })
}
