import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const categorie = searchParams.get('categorie') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const where = {
    pharmacieId,
    actif: true,
    ...(search && { nom: { contains: search, mode: 'insensitive' as const } }),
    ...(categorie && { categorie }),
  }

  const [medicamentsRaw, total, categoriesRaw] = await Promise.all([
    prisma.medicament.findMany({
      where,
      include: { lots: { where: { actif: true }, select: { quantite: true } } },
      orderBy: { nom: 'asc' },
      skip: offset,
      take: limit,
    }),
    prisma.medicament.count({ where }),
    // Liste complete des categories du catalogue, independante de la page
    // et de la recherche en cours — sinon le menu deroulant de filtre ne
    // proposerait que les categories visibles sur la page courante
    // (constate en usage reel le 12/07/2026 avec la pagination manquante).
    prisma.medicament.findMany({
      where: { pharmacieId, actif: true, categorie: { not: null } },
      select: { categorie: true },
      distinct: ['categorie'],
      orderBy: { categorie: 'asc' },
    }),
  ])

  const medicaments = medicamentsRaw.map(({ lots, ...m }) => ({
    ...m,
    stockTotal: lots.reduce((sum, l) => sum + l.quantite, 0),
  }))
  const categories = categoriesRaw.map((c) => c.categorie).filter(Boolean)

  return apiSuccess({ medicaments, total, page, limit, categories })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const pharmacieId = session.user.pharmacieId
  const body = await request.json()
  const { nom, description, categorie, unite, prixVente, prixAchat, stockMinimum } = body

  if (!nom || !prixVente) return apiError('Nom et prix de vente requis', 400)

  const medicament = await prisma.medicament.create({
    data: {
      nom,
      description,
      categorie,
      unite: unite || 'comprime',
      prixVente: parseFloat(prixVente),
      prixAchat: prixAchat ? parseFloat(prixAchat) : null,
      stockMinimum: stockMinimum ? parseInt(stockMinimum) : 10,
      pharmacieId,
    },
  })

  await createAuditLog({
    action: 'MEDICAMENT_CREE',
    details: { medicamentId: medicament.id, nom: medicament.nom },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess(medicament, 201)
}