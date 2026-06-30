import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const pharmacieId = session.user.pharmacieId

  const vente = await prisma.vente.findFirst({
    where: { id: params.id, pharmacieId },
    include: {
      lignes: { include: { medicament: true } },
      client: true,
    },
  })

  if (!vente) return apiError('Vente non trouvee', 404)
  if (vente.statut === 'ANNULEE') return apiError('Vente deja annulee', 400)

  const body = await request.json().catch(() => ({}))
  const { motif } = body

  // resteADu : part mise en crédit client lors de la vente (non stocké, calculé)
  const resteADu = Math.max(0, vente.montantTotal - vente.montantPaye)

  const venteAnnulee = await prisma.$transaction(async (tx) => {
    // a. Marquer la vente annulée
    const v = await tx.vente.update({
      where: { id: params.id },
      data: { statut: 'ANNULEE' },
    })

    // b. Remise en stock pour chaque ligne
    for (const ligne of vente.lignes) {
      await tx.mouvementStock.create({
        data: {
          type: 'RETOUR',
          quantite: ligne.quantite,
          medicamentId: ligne.medicamentId,
          userId: session.user.id,
        },
      })

      // Récréditer le premier lot actif du médicament
      await tx.lot.updateMany({
        where: { medicamentId: ligne.medicamentId, actif: true },
        data: { quantite: { increment: ligne.quantite } },
      })
    }

    // c. Décrémenter le solde crédit si la vente était à crédit
    if (vente.clientId && resteADu > 0) {
      await tx.client.update({
        where: { id: vente.clientId },
        data: { soldeCredit: { decrement: resteADu } },
      })
    }

    return v
  })

  await createAuditLog({
    action: 'VENTE_ANNULEE',
    details: {
      venteId: params.id,
      lignes: vente.lignes.length,
      montantTotal: vente.montantTotal,
      ...(motif && { motif }),
    },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess(venteAnnulee)
}
