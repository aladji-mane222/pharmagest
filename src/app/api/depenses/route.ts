import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const { searchParams } = new URL(request.url)
  const mois = searchParams.get('mois')

  const where: { pharmacieId: string; createdAt?: { gte: Date; lte: Date } } = {
    pharmacieId: session.user.pharmacieId,
  }

  if (mois) {
    const [annee, m] = mois.split('-').map(Number)
    where.createdAt = {
      gte: new Date(annee, m - 1, 1),
      lte: new Date(annee, m, 0, 23, 59, 59),
    }
  }

  const [depenses, total] = await Promise.all([
    prisma.depense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.depense.aggregate({
      where,
      _sum: { montant: true },
    }),
  ])

  return apiSuccess({ depenses, totalMontant: total._sum.montant ?? 0 })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const body = await request.json()
  const { libelle, montant, categorie } = body

  if (!libelle || !montant) return apiError('Libelle et montant requis', 400)

  const depense = await prisma.depense.create({
    data: {
      libelle,
      montant: parseFloat(montant),
      categorie: categorie || null,
      pharmacieId: session.user.pharmacieId,
    },
  })

  await createAuditLog({
    action: 'DEPENSE_AJOUTEE',
    details: { depenseId: depense.id, libelle, montant },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(depense, 201)
}
