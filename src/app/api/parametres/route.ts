import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const pharmacie = await prisma.pharmacie.findUnique({
    where: { id: session.user.pharmacieId },
    select: {
      id: true, nom: true, adresse: true, telephone: true, email: true,
      formatRecu: true, dureeMaxSessionCaisseH: true,
    },
  })

  return apiSuccess(pharmacie)
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const body = await request.json()
  const { nom, adresse, telephone, email, formatRecu, dureeMaxSessionCaisseH } = body

  const formatsValides = ['A4', 'THERMIQUE_58', 'THERMIQUE_80']
  if (formatRecu !== undefined && !formatsValides.includes(formatRecu)) {
    return apiError('Format de recu invalide', 400)
  }

  // null = pas de limite (comportement actuel, choix explicite de
  // l'admin). Sinon doit etre un entier positif d'heures.
  let dureeMax: number | null | undefined = undefined
  if (dureeMaxSessionCaisseH !== undefined) {
    if (dureeMaxSessionCaisseH === null || dureeMaxSessionCaisseH === '') {
      dureeMax = null
    } else {
      const n = parseInt(dureeMaxSessionCaisseH, 10)
      if (isNaN(n) || n <= 0) {
        return apiError('La duree max de session doit etre un nombre d\'heures positif', 400)
      }
      dureeMax = n
    }
  }

  const pharmacie = await prisma.pharmacie.update({
    where: { id: session.user.pharmacieId },
    data: {
      ...(nom && { nom }),
      ...(adresse !== undefined && { adresse }),
      ...(telephone !== undefined && { telephone }),
      ...(email !== undefined && { email }),
      ...(formatRecu !== undefined && { formatRecu }),
      ...(dureeMax !== undefined && { dureeMaxSessionCaisseH: dureeMax }),
    },
  })

  return apiSuccess(pharmacie)
}