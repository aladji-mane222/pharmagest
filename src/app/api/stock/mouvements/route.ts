import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, TypeMouvement } from '@prisma/client'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const { searchParams } = new URL(request.url)

  const page    = Math.max(1, parseInt(searchParams.get('page')   || '1'))
  const limite  = Math.max(1, Math.min(100, parseInt(searchParams.get('limite') || '20')))
  const type    = searchParams.get('type') as string | null
  const medicamentId = searchParams.get('medicamentId')
  const dateDebut    = searchParams.get('dateDebut')
  const dateFin      = searchParams.get('dateFin')

  // Filtre multi-tenant via la relation medicament (MouvementStock n'a pas pharmacieId)
  const where: Prisma.MouvementStockWhereInput = { medicament: { pharmacieId } }

  if (type)         where.type         = type as TypeMouvement
  if (medicamentId) where.medicamentId = medicamentId
  if (dateDebut || dateFin) {
    const fin = dateFin ? new Date(dateFin) : undefined
    if (fin) fin.setUTCHours(23, 59, 59, 999)
    where.createdAt = {
      ...(dateDebut && { gte: new Date(dateDebut) }),
      ...(fin       && { lte: fin }),
    }
  }

  const [mouvements, total] = await Promise.all([
    prisma.mouvementStock.findMany({
      where,
      include: {
        medicament: { select: { nom: true, unite: true } },
        user:       { select: { nom: true } },
        vente:      { select: { id: true, numeroFacture: true } },
        commande:   { select: { id: true, numeroCommande: true } },
        inventaire: { select: { id: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limite,
      take: limite,
    }),
    prisma.mouvementStock.count({ where }),
  ])

  return apiSuccess({
    mouvements,
    total,
    page,
    totalPages: Math.ceil(total / limite),
  })
}