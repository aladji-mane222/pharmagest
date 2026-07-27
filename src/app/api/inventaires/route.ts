import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { aLaPermission } from '@/lib/permissions'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  // Inventaire reserve aux admins (decision Nabe le 27/07/2026, suite a
  // l'audit Phase 5) — les ecarts peuvent reveler des infos sensibles
  // (vol suspecte, erreurs repetees d'un caissier precis), sauf caissier
  // ayant recu la permission supplementaire INVENTAIRE_COMPLET.
  if (session.user.role === 'CAISSIER' && !(await aLaPermission(session.user.id, 'INVENTAIRE_COMPLET'))) {
    return apiError('Acces refuse', 403)
  }

  const pharmacieId = session.user.pharmacieId

  const inventairesRaw = await prisma.inventaire.findMany({
    where: { pharmacieId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      user: { select: { nom: true } },
      lignes: { select: { ecart: true } },
    },
  })

  const inventaires = inventairesRaw.map(({ lignes, ...i }) => ({
    ...i,
    nbLignes: lignes.length,
    nbEcarts: lignes.filter(l => l.ecart !== 0).length,
  }))

  return apiSuccess(inventaires)
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER' && !(await aLaPermission(session.user.id, 'INVENTAIRE_COMPLET'))) return apiError('Acces refuse', 403)

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
