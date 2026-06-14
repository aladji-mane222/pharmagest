import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const inventaire = await prisma.inventaire.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
    include: {
      lignes: {
        include: { medicament: { include: { lots: { where: { actif: true } } } } },
      },
      user: { select: { nom: true } },
    },
  })

  if (!inventaire) return apiError('Inventaire non trouve', 404)
  return apiSuccess(inventaire)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const body = await request.json()
  const { action, lignes } = body

  const pharmacieId = session.user.pharmacieId

  const inventaire = await prisma.inventaire.findFirst({
    where: { id: params.id, pharmacieId },
    include: { lignes: { include: { medicament: true } } },
  })
  if (!inventaire) return apiError('Inventaire non trouve', 404)
  if (inventaire.statut === 'VALIDE') return apiError('Inventaire deja valide', 400)

  if (action === 'saisir' && lignes) {
    for (const ligne of lignes) {
      const stockTheorique = await prisma.lot.aggregate({
        where: { medicamentId: ligne.medicamentId, actif: true },
        _sum: { quantite: true },
      })
      const stock = stockTheorique._sum.quantite ?? 0
      const ecart = parseInt(ligne.quantiteReelle) - stock

      await prisma.ligneInventaire.update({
        where: { id: ligne.id },
        data: {
          quantiteReelle: parseInt(ligne.quantiteReelle),
          ecart,
          // Sauvegarder motifEcart s'il est fourni (Bug #4)
          motifEcart: ligne.motifEcart ?? null,
        },
      })
    }
    return apiSuccess({ message: 'Lignes mises a jour' })
  }

  if (action === 'valider') {
    // ─── VÉRIFICATION motifEcart OBLIGATOIRE (Bug #4) ────────────────────
    const lignesSansMotif = inventaire.lignes.filter(
      (l) => l.ecart !== 0 && (!l.motifEcart || l.motifEcart.trim() === '')
    )
    if (lignesSansMotif.length > 0) {
      const noms = lignesSansMotif
        .map((l) => l.medicament.nom)
        .join(', ')
      return apiError(
        `Motif obligatoire pour chaque ecart. Manquant pour : ${noms}`,
        400
      )
    }
    // ─────────────────────────────────────────────────────────────────────

    await prisma.$transaction(async (tx) => {
      for (const ligne of inventaire.lignes) {
        if (ligne.ecart !== 0) {
          const lots = await tx.lot.findMany({
            where: { medicamentId: ligne.medicamentId, actif: true },
            orderBy: { datePeremption: 'asc' },
          })

          if (lots.length > 0) {
            const nouveauStock = Math.max(0, lots[0].quantite + ligne.ecart)
            await tx.lot.update({
              where: { id: lots[0].id },
              data: { quantite: nouveauStock, actif: nouveauStock > 0 },
            })
          }

          // MouvementStock pour traçabilité
          await tx.mouvementStock.create({
            data: {
              type: 'AJUSTEMENT',
              quantite: Math.abs(ligne.ecart),
              medicamentId: ligne.medicamentId,
              userId: session.user.id,
            },
          })

          await createAuditLog({
            action: 'INVENTAIRE_ECART',
            details: {
              inventaireId: params.id,
              medicamentId: ligne.medicamentId,
              medicamentNom: ligne.medicament.nom,
              ecart: ligne.ecart,
              motifEcart: ligne.motifEcart,
            },
            userId: session.user.id,
            pharmacieId,
          })
        }
      }

      await tx.inventaire.update({
        where: { id: params.id },
        data: { statut: 'VALIDE' },
      })
    })

    await createAuditLog({
      action: 'INVENTAIRE_VALIDE',
      details: { inventaireId: params.id },
      userId: session.user.id,
      pharmacieId,
    })

    return apiSuccess({ message: 'Inventaire valide avec succes' })
  }

  return apiError('Action non reconnue', 400)
}