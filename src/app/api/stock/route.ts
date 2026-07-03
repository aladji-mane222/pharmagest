import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId
  const dans90Jours = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  const medicamentsRaw = await prisma.medicament.findMany({
    where: { pharmacieId, actif: true },
    include: {
      lots: {
        where: { actif: true },
        select: { quantite: true, datePeremption: true },
      },
    },
    orderBy: { nom: 'asc' },
  })

  const stock = medicamentsRaw.map(({ lots, ...m }) => {
    const stockTotal = lots.reduce((sum, l) => sum + l.quantite, 0)
    const lotsCritiques = lots.filter(l => l.datePeremption <= dans90Jours).length
    return { ...m, stockTotal, lotsCritiques, stockBas: stockTotal < m.stockMinimum }
  })

  const valeurTotale = stock.reduce((sum, m) => sum + (m.stockTotal * (m.prixAchat || 0)), 0)

  return apiSuccess({ stock, valeurTotale })
}
