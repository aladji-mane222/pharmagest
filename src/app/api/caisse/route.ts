import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const userId = session.user.id

  // Chaque caissier voit uniquement SA session active
  const sessionActive = await prisma.sessionCaisse.findFirst({
    where: {
      pharmacieId,
      userId,
      dateCloture: null,
      actif: true,
    },
    include: { user: { select: { nom: true } } },
  })

  const historique = await prisma.sessionCaisse.findMany({
    where: { pharmacieId },
    include: { user: { select: { nom: true } } },
    orderBy: { dateOuverture: 'desc' },
    take: 10,
  })

  return apiSuccess({ sessionActive, historique })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const userId = session.user.id
  const body = await request.json()
  const { action, montantOuverture, montantCloture, noteCloture } = body

  if (action === 'ouvrir') {
    // Vérifier uniquement la session de CE caissier, pas de toute la pharmacie
    const existante = await prisma.sessionCaisse.findFirst({
      where: {
        pharmacieId,
        userId,
        dateCloture: null,
        actif: true,
      },
    })
    if (existante) return apiError('Vous avez deja une session ouverte', 400)

    const nouvelleSession = await prisma.sessionCaisse.create({
      data: {
        montantOuverture: parseFloat(montantOuverture) || 0,
        userId,
        pharmacieId,
        actif: true,
      },
      include: { user: { select: { nom: true } } },
    })

    await createAuditLog({
      action: 'CAISSE_OUVERTE',
      details: { sessionId: nouvelleSession.id, montantOuverture },
      userId,
      pharmacieId,
    })

    return apiSuccess(nouvelleSession, 201)
  }

  if (action === 'fermer') {
    // Fermer uniquement LA session de CE caissier
    const sessionOuverte = await prisma.sessionCaisse.findFirst({
      where: {
        pharmacieId,
        userId,
        dateCloture: null,
        actif: true,
      },
    })
    if (!sessionOuverte) return apiError('Vous n\'avez aucune session ouverte', 400)

    const ventes = await prisma.vente.aggregate({
      where: { sessionCaisseId: sessionOuverte.id, statut: 'COMPLETE' },
      _sum: { montantPaye: true },
    })

    const totalVentes = ventes._sum.montantPaye ?? 0
    const montantFinal = parseFloat(montantCloture) || 0

    const sessionFermee = await prisma.sessionCaisse.update({
      where: { id: sessionOuverte.id },
      data: {
        montantCloture: montantFinal,
        dateCloture: new Date(),
        noteCloture,
        actif: false,
      },
    })

    await createAuditLog({
      action: 'CAISSE_FERMEE',
      details: { sessionId: sessionOuverte.id, totalVentes, montantCloture },
      userId,
      pharmacieId,
    })

    return apiSuccess({ session: sessionFermee, totalVentes })
  }

  return apiError('Action non reconnue', 400)
}