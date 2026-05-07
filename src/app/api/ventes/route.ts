import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { decrementerLotFifo } from '@/lib/fifo'
import { createAuditLog } from '@/lib/audit'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const ventes = await prisma.vente.findMany({
    where: { pharmacieId: session.user.pharmacieId },
    include: {
      user: { select: { nom: true } },
      client: { select: { nom: true } },
      lignes: { include: { medicament: { select: { nom: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return apiSuccess(ventes)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const body = await request.json()
  const { lignes, modePaiement, montantPaye, clientId, sessionCaisseId } = body

  if (!lignes || lignes.length === 0) return apiError('Aucun article dans la vente', 400)

  const sessionCaisse = await prisma.sessionCaisse.findFirst({
    where: { pharmacieId: session.user.pharmacieId, statut: 'OUVERTE' },
  })
  if (!sessionCaisse) return apiError('Aucune session caisse ouverte', 400)

  let montantTotal = 0
  const lignesAvecPrix = []

  for (const ligne of lignes) {
    const medicament = await prisma.medicament.findFirst({
      where: { id: ligne.medicamentId, pharmacieId: session.user.pharmacieId, actif: true },
    })
    if (!medicament) return apiError(`Medicament non trouve: ${ligne.medicamentId}`, 404)

    const sousTotal = medicament.prixVente * ligne.quantite
    montantTotal += sousTotal
    lignesAvecPrix.push({ ...ligne, prixUnitaire: medicament.prixVente })
  }

  const montantPayeFloat = parseFloat(montantPaye) || montantTotal
  const statut = montantPayeFloat >= montantTotal ? 'COMPLETE' : 'PARTIELLE'
  const monnaie = Math.max(0, montantPayeFloat - montantTotal)

  const vente = await prisma.vente.create({
    data: {
      montantTotal,
      montantPaye: montantPayeFloat,
      monnaie,
      modePaiement: modePaiement || 'ESPECES',
      statut,
      pharmacieId: session.user.pharmacieId,
      userId: session.user.id,
      clientId: clientId || null,
      sessionCaisseId: sessionCaisse.id,
      lignes: {
        create: lignesAvecPrix.map((l) => ({
          medicamentId: l.medicamentId,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
        })),
      },
    },
    include: { lignes: true },
  })

  for (const ligne of lignesAvecPrix) {
    await decrementerLotFifo(ligne.medicamentId, session.user.pharmacieId, ligne.quantite)
    await prisma.mouvementStock.create({
      data: {
        type: 'SORTIE',
        quantite: ligne.quantite,
        medicamentId: ligne.medicamentId,
        userId: session.user.id,
      },
    })
  }

  if (clientId && statut === 'PARTIELLE') {
    const resteADoit = montantTotal - montantPayeFloat
    await prisma.client.update({
      where: { id: clientId },
      data: { soldeCredit: { increment: resteADoit } },
    })
  }

  await createAuditLog({
    action: 'VENTE_EFFECTUEE',
    details: { venteId: vente.id, montantTotal, statut },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(vente, 201)
}
