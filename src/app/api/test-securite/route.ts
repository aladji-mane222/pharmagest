import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'ADMIN') {
    return apiError('Acces refuse', 403)
  }

  const pharmacieId = session.user.pharmacieId
  const resultats = []

  // Test 1 : isolation multi-tenant medicaments
  const tousLesMedicaments = await prisma.medicament.count()
  const mesMedicaments = await prisma.medicament.count({ where: { pharmacieId } })
  resultats.push({
    test: 'Isolation medicaments',
    statut: mesMedicaments < tousLesMedicaments ? 'OK' : 'A_VERIFIER',
    details: `${mesMedicaments} sur ${tousLesMedicaments} medicaments visibles`,
  })

  // Test 2 : isolation ventes
  const toutesLesVentes = await prisma.vente.count()
  const mesVentes = await prisma.vente.count({ where: { pharmacieId } })
  resultats.push({
    test: 'Isolation ventes',
    statut: mesVentes <= toutesLesVentes ? 'OK' : 'ECHEC',
    details: `${mesVentes} sur ${toutesLesVentes} ventes visibles`,
  })

  // Test 3 : isolation clients
  const tousLesClients = await prisma.client.count()
  const mesClients = await prisma.client.count({ where: { pharmacieId } })
  resultats.push({
    test: 'Isolation clients',
    statut: mesClients <= tousLesClients ? 'OK' : 'ECHEC',
    details: `${mesClients} sur ${tousLesClients} clients visibles`,
  })

  return apiSuccess({ resultats, pharmacieId })
}
