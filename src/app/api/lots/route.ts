import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const body = await request.json()
  const { medicamentId, numeroLot, datePeremption, quantite } = body

  if (!medicamentId || !datePeremption || !quantite) {
    return apiError('Champs obligatoires manquants', 400)
  }

  const medicament = await prisma.medicament.findFirst({
    where: { id: medicamentId, pharmacieId: session.user.pharmacieId },
  })
  if (!medicament) return apiError('Medicament non trouve', 404)

  const lot = await prisma.lot.create({
    data: {
      medicamentId,
      numeroLot: numeroLot || null,
      datePeremption: new Date(datePeremption),
      quantite: parseInt(quantite),
    },
  })

  await createAuditLog({
    action: 'LOT_CREE',
    details: { lotId: lot.id, medicamentId, quantite },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(lot, 201)
}
