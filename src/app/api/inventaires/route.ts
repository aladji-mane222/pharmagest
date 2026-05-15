import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId

  // Optimisation : SQL brut pour éviter les overheads de Prisma sur les listes
  const inventaires = await prisma.$queryRaw<any[]>`
    SELECT 
      i.*,
      json_build_object('nom', u.nom) as user,
      (SELECT COUNT(*) FROM "LigneInventaire" WHERE "inventaireId" = i.id)::int as "nbLignes"
    FROM "Inventaire" i
    JOIN "User" u ON u.id = i."userId"
    WHERE i."pharmacieId" = ${pharmacieId}
    ORDER BY i."createdAt" DESC
    LIMIT 10
  `

  return apiSuccess(inventaires)
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const inventaireExistant = await prisma.inventaire.findFirst({
    where: { pharmacieId: session.user.pharmacieId, statut: 'EN_COURS' },
  })
  if (inventaireExistant) return apiError('Un inventaire est deja en cours', 400)

  const medicaments = await prisma.medicament.findMany({
    where: { pharmacieId: session.user.pharmacieId, actif: true },
    include: { lots: { where: { actif: true } } },
  })

  const inventaire = await prisma.inventaire.create({
    data: {
      pharmacieId: session.user.pharmacieId,
      userId: session.user.id,
      lignes: {
        create: medicaments.map((med) => ({
          medicamentId: med.id,
          quantiteReelle: 0,
          ecart: 0,
        })),
      },
    },
    include: { lignes: { include: { medicament: true } } },
  })

  await createAuditLog({
    action: 'INVENTAIRE_LANCE',
    details: { inventaireId: inventaire.id },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(inventaire, 201)
}
