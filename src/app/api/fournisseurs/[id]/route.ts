import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const fournisseur = await prisma.fournisseur.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
    include: { commandes: { orderBy: { createdAt: 'desc' }, take: 5 } },
  })

  if (!fournisseur) return apiError('Fournisseur non trouve', 404)
  return apiSuccess(fournisseur)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const fournisseur = await prisma.fournisseur.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
  })
  if (!fournisseur) return apiError('Fournisseur non trouve', 404)

  const body = await request.json()
  const { nom, contact, telephone, email, delaiLivraison } = body

  const updated = await prisma.fournisseur.update({
    where: { id: params.id },
    data: {
      ...(nom && { nom }),
      ...(contact !== undefined && { contact }),
      ...(telephone !== undefined && { telephone }),
      ...(email !== undefined && { email }),
      ...(delaiLivraison !== undefined && { delaiLivraison: delaiLivraison ? parseInt(delaiLivraison) : null }),
    },
  })

  await createAuditLog({
    action: 'FOURNISSEUR_MODIFIE',
    details: { fournisseurId: params.id, nom: updated.nom },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(updated)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const fournisseur = await prisma.fournisseur.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
  })
  if (!fournisseur) return apiError('Fournisseur non trouve', 404)

  await prisma.fournisseur.update({
    where: { id: params.id },
    data: { actif: false },
  })

  await createAuditLog({
    action: 'FOURNISSEUR_ARCHIVE',
    details: { fournisseurId: params.id },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess({ message: 'Fournisseur archive' })
}
