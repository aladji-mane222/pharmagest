import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return new Response('Non autorise', { status: 401 })

  const pharmacieId = session.user.pharmacieId

  const stream = new ReadableStream({
    async start(controller) {
      const { prisma } = await import('@/lib/prisma')

      const sendData = async () => {
        try {
          const now = new Date()
          const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate())

          // Optimisation : Utilisation de requêtes plus légères et ciblées
          const [ventesJour, stockBasCount, sessionCaisse] = await Promise.all([
            prisma.vente.aggregate({
              where: { pharmacieId, createdAt: { gte: debutJour }, statut: 'COMPLETE' },
              _sum: { montantTotal: true },
              _count: true,
            }),
            // Compter uniquement les médicaments en stock bas (SQL optimisé)
            prisma.$queryRaw<any[]>`
              SELECT COUNT(*)::int as count
              FROM "Medicament" m
              WHERE m."pharmacieId" = ${pharmacieId} AND m.actif = true
              AND (SELECT COALESCE(SUM(l.quantite), 0) FROM "Lot" l WHERE l."medicamentId" = m.id AND l.actif = true) < m."stockMinimum"
            `,
            prisma.sessionCaisse.findFirst({
              where: {
                pharmacieId,
                dateCloture: null, // v2.4 logic
                actif: true
              },
              select: { id: true } // On n'a besoin que de savoir si elle existe
            }),
          ])

          const data = {
            caJour: ventesJour._sum.montantTotal ?? 0,
            nbVentes: ventesJour._count,
            stockBas: stockBasCount[0]?.count ?? 0,
            sessionOuverte: !!sessionCaisse,
            timestamp: new Date().toISOString(),
          }

          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
        } catch (error) {
          console.error('SSE error:', error)
        }
      }

      // Premier envoi immédiat
      await sendData()

      // Intervalle de 30s (suffisant pour le dashboard)
      const interval = setInterval(sendData, 30000)

      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch (e) {
          // Déjà fermé
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
