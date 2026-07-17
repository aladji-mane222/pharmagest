// CIBLE: src/app/api/clients/[id]/rembourser/route.ts
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
  const { montant, modePaiement, note } = body

  if (!montant) return apiError('Montant requis', 400)
  const montantFloat = parseFloat(montant)
  if (isNaN(montantFloat) || montantFloat <= 0) return apiError('Montant invalide', 400)
  if (montantFloat > client.soldeCredit) {
    return apiError(
      `Montant depasse le solde credit actuel (${client.soldeCredit} GNF)`,
      400
    )
  }

  const MODES_VALIDES = ['ESPECES', 'MOBILE_MONEY', 'CARTE', 'ORANGE_MONEY', 'MTN_MONEY', 'PAIEMENT_MARCHAND']
  if (!modePaiement || !MODES_VALIDES.includes(modePaiement)) {
    return apiError('Mode de paiement requis', 400)
  }

  // L'argent en especes entre physiquement dans le tiroir — il doit pouvoir
  // etre compte dans une session de caisse, sinon il fausse silencieusement
  // le "total attendu" a la prochaine cloture. Les autres modes (mobile
  // money, carte) ne passent jamais par le tiroir, donc pas d'obligation.
  const sessionCaisse = await prisma.sessionCaisse.findFirst({
    where: { pharmacieId, userId: session.user.id, dateCloture: null, actif: true },
  })
  if (modePaiement === 'ESPECES' && !sessionCaisse) {
    return apiError(
      'Un remboursement en especes necessite une session caisse ouverte, pour que cet argent soit compte a la cloture',
      400
    )
  }

  const clientMisAJour = await prisma.$transaction(async (tx) => {
    await tx.remboursementCredit.create({
      data: {
        clientId: params.id,
        montant: montantFloat,
        modePaiement,
        userId: session.user.id,
        pharmacieId,
        sessionCaisseId: sessionCaisse?.id || null,
        note: note || null,
      },
    })
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
      modePaiement,
      soldeRestant: clientMisAJour.soldeCredit,
      ...(note && { note }),
    },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess(clientMisAJour)
}