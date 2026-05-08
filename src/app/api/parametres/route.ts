import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacie = await prisma.pharmacie.findUnique({
    where: { id: session.user.pharmacieId },
    select: { id: true, nom: true, adresse: true, telephone: true, email: true },
  })

  return apiSuccess(pharmacie)
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const body = await request.json()
  const { nom, adresse, telephone, email } = body

  const pharmacie = await prisma.pharmacie.update({
    where: { id: session.user.pharmacieId },
    data: {
      ...(nom && { nom }),
      ...(adresse !== undefined && { adresse }),
      ...(telephone !== undefined && { telephone }),
      ...(email !== undefined && { email }),
    },
  })

  return apiSuccess(pharmacie)
}
