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
        modePaiement: true,
        createdAt: true,
        user: { select: { nom: true } },
      },
    })

    const total = ventes.reduce((s, v) => s + v.montantTotal, 0)

    // Agrégat par caissier
    const caissierMap = new Map<string, { nom: string; nbVentes: number; total: number }>()
    for (const v of ventes) {
      const nom = v.user.nom
      const cur = caissierMap.get(nom) ?? { nom, nbVentes: 0, total: 0 }
      caissierMap.set(nom, { ...cur, nbVentes: cur.nbVentes + 1, total: cur.total + v.montantTotal })
    }
    const parCaissier = Array.from(caissierMap.values()).sort((a, b) => b.total - a.total)

    // Agrégat par mode de paiement
    const modeMap = new Map<string, { mode: string; nbVentes: number; total: number }>()
    for (const v of ventes) {
      const mode = v.modePaiement
      const cur  = modeMap.get(mode) ?? { mode, nbVentes: 0, total: 0 }
      modeMap.set(mode, { ...cur, nbVentes: cur.nbVentes + 1, total: cur.total + v.montantTotal })
    }
    const parMode = Array.from(modeMap.values()).sort((a, b) => b.total - a.total)

    return apiSuccess({ ventes, total, parCaissier, parMode, type })
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
    const ventesWhere = {
      pharmacieId,
      createdAt: { gte: debut, lte: fin },
      statut: 'COMPLETE' as const,
    }

    const [ventesAgg, depensesAgg, lignesVente] = await Promise.all([
      prisma.vente.aggregate({
        where: ventesWhere,
        _sum: { montantTotal: true },
      }),
      prisma.depense.aggregate({
        where: { pharmacieId, createdAt: { gte: debut, lte: fin }, archivee: false },
        _sum: { montant: true },
      }),
      // CMV = somme des (prixAchat du médicament × quantité vendue)
      prisma.ligneVente.findMany({
        where: { vente: ventesWhere },
        select: {
          quantite: true,
          medicament: { select: { prixAchat: true } },
        },
      }),
    ])

    const ca            = ventesAgg._sum.montantTotal ?? 0
    const totalDepenses = depensesAgg._sum.montant ?? 0
    const cmv           = lignesVente.reduce(
      (sum, l) => sum + (l.medicament.prixAchat ?? 0) * l.quantite,
      0
    )
    const beneficeNet   = ca - cmv - totalDepenses

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
