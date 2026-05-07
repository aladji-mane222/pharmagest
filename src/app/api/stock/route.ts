import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const medicaments = await prisma.medicament.findMany({
    where: { pharmacieId: session.user.pharmacieId, actif: true },
    include: {
      lots: {
        where: { actif: true },
        orderBy: { datePeremption: 'asc' },
      },
    },
    orderBy: { nom: 'asc' },
  })

  const stock = medicaments.map((med) => {
    const stockTotal = med.lots.reduce((sum, lot) => sum + lot.quantite, 0)
    const lotsCritiques = med.lots.filter((lot) => {
      const jours = Math.ceil((new Date(lot.datePeremption).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return jours <= 90
    })
    return {
      ...med,
      stockTotal,
      stockBas: stockTotal < med.stockMinimum,
      lotsCritiques: lotsCritiques.length,
    }
  })

  const valeurTotale = stock.reduce((sum, med) => sum + med.stockTotal * med.prixAchat!, 0)

  return apiSuccess({ stock, valeurTotale })
}
