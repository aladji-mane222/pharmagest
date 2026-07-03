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

          const [ventesJour, medicamentsAvecStock, sessionCaisse] = await Promise.all([
            prisma.vente.aggregate({
              where: { pharmacieId, createdAt: { gte: debutJour }, statut: 'COMPLETE' },
              _sum: { montantTotal: true },
              _count: true,
            }),
            prisma.medicament.findMany({
              where: { pharmacieId, actif: true },
              select: {
                stockMinimum: true,
                lots: { where: { actif: true }, select: { quantite: true } },
              },
            }),
            prisma.sessionCaisse.findFirst({
              where: { pharmacieId, dateCloture: null, actif: true },
              select: { id: true },
            }),
          ])

          const stockBas = medicamentsAvecStock.filter(
            m => m.lots.reduce((s, l) => s + l.quantite, 0) < m.stockMinimum
          ).length

          const data = {
            caJour: ventesJour._sum.montantTotal ?? 0,
            nbVentes: ventesJour._count,
            stockBas,
            sessionOuverte: !!sessionCaisse,
            timestamp: new Date().toISOString(),
          }

          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
        } catch (error) {
          console.error('SSE error:', error)
        }
      }

      await sendData()

      const interval = setInterval(sendData, 30000)

      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch (e) {
          // already closed
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
