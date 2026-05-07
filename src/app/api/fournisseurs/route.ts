import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const fournisseurs = await prisma.fournisseur.findMany({
    where: { pharmacieId: session.user.pharmacieId, actif: true },
    orderBy: { nom: 'asc' },
  })

  return apiSuccess(fournisseurs)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const body = await request.json()
  const { nom, contact, telephone, email, delaiLivraison } = body

  if (!nom) return apiError('Nom du fournisseur requis', 400)

  const fournisseur = await prisma.fournisseur.create({
    data: {
      nom,
      contact: contact || null,
      telephone: telephone || null,
      email: email || null,
      delaiLivraison: delaiLivraison ? parseInt(delaiLivraison) : null,
      pharmacieId: session.user.pharmacieId,
    },
  })

  await createAuditLog({
    action: 'FOURNISSEUR_CREE',
    details: { fournisseurId: fournisseur.id, nom: fournisseur.nom },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(fournisseur, 201)
}
