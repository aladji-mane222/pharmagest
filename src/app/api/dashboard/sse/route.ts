import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return new Response('Non autorise', { status: 401 })

  const pharmacieId = session.user.pharmacieId

  const stream = new ReadableStream({
    start(controller) {
      const sendData = async () => {
        try {
          const { prisma } = await import('@/lib/prisma')
          const now = new Date()
          const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate())

          const [ventesJour, stockBas, sessionCaisse] = await Promise.all([
            prisma.vente.aggregate({
              where: { pharmacieId, createdAt: { gte: debutJour }, statut: 'COMPLETE' },
              _sum: { montantTotal: true },
              _count: true,
            }),
            prisma.medicament.findMany({
              where: { pharmacieId, actif: true },
              include: { lots: { where: { actif: true } } },
            }),
            prisma.sessionCaisse.findFirst({
              where: { pharmacieId, statut: 'OUVERTE' },
            }),
          ])

          const nbStockBas = stockBas.filter((med) => {
            const total = med.lots.reduce((s, l) => s + l.quantite, 0)
            return total < med.stockMinimum
          }).length

          const data = {
            caJour: ventesJour._sum.montantTotal ?? 0,
            nbVentes: ventesJour._count,
            stockBas: nbStockBas,
            sessionOuverte: !!sessionCaisse,
            timestamp: new Date().toISOString(),
          }

          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
        } catch (error) {
          console.error('SSE error:', error)
        }
      }

      sendData()
      const interval = setInterval(sendData, 30000)

      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
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
