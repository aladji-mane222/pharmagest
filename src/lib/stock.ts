import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// 90 jours : meme convention que le seuil de peremption proche et la
// fenetre de fiabilite fournisseur deja utilises ailleurs dans l'app —
// pour ne pas ajouter un nouveau chiffre "magique" de plus.
// Centralise ici (extrait de /api/stock en Phase 4, 22/07/2026) pour que
// /api/stock et /api/rapports ne divergent jamais sur cette regle.
export const FENETRE_DORMANT_JOURS = 90

export async function getMedicamentsVendusRecemment(pharmacieId: string): Promise<Set<string>> {
  // Un seul aller-retour pour recuperer tous les medicaments vendus
  // recemment, plutot qu'une requete "derniere vente" par medicament
  // (latence Guinee-Europe deja documentee dans le projet)
  const rows = await prisma.$queryRaw<{ medicamentId: string }[]>(
    Prisma.sql`
      SELECT DISTINCT lv."medicamentId"
      FROM "LigneVente" lv
      JOIN "Vente" v ON v.id = lv."venteId"
      WHERE v."pharmacieId" = ${pharmacieId}
        AND v.statut != 'ANNULEE'
        AND v."createdAt" >= NOW() - (${FENETRE_DORMANT_JOURS}::int * INTERVAL '1 day')
    `
  )
  return new Set(rows.map((r) => r.medicamentId))
}