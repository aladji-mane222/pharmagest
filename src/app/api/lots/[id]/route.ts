import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const lot = await prisma.lot.findFirst({
    where: { id: params.id, medicament: { pharmacieId: session.user.pharmacieId } },
  })
  if (!lot) return apiError('Lot non trouve', 404)

  const body = await request.json()
  const { quantite, datePeremption, numeroLot } = body

  const nouvelleQuantite = quantite !== undefined ? parseInt(quantite) : lot.quantite

  const updated = await prisma.lot.update({
    where: { id: params.id },
    data: {
      ...(numeroLot !== undefined && { numeroLot }),
      ...(datePeremption && { datePeremption: new Date(datePeremption) }),
      quantite: nouvelleQuantite,
      actif: nouvelleQuantite > 0,
    },
  })

  await createAuditLog({
    action: 'LOT_MODIFIE',
    details: { lotId: params.id, quantite: nouvelleQuantite },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(updated)
}
