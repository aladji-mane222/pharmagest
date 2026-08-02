import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { notifierAdmins } from '@/lib/notifications'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const users = await prisma.user.findMany({
    // SUPER_ADMIN exclu : ce n'est pas un membre du personnel de CETTE
    // pharmacie, meme si son compte technique y est rattache (contrainte
    // de schema — voir memoire du projet). Un ADMIN ne doit ni le voir
    // ni pouvoir le modifier ici. Corrige le 31/07/2026 suite a un vrai
    // signalement : un admin pouvait modifier/desactiver un SUPER_ADMIN.
    where: { pharmacieId: session.user.pharmacieId, role: { not: 'SUPER_ADMIN' } },
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

  await notifierAdmins(session.user.pharmacieId, {
    type: 'COMPTE_CREE',
    titre: 'Nouveau compte créé',
    message: `${nom} (${role || 'CAISSIER'}) a été ajouté à l'équipe`,
    lien: '/personnel',
  }, session.user.id)

  return apiSuccess(user, 201)
}
