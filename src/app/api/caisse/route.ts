import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const sessionActive = await prisma.sessionCaisse.findFirst({
    where: { pharmacieId: session.user.pharmacieId, statut: 'OUVERTE' },
    include: { user: { select: { nom: true } } },
  })

  const historique = await prisma.sessionCaisse.findMany({
    where: { pharmacieId: session.user.pharmacieId },
    include: { user: { select: { nom: true } } },
    orderBy: { ouvertureAt: 'desc' },
    take: 10,
  })

  return apiSuccess({ sessionActive, historique })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const body = await request.json()
  const { action, montantOuverture, montantCloture } = body

  if (action === 'ouvrir') {
    const existante = await prisma.sessionCaisse.findFirst({
      where: { pharmacieId: session.user.pharmacieId, statut: 'OUVERTE' },
    })
    if (existante) return apiError('Une session est deja ouverte', 400)

    const nouvelleSession = await prisma.sessionCaisse.create({
      data: {
        montantOuverture: parseFloat(montantOuverture) || 0,
        userId: session.user.id,
        pharmacieId: session.user.pharmacieId,
      },
    })

    await createAuditLog({
      action: 'CAISSE_OUVERTE',
      details: { sessionId: nouvelleSession.id, montantOuverture },
      userId: session.user.id,
      pharmacieId: session.user.pharmacieId,
    })

    return apiSuccess(nouvelleSession, 201)
  }

  if (action === 'fermer') {
    const sessionOuverte = await prisma.sessionCaisse.findFirst({
      where: { pharmacieId: session.user.pharmacieId, statut: 'OUVERTE' },
    })
    if (!sessionOuverte) return apiError('Aucune session ouverte', 400)

    const ventes = await prisma.vente.aggregate({
      where: { sessionCaisseId: sessionOuverte.id, statut: 'COMPLETE' },
      _sum: { montantPaye: true },
    })

    const totalVentes = ventes._sum.montantPaye ?? 0
    const montantFinal = (parseFloat(montantCloture) || 0)

    const sessionFermee = await prisma.sessionCaisse.update({
      where: { id: sessionOuverte.id },
      data: {
        statut: 'FERMEE',
        montantCloture: montantFinal,
        clotureAt: new Date(),
      },
    })

    await createAuditLog({
      action: 'CAISSE_FERMEE',
      details: { sessionId: sessionOuverte.id, totalVentes, montantCloture },
      userId: session.user.id,
      pharmacieId: session.user.pharmacieId,
    })

    return apiSuccess({ session: sessionFermee, totalVentes })
  }

  return apiError('Action non reconnue', 400)
}
