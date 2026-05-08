import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const users = await prisma.user.findMany({
    where: { pharmacieId: session.user.pharmacieId },
    select: { id: true, nom: true, email: true, role: true, actif: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return apiSuccess(users)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return apiError('Acces refuse', 403)
  }

  const body = await request.json()
  const { nom, email, password, role } = body

  if (!nom || !email || !password) return apiError('Nom, email et mot de passe requis', 400)

  const existant = await prisma.user.findUnique({ where: { email } })
  if (existant) return apiError('Email deja utilise', 400)

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      nom,
      email,
      password: hashedPassword,
      role: role || 'CAISSIER',
      pharmacieId: session.user.pharmacieId,
    },
    select: { id: true, nom: true, email: true, role: true, actif: true, createdAt: true },
  })

  await createAuditLog({
    action: 'USER_CREE',
    details: { userId: user.id, nom, role },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(user, 201)
}
