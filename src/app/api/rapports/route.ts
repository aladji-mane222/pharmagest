import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const { searchParams } = new URL(request.url)
  const type  = searchParams.get('type') || 'benefice'
  const debut = searchParams.get('debut')
    ? new Date(searchParams.get('debut')!)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const fin = searchParams.get('fin')
    ? new Date(searchParams.get('fin')!)
    : new Date()
  fin.setHours(23, 59, 59, 999)

  const pharmacieId = session.user.pharmacieId

  // ── Rapport ventes ────────────────────────────────────────────────
  if (type === 'ventes') {
    const [ventes, parCaissier, parMode] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT v.id, v."montantTotal", v."createdAt",
          json_build_object('nom', u.nom) as user
        FROM "Vente" v
        JOIN "User" u ON u.id = v."userId"
        WHERE v."pharmacieId" = ${pharmacieId}
          AND v."createdAt" >= ${debut} AND v."createdAt" <= ${fin}
          AND v.statut = 'COMPLETE'
        ORDER BY v."createdAt" DESC
      `,
      // Répartition par caissier
      prisma.$queryRaw<any[]>`
        SELECT u.nom, COUNT(*)::int as nb_ventes,
          COALESCE(SUM(v."montantTotal"), 0)::float as total
        FROM "Vente" v
        JOIN "User" u ON u.id = v."userId"
        WHERE v."pharmacieId" = ${pharmacieId}
          AND v."createdAt" >= ${debut} AND v."createdAt" <= ${fin}
          AND v.statut = 'COMPLETE'
        GROUP BY u.nom
        ORDER BY total DESC
      `,
      // Répartition par mode de paiement
      prisma.$queryRaw<any[]>`
        SELECT v."modePaiement", COUNT(*)::int as nb_ventes,
          COALESCE(SUM(v."montantTotal"), 0)::float as total
        FROM "Vente" v
        WHERE v."pharmacieId" = ${pharmacieId}
          AND v."createdAt" >= ${debut} AND v."createdAt" <= ${fin}
          AND v.statut = 'COMPLETE'
        GROUP BY v."modePaiement"
        ORDER BY total DESC
      `,
    ])

    const total = ventes.reduce((s: number, v: any) => s + Number(v.montantTotal), 0)
    return apiSuccess({ ventes, total, parCaissier, parMode, type })
  }

  // ── Rapport stock ─────────────────────────────────────────────────
  if (type === 'stock') {
    const stock = await prisma.$queryRaw<any[]>`
      SELECT m.id, m.nom, m."prixAchat",
        COALESCE(SUM(l.quantite), 0)::int as "stockTotal",
        (COALESCE(SUM(l.quantite), 0) * COALESCE(m."prixAchat", 0)) as valeur
      FROM "Medicament" m
      LEFT JOIN "Lot" l ON l."medicamentId" = m.id AND l.actif = true
      WHERE m."pharmacieId" = ${pharmacieId} AND m.actif = true
      GROUP BY m.id, m.nom, m."prixAchat"
      ORDER BY valeur DESC
    `
    const valeurTotale = stock.reduce((s: number, m: any) => s + Number(m.valeur), 0)
    return apiSuccess({ stock, valeurTotale, type })
  }

  // ── Rapport bénéfice ──────────────────────────────────────────────
  if (type === 'benefice') {
    const [stats, cmvResult] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT
          (SELECT COALESCE(SUM("montantTotal"), 0)
           FROM "Vente"
           WHERE "pharmacieId" = ${pharmacieId}
             AND "createdAt" >= ${debut} AND "createdAt" <= ${fin}
             AND statut = 'COMPLETE') as ca,
          (SELECT COALESCE(SUM(montant), 0)
           FROM "Depense"
           WHERE "pharmacieId" = ${pharmacieId}
             AND "createdAt" >= ${debut} AND "createdAt" <= ${fin}
             AND archivee = false) as depenses
      `,
      // CMV = somme (prixAchat médicament × quantité vendue) pour ventes COMPLETE
      prisma.$queryRaw<any[]>`
        SELECT COALESCE(SUM(lv.quantite * COALESCE(m."prixAchat", 0)), 0)::float as cmv
        FROM "LigneVente" lv
        JOIN "Vente" v ON v.id = lv."venteId"
        JOIN "Medicament" m ON m.id = lv."medicamentId"
        WHERE v."pharmacieId" = ${pharmacieId}
          AND v."createdAt" >= ${debut} AND v."createdAt" <= ${fin}
          AND v.statut = 'COMPLETE'
      `,
    ])

    const ca           = Number(stats[0].ca)
    const totalDepenses = Number(stats[0].depenses)
    const cmv          = Number(cmvResult[0].cmv)
    const beneficeNet  = ca - cmv - totalDepenses

    return apiSuccess({ ca, cmv, totalDepenses, beneficeNet, type })
  }

  // ── Rapport crédits ───────────────────────────────────────────────
  if (type === 'credits') {
    const clients = await prisma.client.findMany({
      where:   { pharmacieId, actif: true, soldeCredit: { gt: 0 } },
      orderBy: { soldeCredit: 'desc' },
    })
    const totalDu = clients.reduce((s, c) => s + c.soldeCredit, 0)
    return apiSuccess({ clients, totalDu, type })
  }

  return apiError('Type de rapport non reconnu', 400)
}