import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
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

  // Optimisation SQL : Récupération des médicaments + stock total en une seule passe
  const medicaments = await prisma.$queryRaw<any[]>`
    SELECT 
      m.*,
      COALESCE(SUM(l.quantite), 0)::int as "stockTotal"
    FROM "Medicament" m
    LEFT JOIN "Lot" l ON l."medicamentId" = m.id AND l.actif = true
    WHERE m."pharmacieId" = ${pharmacieId} AND m.actif = true
    ${search ? Prisma.sql`AND m.nom ILIKE ${'%' + search + '%'}` : Prisma.sql``}
    ${categorie ? Prisma.sql`AND m.categorie = ${categorie}` : Prisma.sql``}
    GROUP BY m.id
    ORDER BY m.nom ASC
    LIMIT ${limit} OFFSET ${offset}
  `

  // Requête séparée pour le total (nécessaire pour la pagination)
  const totalResult = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*)::int as count 
    FROM "Medicament" 
    WHERE "pharmacieId" = ${pharmacieId} AND actif = true
    ${search ? Prisma.sql`AND nom ILIKE ${'%' + search + '%'}` : Prisma.sql``}
  `
  const total = totalResult[0].count

  return apiSuccess({ medicaments, total, page, limit })
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
