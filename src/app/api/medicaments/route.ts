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
  const skip = (page - 1) * limit

  const where = {
    pharmacieId,
    actif: true,
    ...(search && { nom: { contains: search, mode: 'insensitive' as const } }),
    ...(categorie && { categorie }),
  }

  const [medicaments, total] = await Promise.all([
    prisma.medicament.findMany({
      where,
      include: { lots: { where: { actif: true } } },
      orderBy: { nom: 'asc' },
      skip,
      take: limit,
    }),
    prisma.medicament.count({ where }),
  ])

  const medicamentsAvecStock = medicaments.map((med) => ({
    ...med,
    stockTotal: med.lots.reduce((sum, lot) => sum + lot.quantite, 0),
  }))

  const response = apiSuccess({ medicaments: medicamentsAvecStock, total, page, limit })
  response.headers.set('Cache-Control', 'private, max-age=30')
  return response
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
