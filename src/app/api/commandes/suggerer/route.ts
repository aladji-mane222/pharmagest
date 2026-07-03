import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacieId = session.user.pharmacieId

  const medicaments = await prisma.medicament.findMany({
    where: { pharmacieId, actif: true },
    select: {
      id: true,
      nom: true,
      stockMinimum: true,
      lots: { where: { actif: true }, select: { quantite: true } },
    },
  })

  const suggestions = medicaments
    .map(m => ({
      medicamentId: m.id,
      nom: m.nom,
      stockMinimum: m.stockMinimum,
      stockActuel: m.lots.reduce((s, l) => s + l.quantite, 0),
    }))
    .filter(m => m.stockActuel < m.stockMinimum)
    .sort((a, b) => a.stockActuel - b.stockActuel)
    .map(m => ({
      ...m,
      quantiteSuggeree: Math.max(m.stockMinimum * 2 - m.stockActuel, m.stockMinimum),
    }))

  return apiSuccess(suggestions)
}
