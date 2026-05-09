import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const commande = await prisma.commandeFournisseur.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
    include: {
      fournisseur: true,
      lignes: true,
    },
  })

  if (!commande) return apiError('Commande non trouvee', 404)
  return apiSuccess(commande)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const commande = await prisma.commandeFournisseur.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
    include: { lignes: true },
  })
  if (!commande) return apiError('Commande non trouvee', 404)

  const body = await request.json()
  const { statut } = body

  if (statut === 'RECUE') {
    for (const ligne of commande.lignes) {
      await prisma.lot.create({
        data: {
          medicamentId: ligne.id,
          quantite: ligne.quantite,
          datePeremption: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      })
    }
  }

  const updated = await prisma.commandeFournisseur.update({
    where: { id: params.id },
    data: { statut },
  })

  await createAuditLog({
    action: 'COMMANDE_STATUT_CHANGE',
    details: { commandeId: params.id, statut },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(updated)
}
