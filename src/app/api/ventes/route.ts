import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, ModePaiement } from '@prisma/client'
import { apiError, apiSuccess } from '@/lib/utils'
import { decrementerLotFifo } from '@/lib/fifo'
import { createAuditLog } from '@/lib/audit'
import { genererNumeroFacture } from '@/lib/numerotation'

interface LigneVenteInput {
  medicamentId: string
  quantite: number
  prixUnitaire: number
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const { searchParams } = new URL(request.url)

  const page      = Math.max(1, parseInt(searchParams.get('page')   || '1'))
  const limite    = Math.max(1, Math.min(100, parseInt(searchParams.get('limite') || '20')))
  const statut    = searchParams.get('statut')    || ''
  const dateDebut = searchParams.get('dateDebut') || ''
  const dateFin   = searchParams.get('dateFin')   || ''

  // Mode agrégat pour la caisse : retourner le total encaissé d'une session
  const sessionCaisseId = searchParams.get('sessionCaisseId') || ''
  if (sessionCaisseId) {
    const agg = await prisma.vente.aggregate({
      where: { sessionCaisseId, pharmacieId, statut: 'COMPLETE' },
      _sum: { montantPaye: true },
      _count: true,
    })

    // Repartition par mode : lit PaiementVente (source de verite pour les
    // paiements mixtes), pas Vente.modePaiement qui n'est qu'un resume.
    // Une vente entierement a credit n'a aucune ligne PaiementVente donc
    // n'apparait pas ici — normal, rien n'a ete encaisse dans le tiroir.
    const parModeRaw = await prisma.paiementVente.groupBy({
      by: ['modePaiement'],
      where: { vente: { sessionCaisseId, pharmacieId, statut: 'COMPLETE' } },
      _sum: { montant: true },
    })

    return apiSuccess({
      totalEncaisse: agg._sum.montantPaye ?? 0,
      nbVentes: agg._count,
      parMode: parModeRaw.map((m) => ({
        modePaiement: m.modePaiement,
        total: m._sum.montant ?? 0,
      })),
    })
  }

  const conditions: Prisma.Sql[] = [
    Prisma.sql`v."pharmacieId" = ${pharmacieId}`,
  ]

  if (session.user.role === 'CAISSIER') {
    conditions.push(Prisma.sql`v."userId" = ${session.user.id}`)
  }

  if (statut) {
    conditions.push(Prisma.sql`v.statut = ${statut}::"StatutVente"`)
  }
  if (dateDebut) {
    conditions.push(Prisma.sql`v."createdAt" >= ${new Date(dateDebut)}`)
  }
  if (dateFin) {
    const fin = new Date(dateFin)
    fin.setUTCHours(23, 59, 59, 999)
    conditions.push(Prisma.sql`v."createdAt" <= ${fin}`)
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
  const offset      = (page - 1) * limite

  const [ventes, countResult] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT
        v.id, v."montantTotal", v."montantPaye", v.monnaie, v.remise,
        v."modePaiement", v.statut, v."createdAt",
        json_build_object('nom', u.nom) as user,
        CASE WHEN c.id IS NOT NULL
          THEN json_build_object('id', c.id, 'nom', c.nom)
          ELSE NULL
        END as client,
        COALESCE(
          (SELECT json_agg(json_build_object('modePaiement', pv."modePaiement", 'montant', pv.montant))
           FROM "PaiementVente" pv WHERE pv."venteId" = v.id),
          '[]'
        ) as paiements
      FROM "Vente" v
      JOIN "User" u ON u.id = v."userId"
      LEFT JOIN "Client" c ON c.id = v."clientId"
      ${whereClause}
      ORDER BY v."createdAt" DESC
      LIMIT ${limite} OFFSET ${offset}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM "Vente" v
      ${whereClause}
    `,
  ])

  const total      = Number(countResult[0]?.count ?? 0)
  const totalPages = Math.ceil(total / limite)

  return apiSuccess({ ventes, total, page, totalPages })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const body = await request.json()
  const { lignes, paiements, clientId, remise = 0 } = body as {
    lignes: { medicamentId: string; quantite: number }[]
    paiements?: { modePaiement: string; montant: number }[]
    clientId?: string
    remise?: number
  }

  if (!lignes || lignes.length === 0) return apiError('Aucun article dans la vente', 400)

  // paiements peut etre vide (vente entierement a credit, comme avant).
  // CREDIT n'est jamais une ligne de paiement — c'est toujours la part
  // implicite non couverte par les lignes reellement encaissees.
  const MODES_VALIDES = ['ESPECES', 'MOBILE_MONEY', 'CARTE', 'ORANGE_MONEY', 'MTN_MONEY', 'PAIEMENT_MARCHAND']
  const lignesPaiement = paiements || []
  for (const p of lignesPaiement) {
    if (!MODES_VALIDES.includes(p.modePaiement)) {
      return apiError(`Mode de paiement invalide: ${p.modePaiement}`, 400)
    }
    if (!(p.montant > 0)) {
      return apiError('Chaque ligne de paiement doit avoir un montant superieur a 0', 400)
    }
  }

  const pharmacieId = session.user.pharmacieId
  const userId = session.user.id

  // Vérifier la session caisse du caissier connecté
  const sessionCaisse = await prisma.sessionCaisse.findFirst({
    where: { pharmacieId, userId, dateCloture: null, actif: true },
  })
  if (!sessionCaisse) return apiError('Aucune session caisse ouverte pour cet utilisateur', 400)

  // Récupérer tous les médicaments en une seule requête
  const medicamentIds = lignes.map((l: any) => l.medicamentId)
  const medicaments = await prisma.medicament.findMany({
    where: { id: { in: medicamentIds }, pharmacieId, actif: true },
  })
  const medicamentMap = new Map(medicaments.map(m => [m.id, m]))

  // Vérification stock avant transaction (Bug #3)
  const ruptures: string[] = []
  const medicamentsEnRupture: { medicamentId: string; nom: string; disponible: number; demande: number }[] = []
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
      medicamentsEnRupture.push({
        medicamentId: ligne.medicamentId,
        nom: medicament.nom,
        disponible: stockTotal,
        demande: ligne.quantite,
      })
    }
  }
  if (ruptures.length > 0) {
    return apiError(`Stock insuffisant — ${ruptures.join(' | ')}`, 400, { medicamentsEnRupture })
  }

  let sommeLignes = 0
  const lignesAvecPrix: LigneVenteInput[] = []

  for (const ligne of lignes) {
    const medicament = medicamentMap.get(ligne.medicamentId)!
    sommeLignes += medicament.prixVente * ligne.quantite
    lignesAvecPrix.push({ ...ligne, prixUnitaire: medicament.prixVente })
  }

  if (remise < 0 || remise > sommeLignes) return apiError('Remise invalide', 400)
  const montantTotal = sommeLignes - remise

  // BUG CRITIQUE corrigé le 04/07/2026 : l'ancien code faisait
  // `parseFloat(montantPaye) || montantTotal`. Or en JavaScript, 0 est une
  // valeur "falsy" — donc une vente à crédit total (le POS envoie
  // volontairement montantPaye: "0") se voyait silencieusement traitée
  // comme entièrement payée. Conséquence réelle observée : le plafond de
  // crédit n'était jamais vérifié et le solde crédit du client n'était
  // jamais incrémenté pour TOUTE vente à crédit total depuis l'origine.
  const montantPayeFloat = lignesPaiement.reduce((acc, p) => acc + p.montant, 0)

  // Un trop-percu ne peut etre rendu qu'en especes (impossible de "rendre
  // la monnaie" sur un paiement mobile money/carte deja transfere). Donc la
  // part non-especes ne doit jamais depasser le total a payer — sinon
  // c'est une saisie a corriger, pas un exces normal.
  const montantNonEspeces = lignesPaiement
    .filter((p) => p.modePaiement !== 'ESPECES')
    .reduce((acc, p) => acc + p.montant, 0)
  if (montantNonEspeces > montantTotal) {
    return apiError(
      'Le montant paye en mobile money/carte depasse le total de la vente — ' +
      'un trop-percu ne peut etre rendu qu\'en especes, verifiez les montants saisis',
      400
    )
  }

  const statut = montantPayeFloat >= montantTotal ? 'COMPLETE' : 'PARTIELLE'
  const monnaie = Math.max(0, montantPayeFloat - montantTotal)
  const resteADu = Math.max(0, montantTotal - montantPayeFloat)

  // Une vente ne peut pas simplement "manquer" d'argent sans etre rattachee
  // a un client — sinon la dette n'est trackee nulle part et disparait.
  if (resteADu > 0 && !clientId) {
    return apiError(
      `Il reste ${resteADu} GNF non couvert par les paiements saisis — ` +
      'selectionnez un client pour mettre le reste sur son compte credit',
      400
    )
  }

  // Champ resume historique : le mode unique si une seule ligne (comportement
  // identique a avant), CREDIT si rien n'a ete encaisse, MIXTE si plusieurs
  // modes ont ete combines.
  const modePaiementResume: ModePaiement =
    lignesPaiement.length === 0
      ? 'CREDIT'
      : lignesPaiement.length === 1
        ? (lignesPaiement[0].modePaiement as ModePaiement)
        : 'MIXTE'

  // Vérification plafond crédit
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

  // timeout/maxWait releves du defaut Prisma (5s/2s) : une vente de plusieurs
  // articles fait plusieurs allers-retours sequentiels vers la base
  // (decrementerLotFifo + mouvementStock par ligne), et la latence
  // Guinee-Europe documentee (250-350ms/aller-retour) peut facilement
  // depasser 5s pour 2-3 articles — constate en usage reel le 11/07/2026
  // (erreur P2028 "Transaction not found" sur une vente normale).
  const vente = await prisma.$transaction(
    async (tx) => {
    // 1. Créer la vente
    const numeroFacture = await genererNumeroFacture(tx, pharmacieId)
    const v = await tx.vente.create({
      data: {
        numeroFacture,
        montantTotal,
        montantPaye: montantPayeFloat,
        monnaie,
        remise,
        statut,
        pharmacieId,
        userId,
        clientId: clientId || null,
        sessionCaisseId: sessionCaisse.id,
        modePaiement: modePaiementResume,
        lignes: {
          create: lignesAvecPrix.map((l) => ({
            medicamentId: l.medicamentId,
            quantite:     l.quantite,
            prixUnitaire: l.prixUnitaire,
          })),
        },
        ...(lignesPaiement.length > 0 && {
          paiements: {
            create: lignesPaiement.map((p) => ({
              modePaiement: p.modePaiement as ModePaiement,
              montant: p.montant,
            })),
          },
        }),
      },
      include: { lignes: true },
    })

    // 2. Décrémenter les lots FIFO et enregistrer les mouvements
    for (const ligne of lignesAvecPrix) {
      await decrementerLotFifo(ligne.medicamentId, pharmacieId, ligne.quantite, tx)
      await tx.mouvementStock.create({
        data: {
          type:        'SORTIE',
          quantite:    ligne.quantite,
          medicamentId: ligne.medicamentId,
          userId,
          venteId:     v.id,
        },
      })
    }

    // 3. Crédit client si nécessaire
    if (clientId && statut === 'PARTIELLE') {
      const resteADoit = montantTotal - montantPayeFloat
      await tx.client.update({
        where: { id: clientId },
        data:  { soldeCredit: { increment: resteADoit } },
      })
    }

    return v
    },
    { timeout: 15000, maxWait: 10000 }
  )

  await createAuditLog({
    action:   'VENTE_EFFECTUEE',
    details:  { numeroFacture: vente.numeroFacture, montantTotal, statut },
    userId,
    pharmacieId,
  })

  return apiSuccess(vente, 201)
}