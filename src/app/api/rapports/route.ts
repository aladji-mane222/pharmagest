import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'ventes'
  const debut = searchParams.get('debut')
    ? new Date(searchParams.get('debut')!)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const fin = searchParams.get('fin') ? new Date(searchParams.get('fin')!) : new Date()
  fin.setHours(23, 59, 59, 999)
  const pharmacieId = session.user.pharmacieId

  if (type === 'ventes') {
    const ventes = await prisma.vente.findMany({
      where: {
        pharmacieId,
        createdAt: { gte: debut, lte: fin },
        statut: 'COMPLETE',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        montantTotal: true,
        createdAt: true,
        user: { select: { nom: true } },
      },
    })
    const total = ventes.reduce((s, v) => s + v.montantTotal, 0)
    return apiSuccess({ ventes, total, type })
  }

  if (type === 'stock') {
    const medicamentsRaw = await prisma.medicament.findMany({
      where: { pharmacieId, actif: true },
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        prixAchat: true,
        lots: { where: { actif: true }, select: { quantite: true } },
      },
    })
    const stock = medicamentsRaw.map(({ lots, ...m }) => {
      const stockTotal = lots.reduce((s, l) => s + l.quantite, 0)
      return { ...m, stockTotal, valeur: stockTotal * (m.prixAchat || 0) }
    })
    const valeurTotale = stock.reduce((s, m) => s + m.valeur, 0)
    return apiSuccess({ stock, valeurTotale, type })
  }

  if (type === 'benefice') {
    // BUG CRITIQUE corrigé le 04/07/2026 : le CMV (coût des médicaments
    // vendus) n'était jamais soustrait — beneficeNet = ca - totalDepenses
    // uniquement, alors que CONTEXTE.md §7.8 fixe la formule à
    // CA − CMV − Dépenses. Le CMV étant généralement la plus grosse charge
    // d'une pharmacie, le bénéfice net affiché était largement surestimé.
    const [ventesAgg, depensesAgg, lignesVendues] = await Promise.all([
      prisma.vente.aggregate({
        where: { pharmacieId, createdAt: { gte: debut, lte: fin }, statut: 'COMPLETE' },
        _sum: { montantTotal: true },
      }),
      prisma.depense.aggregate({
        where: { pharmacieId, createdAt: { gte: debut, lte: fin } },
        _sum: { montant: true },
      }),
      prisma.ligneVente.findMany({
        where: {
          vente: { pharmacieId, createdAt: { gte: debut, lte: fin }, statut: 'COMPLETE' },
        },
        select: {
          quantite: true,
          lot:        { select: { prixAchat: true } },
          medicament: { select: { prixAchat: true } },
        },
      }),
    ])

    // Priorité au prixAchat réel du lot vendu (FIFO, coût par livraison) ;
    // repli sur le prixAchat de référence du médicament si le lot est
    // inconnu (ligne historique sans lotId, ou lot sans prixAchat renseigné)
    const cmv = lignesVendues.reduce((somme, ligne) => {
      const cout = ligne.lot?.prixAchat ?? ligne.medicament.prixAchat ?? 0
      return somme + cout * ligne.quantite
    }, 0)

    const ca = ventesAgg._sum.montantTotal ?? 0
    const totalDepenses = depensesAgg._sum.montant ?? 0
    const beneficeNet = ca - cmv - totalDepenses
    return apiSuccess({ ca, cmv, totalDepenses, beneficeNet, type })
  }

  if (type === 'credits') {
    const clients = await prisma.client.findMany({
      where: { pharmacieId, actif: true, soldeCredit: { gt: 0 } },
      orderBy: { soldeCredit: 'desc' },
    })
    const totalDu = clients.reduce((s, c) => s + c.soldeCredit, 0)
    return apiSuccess({ clients, totalDu, type })
  }

  return apiError('Type de rapport non reconnu', 400)
}
