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

  // Suggestion de montant d'ouverture : ce qui etait reellement dans le tiroir
  // a la derniere fermeture, peu importe qui a ferme — l'argent ne disparait
  // pas entre deux caissiers. Reste une suggestion affichee, jamais appliquee
  // automatiquement : le caissier compte et confirme ou corrige.
  const derniereSessionFermee = await prisma.sessionCaisse.findFirst({
    where: { pharmacieId, dateCloture: { not: null } },
    orderBy: { dateCloture: 'desc' },
    select: { montantCloture: true, dateCloture: true, user: { select: { nom: true } } },
  })

  // Remboursements de credit encaisses en especes pendant CETTE session —
  // cet argent entre physiquement dans le tiroir au meme titre qu'une vente,
  // donc il doit etre compte dans le "total attendu en especes" a la
  // cloture, sinon la caisse affichera un faux excedent a chaque
  // remboursement.
  let remboursementsEspeces = 0
  if (sessionActive) {
    const aggRemb = await prisma.remboursementCredit.aggregate({
      where: { sessionCaisseId: sessionActive.id, modePaiement: 'ESPECES' },
      _sum: { montant: true },
    })
    remboursementsEspeces = aggRemb._sum.montant ?? 0
  }

  return apiSuccess({ sessionActive, historique, derniereSessionFermee, remboursementsEspeces })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const userId = session.user.id
  const body = await request.json()
  const { action, montantOuverture, montantCloture, noteCloture } = body

  if (action === 'ouvrir') {
    const montant = parseFloat(montantOuverture)
    if (montantOuverture === undefined || montantOuverture === '' || Number.isNaN(montant)) {
      return apiError('Montant d\'ouverture invalide', 400)
    }
    if (montant < 0) {
      return apiError('Le montant d\'ouverture ne peut pas etre negatif', 400)
    }

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
        montantOuverture: montant,
        userId,
        pharmacieId,
        actif: true,
      },
      include: { user: { select: { nom: true } } },
    })

    await createAuditLog({
      action: 'CAISSE_OUVERTE',
      details: { sessionId: nouvelleSession.id, montantOuverture: montant },
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

    const montantFinal = parseFloat(montantCloture)
    if (montantCloture === undefined || montantCloture === '' || Number.isNaN(montantFinal)) {
      return apiError('Montant de cloture invalide', 400)
    }
    if (montantFinal < 0) {
      return apiError('Le montant de cloture ne peut pas etre negatif', 400)
    }

    const ventes = await prisma.vente.aggregate({
      where: { sessionCaisseId: sessionOuverte.id, statut: 'COMPLETE' },
      _sum: { montantPaye: true },
    })

    const totalVentes = ventes._sum.montantPaye ?? 0

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