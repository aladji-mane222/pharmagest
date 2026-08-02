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
      formatRecu: true, dureeMaxSessionCaisseH: true, logoUrl: true,
    },
  })

  return apiSuccess(pharmacie)
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const body = await request.json()
  const { nom, adresse, telephone, email, formatRecu, dureeMaxSessionCaisseH, logoUrl } = body

  // Un CAISSIER peut changer le format de recu (besoin operationnel du
  // quotidien) mais pas les infos administratives de la pharmacie ni la
  // duree max de session caisse ni le logo — decision confirmee par Nabe le
  // 23/07/2026. On rejette explicitement plutot que d'ignorer
  // silencieusement, pour que l'appelant sache que ce n'est pas passe.
  if (session.user.role === 'CAISSIER') {
    const champsInterdits = { nom, adresse, telephone, email, dureeMaxSessionCaisseH, logoUrl }
    const tentativeChampInterdit = Object.entries(champsInterdits).some(([, v]) => v !== undefined)
    if (tentativeChampInterdit) {
      return apiError('Seul le format de recu peut etre modifie par un caissier', 403)
    }
  }

  // logoUrl stocke en base64 (data URL) directement dans la colonne TEXT
  // — pas de stockage externe (Vercel Blob, S3...) pour l'instant, pour
  // eviter une dependance/config supplementaire pour un simple logo de
  // petite taille. Limite a ~500 Ko en brut (~700K caracteres encodes en
  // base64) pour eviter des lignes demesurees en base.
  if (logoUrl !== undefined && logoUrl !== null) {
    if (typeof logoUrl !== 'string' || !logoUrl.startsWith('data:image/')) {
      return apiError('Le logo doit etre une image valide', 400)
    }
    if (logoUrl.length > 700_000) {
      return apiError('Image trop volumineuse (max ~500 Ko) — essaie une image plus legere', 400)
    }
  }

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
      ...(logoUrl !== undefined && { logoUrl }),
    },
  })

  return apiSuccess(pharmacie)
}