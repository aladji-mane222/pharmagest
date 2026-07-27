import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

const TYPES_VALIDES = ['INVENTAIRE_COMPLET', 'ANNULER_VENTE', 'HISTORIQUE_COMPLET', 'ACCES_RAPPORTS']

// GET — liste les permissions supplementaires (actives ou expirees) d'un
// utilisateur, pour affichage dans /personnel.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return apiError('Acces refuse', 403)
  }

  const pharmacieId = session.user.pharmacieId
  const user = await prisma.user.findFirst({ where: { id: params.id, pharmacieId } })
  if (!user) return apiError('Utilisateur non trouve', 404)

  const permissions = await prisma.permissionSupplementaire.findMany({
    where: { userId: params.id },
    include: { accordePar: { select: { nom: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return apiSuccess(permissions)
}

// PUT — accorde ou met a jour une permission (upsert sur userId+type).
// expireLe: null ou absent = permanent.
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return apiError('Acces refuse', 403)
  }

  const pharmacieId = session.user.pharmacieId
  const user = await prisma.user.findFirst({ where: { id: params.id, pharmacieId } })
  if (!user) return apiError('Utilisateur non trouve', 404)
  if (user.role !== 'CAISSIER') {
    return apiError('Les permissions supplementaires ne concernent que les comptes CAISSIER — un ADMIN a deja tous les droits', 400)
  }

  const body = await request.json().catch(() => ({}))
  const { type, expireLe } = body

  if (!TYPES_VALIDES.includes(type)) {
    return apiError(`Type de permission invalide. Valeurs possibles : ${TYPES_VALIDES.join(', ')}`, 400)
  }

  let expireLeDate: Date | null = null
  if (expireLe) {
    expireLeDate = new Date(expireLe)
    if (isNaN(expireLeDate.getTime())) {
      return apiError('Date d\'expiration invalide', 400)
    }
    if (expireLeDate <= new Date()) {
      return apiError('La date d\'expiration doit etre dans le futur', 400)
    }
  }

  const permission = await prisma.permissionSupplementaire.upsert({
    where: { userId_type: { userId: params.id, type } },
    create: {
      userId: params.id,
      type,
      expireLe: expireLeDate,
      accordeParId: session.user.id,
    },
    update: {
      expireLe: expireLeDate,
      accordeParId: session.user.id,
    },
  })

  await createAuditLog({
    action: 'PERMISSION_ACCORDEE',
    details: {
      userId: params.id,
      userNom: user.nom,
      type,
      expireLe: expireLeDate ? expireLeDate.toISOString() : 'permanent',
    },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess(permission)
}

// DELETE — revoque une permission (?type=... en query string)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return apiError('Acces refuse', 403)
  }

  const pharmacieId = session.user.pharmacieId
  const user = await prisma.user.findFirst({ where: { id: params.id, pharmacieId } })
  if (!user) return apiError('Utilisateur non trouve', 404)

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  if (!type || !TYPES_VALIDES.includes(type)) {
    return apiError(`Type de permission invalide. Valeurs possibles : ${TYPES_VALIDES.join(', ')}`, 400)
  }

  await prisma.permissionSupplementaire.deleteMany({
    where: { userId: params.id, type: type as any },
  })

  await createAuditLog({
    action: 'PERMISSION_REVOQUEE',
    details: { userId: params.id, userNom: user.nom, type },
    userId: session.user.id,
    pharmacieId,
  })

  return apiSuccess({ message: 'Permission revoquee' })
}
