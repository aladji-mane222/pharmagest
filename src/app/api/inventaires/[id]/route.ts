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

  const inventaire = await prisma.inventaire.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
    include: { lignes: { include: { medicament: true } } },
  })
  if (!inventaire) return apiError('Inventaire non trouve', 404)

  if (action === 'saisir' && lignes) {
    for (const ligne of lignes) {
      const stockTheorique = await prisma.lot.aggregate({
        where: { medicamentId: ligne.medicamentId, actif: true },
        _sum: { quantite: true },
      })
      const stock = stockTheorique._sum.quantite ?? 0

      await prisma.ligneInventaire.update({
        where: { id: ligne.id },
        data: {
          quantiteReelle: parseInt(ligne.quantiteReelle),
          ecart: parseInt(ligne.quantiteReelle) - stock,
        },
      })
    }
    return apiSuccess({ message: 'Lignes mises a jour' })
  }

  if (action === 'valider') {
    for (const ligne of inventaire.lignes) {
      if (ligne.ecart !== 0) {
        const lots = await prisma.lot.findMany({
          where: { medicamentId: ligne.medicamentId, actif: true },
          orderBy: { datePeremption: 'asc' },
        })

        if (lots.length > 0) {
          const nouveauStock = Math.max(0, lots[0].quantite + ligne.ecart)
          await prisma.lot.update({
            where: { id: lots[0].id },
            data: { quantite: nouveauStock, actif: nouveauStock > 0 },
          })
        }
      }
    }

    const updated = await prisma.inventaire.update({
      where: { id: params.id },
      data: { statut: 'VALIDE' },
    })

    await createAuditLog({
      action: 'INVENTAIRE_VALIDE',
      details: { inventaireId: params.id },
      userId: session.user.id,
      pharmacieId: session.user.pharmacieId,
    })

    return apiSuccess(updated)
  }

  return apiError('Action non reconnue', 400)
}
