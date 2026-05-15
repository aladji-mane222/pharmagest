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

  // Optimisation : Une seule requête avec JOIN et JSON_AGG pour éviter 5 allers-retours réseau
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
  const { lignes, modePaiement, montantPaye, clientId } = body as {
    lignes: { medicamentId: string; quantite: number }[]
    modePaiement?: ModePaiement
    montantPaye: string
    clientId?: string
  }

  if (!lignes || lignes.length === 0) return apiError('Aucun article dans la vente', 400)

  // Optimisation : Vérifier la session caisse selon logique v2.4 (actif + dateCloture null)
  const sessionCaisse = await prisma.sessionCaisse.findFirst({
    where: {
      pharmacieId: session.user.pharmacieId,
      userId: session.user.id,
      dateCloture: null,
      actif: true
    },
  })
  if (!sessionCaisse) return apiError('Aucune session caisse ouverte pour cet utilisateur', 400)

  // Optimisation : Récupérer tous les médicaments d'un coup (évite N+1)
  const medicamentIds = lignes.map((l: any) => l.medicamentId)
  const medicaments = await prisma.medicament.findMany({
    where: { id: { in: medicamentIds }, pharmacieId: session.user.pharmacieId, actif: true }
  })
  const medicamentMap = new Map(medicaments.map(m => [m.id, m]))

  let montantTotal = 0
  const lignesAvecPrix: LigneVenteInput[] = []

  for (const ligne of lignes) {
    const medicament = medicamentMap.get(ligne.medicamentId)
    if (!medicament) return apiError(`Medicament non trouve: ${ligne.medicamentId}`, 404)

    const sousTotal = medicament.prixVente * ligne.quantite
    montantTotal += sousTotal
    lignesAvecPrix.push({ ...ligne, prixUnitaire: medicament.prixVente })
  }

  const montantPayeFloat = parseFloat(montantPaye) || montantTotal
  const statut: StatutVente = montantPayeFloat >= montantTotal ? 'COMPLETE' : 'PARTIELLE'
  const monnaie = Math.max(0, montantPayeFloat - montantTotal)

  // Utilisation d'une transaction Prisma pour garantir l'intégrité et la performance
  const vente = await prisma.$transaction(async (tx) => {
    // 1. Créer la vente
    const v = await tx.vente.create({
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

    // 2. Décrémenter les lots et enregistrer les mouvements
    for (const ligne of lignesAvecPrix) {
      // Note: decrementerLotFifo doit idéalement accepter le client Prisma tx
      // On le laisse tel quel s'il gère sa propre transaction ou on l'adapte
      await decrementerLotFifo(ligne.medicamentId, session.user.pharmacieId, ligne.quantite, tx)

      await tx.mouvementStock.create({
        data: {
          type: 'SORTIE',
          quantite: ligne.quantite,
          medicamentId: ligne.medicamentId,
          userId: session.user.id,
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
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(vente, 201)
}
