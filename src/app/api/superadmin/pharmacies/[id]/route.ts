import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role !== 'SUPER_ADMIN') return apiError('Acces refuse', 403)

  const body = await request.json()
  const { licenceActive, licenceExpire } = body

  const pharmacie = await prisma.pharmacie.update({
    where: { id: params.id },
    data: {
      ...(licenceActive !== undefined && { licenceActive }),
      ...(licenceExpire && { licenceExpire: new Date(licenceExpire) }),
    },
  })

  return apiSuccess(pharmacie)
}
