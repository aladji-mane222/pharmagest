import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId

  const client = await prisma.client.findFirst({
    where: { id: params.id, pharmacieId },
  })
  if (!client || !client.actif) return apiError('Client non trouve', 404)
  if (client.soldeCredit <= 0) return apiError('Ce client n\'a aucun solde credit en cours', 400)

  const body = await request.json()
  const { montant, note } = body

  if (!montant) return apiError('Montant requis', 400)
  const montantFloat = parseFloat(montant)
  if (isNaN(montantFloat) || montantFloat <= 0) return apiError('Montant invalide', 400)
  if (montantFloat > client.soldeCredit) {
    return apiError(
      `Montant depasse le solde credit actuel (${client.soldeCredit} GNF)`,
      400
    )
  }

  const clientMisAJour = await prisma.$transaction(async (tx) => {
    return tx.client.update({
      where: { id: params.id },
      data: { soldeCredit: { decrement: montantFloat } },
    })
  })

  await createAuditLog({
    action: 'CREDIT_REMBOURSE',
    details: {
      clientId: params.id,
      nom: client.nom,
      montant: montantFloat,
      soldeRestant: clientMisAJour.soldeCredit,
      ...(note && { note }),
    },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess(clientMisAJour)
}
