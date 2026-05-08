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
  const debut = searchParams.get('debut') ? new Date(searchParams.get('debut')!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const fin = searchParams.get('fin') ? new Date(searchParams.get('fin')!) : new Date()
  const pharmacieId = session.user.pharmacieId

  if (type === 'ventes') {
    const ventes = await prisma.vente.findMany({
      where: { pharmacieId, createdAt: { gte: debut, lte: fin }, statut: 'COMPLETE' },
      include: { user: { select: { nom: true } }, lignes: { include: { medicament: { select: { nom: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
    const total = ventes.reduce((s, v) => s + v.montantTotal, 0)
    return apiSuccess({ ventes, total, type })
  }

  if (type === 'stock') {
    const medicaments = await prisma.medicament.findMany({
      where: { pharmacieId, actif: true },
      include: { lots: { where: { actif: true } } },
    })
    const stock = medicaments.map((m) => ({
      ...m,
      stockTotal: m.lots.reduce((s, l) => s + l.quantite, 0),
      valeur: m.lots.reduce((s, l) => s + l.quantite, 0) * (m.prixAchat || 0),
    }))
    const valeurTotale = stock.reduce((s, m) => s + m.valeur, 0)
    return apiSuccess({ stock, valeurTotale, type })
  }

  if (type === 'benefice') {
    const ventes = await prisma.vente.aggregate({
      where: { pharmacieId, createdAt: { gte: debut, lte: fin }, statut: 'COMPLETE' },
      _sum: { montantTotal: true },
    })
    const depenses = await prisma.depense.aggregate({
      where: { pharmacieId, createdAt: { gte: debut, lte: fin } },
      _sum: { montant: true },
    })
    const ca = ventes._sum.montantTotal ?? 0
    const totalDepenses = depenses._sum.montant ?? 0
    const beneficeNet = ca - totalDepenses
    return apiSuccess({ ca, totalDepenses, beneficeNet, type })
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
