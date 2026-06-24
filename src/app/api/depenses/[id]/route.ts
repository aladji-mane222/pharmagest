import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session) return apiError('Non autorise', 401)
    if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

    const pharmacieId = session.user.pharmacieId

    const depense = await prisma.depense.findFirst({
        where: { id: params.id, pharmacieId },
    })
    if (!depense) return apiError('Depense non trouvee', 404)

    const body = await request.json()
    const { libelle, montant, categorie } = body

    const dataToUpdate: { libelle?: string; montant?: number; categorie?: string | null } = {}
    if (libelle !== undefined) dataToUpdate.libelle = libelle
    if (montant !== undefined) {
        const montantFloat = parseFloat(montant)
        if (isNaN(montantFloat) || montantFloat <= 0) return apiError('Montant invalide', 400)
        dataToUpdate.montant = montantFloat
    }
    if (categorie !== undefined) dataToUpdate.categorie = categorie || null

    const updated = await prisma.depense.update({
        where: { id: params.id },
        data: dataToUpdate,
    })

    await createAuditLog({
        action: 'DEPENSE_MODIFIEE',
        details: { depenseId: params.id, changements: dataToUpdate },
        userId: session.user.id,
        pharmacieId,
    })

    return apiSuccess(updated)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session) return apiError('Non autorise', 401)
    if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

    const pharmacieId = session.user.pharmacieId

    const depense = await prisma.depense.findFirst({
        where: { id: params.id, pharmacieId },
    })
    if (!depense) return apiError('Depense non trouvee', 404)
    if (depense.archivee) return apiError('Depense deja archivee', 400)

    // Archivage logique uniquement — jamais de suppression physique
    const archived = await prisma.depense.update({
        where: { id: params.id },
        data: { archivee: true },
    })

    await createAuditLog({
        action: 'DEPENSE_ARCHIVEE',
        details: { depenseId: params.id, libelle: depense.libelle },
        userId: session.user.id,
        pharmacieId,
    })

    return apiSuccess(archived)
}