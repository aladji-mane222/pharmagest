import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const commandes = await prisma.commandeFournisseur.findMany({
    where: { pharmacieId: session.user.pharmacieId },
    include: {
      fournisseur: { select: { nom: true } },
      lignes: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return apiSuccess(commandes)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const body = await request.json()
  const { fournisseurId, lignes } = body

  if (!fournisseurId || !lignes || lignes.length === 0) {
    return apiError('Fournisseur et lignes requis', 400)
  }

  const fournisseur = await prisma.fournisseur.findFirst({
    where: { id: fournisseurId, pharmacieId: session.user.pharmacieId },
  })
  if (!fournisseur) return apiError('Fournisseur non trouve', 404)

  const montantTotal = lignes.reduce(
    (sum: number, l: { quantite: number; prixUnitaire: number }) =>
      sum + l.quantite * l.prixUnitaire,
    0
  )

  const commande = await prisma.commandeFournisseur.create({
    data: {
      pharmacieId: session.user.pharmacieId,
      fournisseurId,
      montantTotal,
      lignes: {
        create: lignes.map((l: { medicamentId?: string; quantite: number; prixUnitaire: number }) => ({
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
        })),
      },
    },
    include: { lignes: true, fournisseur: true },
  })

  await createAuditLog({
    action: 'COMMANDE_CREEE',
    details: { commandeId: commande.id, fournisseurId, montantTotal },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(commande, 201)
}
