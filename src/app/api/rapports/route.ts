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
  fin.setHours(23, 59, 59, 999)
  const pharmacieId = session.user.pharmacieId

  if (type === 'ventes') {
    const ventes = await prisma.$queryRaw<any[]>`
      SELECT 
        v.id, v."montantTotal", v."createdAt",
        json_build_object('nom', u.nom) as user
      FROM "Vente" v
      JOIN "User" u ON u.id = v."userId"
      WHERE v."pharmacieId" = ${pharmacieId} 
      AND v."createdAt" >= ${debut} AND v."createdAt" <= ${fin}
      AND v."statut" = 'COMPLETE'
      ORDER BY v."createdAt" DESC
    `
    const total = ventes.reduce((s, v) => s + Number(v.montantTotal), 0)
    return apiSuccess({ ventes, total, type })
  }

  if (type === 'stock') {
    const stock = await prisma.$queryRaw<any[]>`
      SELECT 
        m.id, m.nom, m."prixAchat",
        COALESCE(SUM(l.quantite), 0)::int as "stockTotal",
        (COALESCE(SUM(l.quantite), 0) * COALESCE(m."prixAchat", 0)) as valeur
      FROM "Medicament" m
      LEFT JOIN "Lot" l ON l."medicamentId" = m.id AND l.actif = true
      WHERE m."pharmacieId" = ${pharmacieId} AND m.actif = true
      GROUP BY m.id, m.nom, m."prixAchat"
      ORDER BY m.nom ASC
    `
    const valeurTotale = stock.reduce((s, m) => s + Number(m.valeur), 0)
    return apiSuccess({ stock, valeurTotale, type })
  }

  if (type === 'benefice') {
    const stats = await prisma.$queryRaw<any[]>`
      SELECT 
        (SELECT COALESCE(SUM("montantTotal"), 0) FROM "Vente" WHERE "pharmacieId" = ${pharmacieId} AND "createdAt" >= ${debut} AND "createdAt" <= ${fin} AND "statut" = 'COMPLETE') as ca,
        (SELECT COALESCE(SUM("montant"), 0) FROM "Depense" WHERE "pharmacieId" = ${pharmacieId} AND "createdAt" >= ${debut} AND "createdAt" <= ${fin}) as depenses
    `
    const ca = Number(stats[0].ca)
    const totalDepenses = Number(stats[0].depenses)
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
