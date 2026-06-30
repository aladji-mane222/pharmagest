import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const vente = await prisma.vente.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
    include: {
      lignes: { include: { medicament: true } },
      client: true,
      user: { select: { nom: true } },
    },
  })

  if (!vente) return apiError('Vente non trouvee', 404)

  return apiSuccess(vente)
}
