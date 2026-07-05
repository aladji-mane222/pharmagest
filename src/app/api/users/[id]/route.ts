import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import bcrypt from 'bcryptjs'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return apiError('Acces refuse', 403)
  }

  const pharmacieId = session.user.pharmacieId

  const user = await prisma.user.findFirst({
    where: { id: params.id, pharmacieId },
  })
  if (!user) return apiError('Utilisateur non trouve', 404)

  // Empêcher de se désactiver soi-même
  if (params.id === session.user.id) {
    return apiError('Vous ne pouvez pas modifier votre propre compte ici', 400)
  }

  const body = await request.json()
  const { nom, role, actif, nouveauMotDePasse } = body

  const data: { nom?: string; role?: any; actif?: boolean; password?: string } = {}
  if (nom  !== undefined) data.nom  = nom
  if (role !== undefined) data.role = role
  if (actif !== undefined) data.actif = actif

  // Réinitialisation de mot de passe (ex: employé qui l'a oublié) —
  // ajoutée le 04/07/2026, absente jusqu'ici : aucun moyen de débloquer
  // un compte dont le mot de passe était perdu.
  if (nouveauMotDePasse !== undefined) {
    if (typeof nouveauMotDePasse !== 'string' || nouveauMotDePasse.length < 6) {
      return apiError('Le nouveau mot de passe doit contenir au moins 6 caracteres', 400)
    }
    data.password = await bcrypt.hash(nouveauMotDePasse, 10)
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, nom: true, email: true, role: true, actif: true, createdAt: true },
  })

  await createAuditLog({
    action:  'USER_MODIFIE',
    // Ne jamais logger le mot de passe lui-même, seulement le fait qu'il a changé
    details: { userId: params.id, changements: { ...data, password: data.password ? '(modifie)' : undefined } },
    userId:  session.user.id,
    pharmacieId,
  })

  return apiSuccess(updated)
}