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
  const categorie = searchParams.get('categorie')

  const where: {
    pharmacieId: string
    archivee: boolean
    categorie?: string
    createdAt?: { gte: Date; lte: Date }
  } = {
    pharmacieId: session.user.pharmacieId,
    archivee: false, // Exclure les dépenses archivées par défaut
  }

  if (mois) {
    const [annee, m] = mois.split('-').map(Number)
    where.createdAt = {
      gte: new Date(annee, m - 1, 1),
      lte: new Date(annee, m, 0, 23, 59, 59),
    }
  }

  if (categorie) {
    where.categorie = categorie
  }

  const [depenses, total] = await Promise.all([
    prisma.depense.findMany({
      where,
      include: { user: { select: { nom: true } } },
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

  // Le caissier PEUT saisir une dépense (règle v2.4 — corrigé Session B)
  const body = await request.json()
  const { libelle, montant, categorie } = body

  if (!libelle || !montant) return apiError('Libelle et montant requis', 400)

  const montantFloat = parseFloat(montant)
  if (isNaN(montantFloat) || montantFloat <= 0) {
    return apiError('Montant invalide', 400)
  }

  const depense = await prisma.depense.create({
    data: {
      libelle,
      montant: montantFloat,
      categorie: categorie || null,
      userId: session.user.id, // toujours renseigné
      pharmacieId: session.user.pharmacieId,
    },
  })

  await createAuditLog({
    action: 'DEPENSE_AJOUTEE',
    details: { depenseId: depense.id, libelle, montant: montantFloat },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(depense, 201)
}