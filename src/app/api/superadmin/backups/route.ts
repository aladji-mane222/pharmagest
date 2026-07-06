import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role !== 'SUPER_ADMIN') return apiError('Acces refuse', 403)

  const pharmacies = await prisma.pharmacie.findMany({
    select: { id: true, nom: true },
    orderBy: { nom: 'asc' },
  })

  const statuts = await Promise.all(
    pharmacies.map(async (pharmacie) => {
      const [dernierSucces, dernierEchec] = await Promise.all([
        prisma.auditLog.findFirst({
          where:   { pharmacieId: pharmacie.id, action: 'BACKUP_REUSSI' },
          orderBy: { createdAt: 'desc' },
          select:  { createdAt: true, details: true },
        }),
        prisma.auditLog.findFirst({
          where:   { pharmacieId: pharmacie.id, action: 'BACKUP_ECHEC' },
          orderBy: { createdAt: 'desc' },
          select:  { createdAt: true, details: true },
        }),
      ])

      return {
        pharmacieId:  pharmacie.id,
        pharmacieNom: pharmacie.nom,
        dernierSucces: dernierSucces
          ? {
              date:    dernierSucces.createdAt,
              fichier: (dernierSucces.details as Record<string, unknown>)?.fichier ?? null,
              taille:  (dernierSucces.details as Record<string, unknown>)?.taille ?? null,
            }
          : null,
        dernierEchec: dernierEchec
          ? {
              date:   dernierEchec.createdAt,
              erreur: (dernierEchec.details as Record<string, unknown>)?.erreur ?? null,
            }
          : null,
      }
    })
  )

  return apiSuccess(statuts)
}
