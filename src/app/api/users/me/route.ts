import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import bcrypt from 'bcryptjs'

// GET — infos du compte connecte + ses permissions supplementaires
// actives si CAISSIER (pour affichage sur /profil, section "Mes droits").
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, nom: true, email: true, role: true, createdAt: true },
  })
  if (!user) return apiError('Utilisateur non trouve', 404)

  const permissions = session.user.role === 'CAISSIER'
    ? await prisma.permissionSupplementaire.findMany({
        where: { userId: session.user.id },
        select: { type: true, expireLe: true },
      })
    : []

  const maintenant = new Date()
  const permissionsActives = permissions.filter((p) => !p.expireLe || p.expireLe > maintenant)

  return apiSuccess({ ...user, permissions: permissionsActives })
}

// PATCH — modifie son PROPRE nom, email et/ou mot de passe.
// Distinct de PATCH /api/users/[id] (reserve aux admins, pour gerer les
// AUTRES comptes) : ici pas de verification de role admin, mais un
// changement d'email ou de mot de passe exige l'ancien mot de passe en
// confirmation (contrairement a la reinitialisation admin qui n'en a
// pas besoin). Le role reste volontairement impossible a changer
// soi-meme, meme pour un ADMIN — question de securite. L'email, lui,
// est devenu modifiable le 30/07/2026 : le bloquer completement posait
// un vrai probleme pour un compte ADMIN unique dans une pharmacie (
// personne d'autre a "contacter" pour le changer).
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)

  const body = await request.json().catch(() => ({}))
  const { nom, email, ancienMotDePasse, nouveauMotDePasse } = body

  const data: { nom?: string; email?: string; password?: string } = {}
  // Verifie le mot de passe actuel une seule fois, des qu'un des deux
  // champs sensibles (email ou nouveau mot de passe) est demande.
  const necessiteConfirmationMdp = email !== undefined || nouveauMotDePasse !== undefined
  let user: Awaited<ReturnType<typeof prisma.user.findUnique>> = null

  if (necessiteConfirmationMdp) {
    if (!ancienMotDePasse) {
      return apiError('Le mot de passe actuel est requis pour modifier l\'email ou le mot de passe', 400)
    }
    user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return apiError('Utilisateur non trouve', 404)
    const motDePasseValide = await bcrypt.compare(ancienMotDePasse, user.password)
    if (!motDePasseValide) {
      return apiError('Mot de passe actuel incorrect', 400)
    }
  }

  if (nom !== undefined) {
    if (typeof nom !== 'string' || nom.trim().length < 2) {
      return apiError('Le nom doit contenir au moins 2 caracteres', 400)
    }
    data.nom = nom.trim()
  }

  if (email !== undefined) {
    const emailNormalise = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!emailNormalise || !emailNormalise.includes('@')) {
      return apiError('Email invalide', 400)
    }
    if (emailNormalise !== user?.email) {
      const dejaUtilise = await prisma.user.findUnique({ where: { email: emailNormalise } })
      if (dejaUtilise) return apiError('Cet email est deja utilise par un autre compte', 400)
    }
    data.email = emailNormalise
  }

  if (nouveauMotDePasse !== undefined) {
    if (typeof nouveauMotDePasse !== 'string' || nouveauMotDePasse.length < 6) {
      return apiError('Le nouveau mot de passe doit contenir au moins 6 caracteres', 400)
    }
    data.password = await bcrypt.hash(nouveauMotDePasse, 10)
  }

  if (Object.keys(data).length === 0) {
    return apiError('Aucune modification fournie', 400)
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true, nom: true, email: true, role: true, createdAt: true },
  })

  await createAuditLog({
    action: 'PROFIL_MODIFIE',
    details: { changements: { nom: data.nom, email: data.email, password: data.password ? '(modifie)' : undefined } },
    userId: session.user.id,
    pharmacieId: session.user.pharmacieId,
  })

  return apiSuccess(updated)
}
