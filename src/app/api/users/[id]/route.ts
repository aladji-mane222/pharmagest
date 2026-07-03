import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return apiError('Acces refuse', 403)
  }

  const pharmacieId = session.user.pharmacieId

  const user = await prisma.user.findFirst({
    where: { id: params.id, pharmacieId },
  })
  if (!user) return apiError('Utilisateur non trouve', 404)

  // Empêcher de se désactiver soi-même
  if (params.id === session.user.id) {
    return apiError('Vous ne pouvez pas modifier votre propre compte ici', 400)
  }

  const body = await request.json()
  const { nom, role, actif } = body

  const data: { nom?: string; role?: any; actif?: boolean } = {}
  if (nom  !== undefined) data.nom  = nom
  if (role !== undefined) data.role = role
  if (actif !== undefined) data.actif = actif

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, nom: true, email: true, role: true, actif: true, createdAt: true },
  })

  await createAuditLog({
    action:  'USER_MODIFIE',
    details: { userId: params.id, changements: data },
    userId:  session.user.id,
    pharmacieId,
  })

  return apiSuccess(updated)
}