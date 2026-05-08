import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { envoyerEmail, templateAlertStock } from '@/lib/email'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return apiError('Acces refuse', 403)
  }

  const pharmacieId = session.user.pharmacieId
  const now = new Date()
  const dans90Jours = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const medicaments = await prisma.medicament.findMany({
    where: { pharmacieId, actif: true },
    include: { lots: { where: { actif: true } } },
  })

  const stockBas = medicaments.filter((med) => {
    const total = med.lots.reduce((s, l) => s + l.quantite, 0)
    return total < med.stockMinimum
  }).map((med) => ({
    nom: med.nom,
    stock: med.lots.reduce((s, l) => s + l.quantite, 0),
    minimum: med.stockMinimum,
  }))

  const peremptions = await prisma.lot.findMany({
    where: {
      actif: true,
      datePeremption: { lte: dans90Jours, gte: now },
      medicament: { pharmacieId },
    },
    include: { medicament: true },
  })

  const pharmacie = await prisma.pharmacie.findUnique({
    where: { id: pharmacieId },
  })

  if (stockBas.length > 0 && process.env.EMAIL_ADMIN) {
    await envoyerEmail({
      to: process.env.EMAIL_ADMIN,
      subject: `PharmaGest — ${stockBas.length} medicament(s) en stock bas`,
      html: templateAlertStock(stockBas),
    })
  }

  return apiSuccess({
    stockBas: stockBas.length,
    peremptions: peremptions.length,
    emailEnvoye: stockBas.length > 0,
  })
}
