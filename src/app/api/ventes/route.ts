import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ModePaiement, StatutVente } from '@prisma/client'
import { apiError, apiSuccess } from '@/lib/utils'
import { decrementerLotFifo } from '@/lib/fifo'
import { createAuditLog } from '@/lib/audit'

interface LigneVenteInput {
  medicamentId: string
  quantite: number
  prixUnitaire: number
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId

  const ventes = await prisma.$queryRaw<any[]>`
    SELECT 
      v.*,
      json_build_object('nom', u.nom) as user,
      CASE WHEN c.id IS NOT NULL THEN json_build_object('nom', c.nom) ELSE NULL END as client,
      (
        SELECT json_agg(l_data)
        FROM (
          SELECT l.*, json_build_object('nom', m.nom) as medicament
          FROM "LigneVente" l
          JOIN "Medicament" m ON m.id = l."medicamentId"
          WHERE l."venteId" = v.id
        ) l_data
      ) as lignes
    FROM "Vente" v
    JOIN "User" u ON u.id = v."userId"
    LEFT JOIN "Client" c ON c.id = v."clientId"
    WHERE v."pharmacieId" = ${pharmacieId}
    ORDER BY v."createdAt" DESC
    LIMIT 20
  `

  return apiSuccess(ventes)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const body = await request.json()
  const { lignes, modePaiement, montantPaye, clientId, remise = 0 } = body as {
    lignes: { medicamentId: string; quantite: number }[]
    modePaiement?: ModePaiement
    montantPaye: string
    clientId?: string
    remise?: number
  }

  if (!lignes || lignes.length === 0) return apiError('Aucun article dans la vente', 400)

  const pharmacieId = session.user.pharmacieId
  const userId = session.user.id

  // Vérifier la session caisse du caissier connecté
  const sessionCaisse = await prisma.sessionCaisse.findFirst({
    where: {
      pharmacieId,
      userId,
      dateCloture: null,
      actif: true,
    },
  })
  if (!sessionCaisse) return apiError('Aucune session caisse ouverte pour cet utilisateur', 400)

  // Récupérer tous les médicaments en une seule requête
  const medicamentIds = lignes.map((l: any) => l.medicamentId)
  const medicaments = await prisma.medicament.findMany({
    where: { id: { in: medicamentIds }, pharmacieId, actif: true },
  })
  const medicamentMap = new Map(medicaments.map(m => [m.id, m]))

  // ─── VÉRIFICATION STOCK AVANT TRANSACTION (Bug #3) ───────────────────────
  const ruptures: string[] = []
  for (const ligne of lignes) {
    const medicament = medicamentMap.get(ligne.medicamentId)
    if (!medicament) return apiError(`Medicament non trouve: ${ligne.medicamentId}`, 404)

    const agg = await prisma.lot.aggregate({
      where: { medicamentId: ligne.medicamentId, actif: true },
      _sum: { quantite: true },
    })
    const stockTotal = agg._sum.quantite ?? 0
    if (stockTotal < ligne.quantite) {
      ruptures.push(`${medicament.nom}: ${stockTotal} disponible(s), ${ligne.quantite} demande(s)`)
    }
  }
  if (ruptures.length > 0) {
    return apiError(`Stock insuffisant — ${ruptures.join(' | ')}`, 400)
  }
  // ─────────────────────────────────────────────────────────────────────────

  let sommeLignes = 0
  const lignesAvecPrix: LigneVenteInput[] = []

  for (const ligne of lignes) {
    const medicament = medicamentMap.get(ligne.medicamentId)!
    sommeLignes += medicament.prixVente * ligne.quantite
    lignesAvecPrix.push({ ...ligne, prixUnitaire: medicament.prixVente })
  }

  if (remise < 0 || remise > sommeLignes) return apiError('Remise invalide', 400)
  const montantTotal = sommeLignes - remise

  const montantPayeFloat = parseFloat(montantPaye) || montantTotal
  const statut: StatutVente = montantPayeFloat >= montantTotal ? 'COMPLETE' : 'PARTIELLE'
  const monnaie = Math.max(0, montantPayeFloat - montantTotal)
  const resteADu = Math.max(0, montantTotal - montantPayeFloat)

  // ─── VÉRIFICATION PLAFOND CRÉDIT (Session C) ──────────────────────────────
  if (clientId && resteADu > 0) {
    const clientPour = await prisma.client.findFirst({ where: { id: clientId, pharmacieId } })
    if (!clientPour) return apiError('Client introuvable', 404)
    if (clientPour.soldeCredit + resteADu > clientPour.plafondCredit) {
      return apiError(
        `Plafond credit depasse pour ${clientPour.nom} — ` +
        `solde actuel: ${clientPour.soldeCredit} GNF, ` +
        `plafond: ${clientPour.plafondCredit} GNF, ` +
        `credit demande: ${resteADu} GNF`,
        400
      )
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const vente = await prisma.$transaction(async (tx) => {
    // 1. Créer la vente
    const v = await tx.vente.create({
      data: {
        montantTotal,
        montantPaye: montantPayeFloat,
        monnaie,
        remise,
        modePaiement: modePaiement || 'ESPECES',
        statut,
        pharmacieId,
        userId,
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

    // 2. Décrémenter les lots FIFO et enregistrer les mouvements
    for (const ligne of lignesAvecPrix) {
      await decrementerLotFifo(ligne.medicamentId, pharmacieId, ligne.quantite, tx)

      await tx.mouvementStock.create({
        data: {
          type: 'SORTIE',
          quantite: ligne.quantite,
          medicamentId: ligne.medicamentId,
          userId,
        },
      })
    }

    // 3. Crédit client si nécessaire
    if (clientId && statut === 'PARTIELLE') {
      const resteADoit = montantTotal - montantPayeFloat
      await tx.client.update({
        where: { id: clientId },
        data: { soldeCredit: { increment: resteADoit } },
      })
    }

    return v
  })

  await createAuditLog({
    action: 'VENTE_EFFECTUEE',
    details: { venteId: vente.id, montantTotal, statut },
    userId,
    pharmacieId,
  })

  return apiSuccess(vente, 201)
}