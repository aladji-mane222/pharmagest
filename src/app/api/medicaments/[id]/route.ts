import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const medicament = await prisma.medicament.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId, actif: true },
    include: { lots: { where: { actif: true }, orderBy: { datePeremption: 'asc' } } },
  })

  if (!medicament) return apiError('Medicament non trouve', 404)

  const stockTotal = medicament.lots.reduce((sum, lot) => sum + lot.quantite, 0)
  return apiSuccess({ ...medicament, stockTotal })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const medicament = await prisma.medicament.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
  })
  if (!medicament) return apiError('Medicament non trouve', 404)

  const body = await request.json()
  const { nom, description, categorie, unite, prixVente, prixAchat, stockMinimum } = body

  const updated = await prisma.medicament.update({
    where: { id: params.id },
    data: {
      ...(nom && { nom }),
      ...(description !== undefined && { description }),
      ...(categorie !== undefined && { categorie }),
      ...(unite && { unite }),
      ...(prixVente && { prixVente: parseFloat(prixVente) }),
      ...(prixAchat !== undefined && { prixAchat: prixAchat ? parseFloat(prixAchat) : null }),
      ...(stockMinimum && { stockMinimum: parseInt(stockMinimum) }),
    },
  })

  await createAuditLog({
    action: 'MEDICAMENT_MODIFIE',
    details: { medicamentId: updated.id, nom: updated.nom },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(updated)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const medicament = await prisma.medicament.findFirst({
    where: { id: params.id, pharmacieId: session.user.pharmacieId },
  })
  if (!medicament) return apiError('Medicament non trouve', 404)

  await prisma.medicament.update({
    where: { id: params.id },
    data: { actif: false },
  })

  await createAuditLog({
    action: 'MEDICAMENT_ARCHIVE',
    details: { medicamentId: params.id, nom: medicament.nom },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess({ message: 'Medicament archive avec succes' })
}
