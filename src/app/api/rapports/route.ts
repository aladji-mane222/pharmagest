import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/utils'
import { Prisma } from '@prisma/client'
import { TOLERANCE_RETARD_JOURS, calculerNiveauFiabilite } from '@/lib/livraison'
import { getMedicamentsVendusRecemment } from '@/lib/stock'
import { calculerBeneficeNet, calculerEvolution } from '@/lib/rapports'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Non autorise', 401)
  if (session.user.role === 'CAISSIER') return apiError('Acces refuse', 403)

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'ventes'
  const debut = searchParams.get('debut')
    ? new Date(searchParams.get('debut')!)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const fin = searchParams.get('fin') ? new Date(searchParams.get('fin')!) : new Date()
  fin.setHours(23, 59, 59, 999)
  const pharmacieId = session.user.pharmacieId

  if (type === 'ventes') {
    const ventes = await prisma.vente.findMany({
      where: {
        pharmacieId,
        createdAt: { gte: debut, lte: fin },
        statut: 'COMPLETE',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        numeroFacture: true,
        montantTotal: true,
        modePaiement: true,
        createdAt: true,
        user: { select: { nom: true } },
      },
    })

    const total = ventes.reduce((s, v) => s + v.montantTotal, 0)
    const ticketMoyen = ventes.length > 0 ? total / ventes.length : 0

    // Agrégat par caissier
    const caissierMap = new Map<string, { nom: string; nbVentes: number; total: number }>()
    for (const v of ventes) {
      const nom = v.user.nom
      const cur = caissierMap.get(nom) ?? { nom, nbVentes: 0, total: 0 }
      caissierMap.set(nom, { ...cur, nbVentes: cur.nbVentes + 1, total: cur.total + v.montantTotal })
    }
    const parCaissier = Array.from(caissierMap.values()).sort((a, b) => b.total - a.total)

    // Agrégat par mode de paiement
    const modeMap = new Map<string, { mode: string; nbVentes: number; total: number }>()
    for (const v of ventes) {
      const mode = v.modePaiement
      const cur  = modeMap.get(mode) ?? { mode, nbVentes: 0, total: 0 }
      modeMap.set(mode, { ...cur, nbVentes: cur.nbVentes + 1, total: cur.total + v.montantTotal })
    }
    const parMode = Array.from(modeMap.values()).sort((a, b) => b.total - a.total)

    // Top medicaments vendus (quantite + CA genere), sur les lignes des
    // ventes COMPLETE de la periode
    const lignesVente = await prisma.ligneVente.findMany({
      where: { vente: { pharmacieId, createdAt: { gte: debut, lte: fin }, statut: 'COMPLETE' } },
      select: { quantite: true, prixUnitaire: true, medicament: { select: { id: true, nom: true } } },
    })
    const medMap = new Map<string, { nom: string; quantite: number; ca: number }>()
    for (const l of lignesVente) {
      const cur = medMap.get(l.medicament.id) ?? { nom: l.medicament.nom, quantite: 0, ca: 0 }
      medMap.set(l.medicament.id, {
        nom: cur.nom,
        quantite: cur.quantite + l.quantite,
        ca: cur.ca + l.quantite * l.prixUnitaire,
      })
    }
    const topMedicaments = Array.from(medMap.values())
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 10)

    // Comparaison vs periode precedente — meme duree, juste avant "debut"
    const dureeMs = fin.getTime() - debut.getTime()
    const finPrecedente = new Date(debut.getTime() - 1)
    const debutPrecedente = new Date(finPrecedente.getTime() - dureeMs)
    const totalPrecedentAgg = await prisma.vente.aggregate({
      where: {
        pharmacieId,
        createdAt: { gte: debutPrecedente, lte: finPrecedente },
        statut: 'COMPLETE',
      },
      _sum: { montantTotal: true },
    })
    const totalPeriodePrecedente = totalPrecedentAgg._sum.montantTotal ?? 0
    // null = pas de base de comparaison valable (periode precedente a 0
    // GNF de ventes) plutot qu'un pourcentage infini/trompeur
    const evolutionPourcentage =
      totalPeriodePrecedente > 0
        ? Math.round(((total - totalPeriodePrecedente) / totalPeriodePrecedente) * 100)
        : null

    return apiSuccess({
      ventes,
      total,
      ticketMoyen,
      parCaissier,
      parMode,
      topMedicaments,
      comparaison: { totalPeriodePrecedente, evolutionPourcentage },
      type,
    })
  }

  if (type === 'stock') {
    const medicamentsRaw = await prisma.medicament.findMany({
      where: { pharmacieId, actif: true },
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        prixAchat: true,
        stockMinimum: true,
        lots: { where: { actif: true }, select: { quantite: true } },
      },
    })

    // Meme regle "produit dormant" que /api/stock (extraite dans
    // src/lib/stock.ts pour ne jamais diverger) — fenetre fixe de 90j,
    // independante de la periode choisie pour le reste du rapport.
    const medicamentsVendusRecemment = await getMedicamentsVendusRecemment(pharmacieId)

    // Quantite vendue SUR LA PERIODE choisie, pour la rotation
    // approximative (contrairement au statut "dormant" qui regarde
    // toujours 90j glissants peu importe la periode du rapport)
    const lignesVentePeriode = await prisma.ligneVente.findMany({
      where: { vente: { pharmacieId, createdAt: { gte: debut, lte: fin }, statut: 'COMPLETE' } },
      select: { quantite: true, medicamentId: true },
    })
    const quantiteVendueParMed = new Map<string, number>()
    for (const l of lignesVentePeriode) {
      quantiteVendueParMed.set(l.medicamentId, (quantiteVendueParMed.get(l.medicamentId) ?? 0) + l.quantite)
    }

    const stock = medicamentsRaw.map(({ lots, ...m }) => {
      const stockTotal = lots.reduce((s, l) => s + l.quantite, 0)
      const quantiteVendue = quantiteVendueParMed.get(m.id) ?? 0
      // Rotation approximative : quantite vendue sur la periode / stock
      // actuel. Indicatif seulement (le stock actuel n'est pas le stock
      // moyen sur la periode, faute d'historique de niveau de stock) —
      // utile pour reperer les produits qui bougent vite vs lentement,
      // pas un vrai taux de rotation comptable.
      const rotation = stockTotal > 0 ? Math.round((quantiteVendue / stockTotal) * 100) / 100 : null
      const produitDormant = stockTotal > 0 && !medicamentsVendusRecemment.has(m.id)
      return {
        ...m,
        stockTotal,
        valeur: stockTotal * (m.prixAchat || 0),
        quantiteVendue,
        rotation,
        produitDormant,
      }
    })
    const valeurTotale = stock.reduce((s, m) => s + m.valeur, 0)
    const nbProduitsDormants = stock.filter((m) => m.produitDormant).length

    return apiSuccess({ stock, valeurTotale, nbProduitsDormants, type })
  }

  if (type === 'benefice') {
    const { ca, cmv, totalDepenses, beneficeNet, panierMoyen, nbVentes } =
      await calculerBeneficeNet(pharmacieId, debut, fin)

    // Repartition des depenses par categorie sur la meme periode (pour le
    // graphique 4.6, camembert)
    const depensesParCategorie = await prisma.depense.groupBy({
      by: ['categorie'],
      where: { pharmacieId, createdAt: { gte: debut, lte: fin }, archivee: false },
      _sum: { montant: true },
    })
    const repartitionDepenses = depensesParCategorie
      .map((d) => ({ categorie: d.categorie, montant: d._sum.montant ?? 0 }))
      .sort((a, b) => b.montant - a.montant)

    return apiSuccess({
      ca, cmv, totalDepenses, beneficeNet, panierMoyen, nbVentes, repartitionDepenses, type,
    })
  }

  if (type === 'kpi') {
    // Resume KPI en tete de page (Phase 4.5) — toujours "ce mois-ci" vs
    // "mois precedent", independant de la periode selectionnee dans le
    // filtre du rapport (qui sert au rapport detaille, pas a ce resume).
    const maintenant        = new Date()
    const debutMoisActuel   = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)
    const finMoisPrecedent  = new Date(debutMoisActuel.getTime() - 1)
    const debutMoisPrecedent = new Date(finMoisPrecedent.getFullYear(), finMoisPrecedent.getMonth(), 1)

    const [actuel, precedent] = await Promise.all([
      calculerBeneficeNet(pharmacieId, debutMoisActuel, maintenant),
      calculerBeneficeNet(pharmacieId, debutMoisPrecedent, finMoisPrecedent),
    ])

    return apiSuccess({
      type,
      actuel,
      precedent,
      evolution: {
        ca:            calculerEvolution(actuel.ca, precedent.ca),
        beneficeNet:   calculerEvolution(actuel.beneficeNet, precedent.beneficeNet),
        totalDepenses: calculerEvolution(actuel.totalDepenses, precedent.totalDepenses),
        panierMoyen:   calculerEvolution(actuel.panierMoyen, precedent.panierMoyen),
      },
    })
  }

  if (type === 'graphique-benefice') {
    // Evolution du benefice net jour par jour sur les 30 derniers jours,
    // fixe (pas lie a la periode selectionnee dans le filtre — c'est une
    // tendance de fond affichee en contexte du rapport Benefice).
    // 3 requetes agregees groupees par jour plutot qu'une boucle de 30
    // requetes (latence Guinee-Europe deja documentee dans le projet).
    const [caParJour, cmvParJour, depensesParJour] = await Promise.all([
      prisma.$queryRaw<{ jour: Date; ca: number }[]>(
        Prisma.sql`
          SELECT DATE("createdAt") as jour, COALESCE(SUM("montantTotal"), 0)::float as ca
          FROM "Vente"
          WHERE "pharmacieId" = ${pharmacieId} AND statut = 'COMPLETE'
            AND "createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY DATE("createdAt")
        `
      ),
      prisma.$queryRaw<{ jour: Date; cmv: number }[]>(
        Prisma.sql`
          SELECT DATE(v."createdAt") as jour, COALESCE(SUM(lv.quantite * m."prixAchat"), 0)::float as cmv
          FROM "LigneVente" lv
          JOIN "Vente" v ON v.id = lv."venteId"
          JOIN "Medicament" m ON m.id = lv."medicamentId"
          WHERE v."pharmacieId" = ${pharmacieId} AND v.statut = 'COMPLETE'
            AND v."createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(v."createdAt")
        `
      ),
      prisma.$queryRaw<{ jour: Date; depenses: number }[]>(
        Prisma.sql`
          SELECT DATE("createdAt") as jour, COALESCE(SUM(montant), 0)::float as depenses
          FROM "Depense"
          WHERE "pharmacieId" = ${pharmacieId} AND archivee = false
            AND "createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY DATE("createdAt")
        `
      ),
    ])

    const caMap       = new Map(caParJour.map((r) => [r.jour.toISOString().slice(0, 10), r.ca]))
    const cmvMap       = new Map(cmvParJour.map((r) => [r.jour.toISOString().slice(0, 10), r.cmv]))
    const depensesMap = new Map(depensesParJour.map((r) => [r.jour.toISOString().slice(0, 10), r.depenses]))

    const jours: { date: string; beneficeNet: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const cle = d.toISOString().slice(0, 10)
      const ca = caMap.get(cle) ?? 0
      const cmv = cmvMap.get(cle) ?? 0
      const dep = depensesMap.get(cle) ?? 0
      jours.push({
        date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        beneficeNet: ca - cmv - dep,
      })
    }

    return apiSuccess({ type, jours })
  }


  if (type === 'credits') {
    const clients = await prisma.client.findMany({
      where: { pharmacieId, actif: true, soldeCredit: { gt: 0 } },
      orderBy: { soldeCredit: 'desc' },
    })
    const totalDu = clients.reduce((s, c) => s + c.soldeCredit, 0)

    // Anciennete approximative : date de la plus ancienne vente a credit
    // (PARTIELLE) du client. Approximatif car ca ne tient pas compte des
    // remboursements partiels deja effectues depuis (meme logique
    // "indicatif" que la rotation de stock, Phase 4.3) — pas de suivi
    // evenementiel du solde dans le temps dans le schema actuel.
    const clientIds = clients.map((c) => c.id)
    const plusAncienneVenteParClient = await prisma.vente.groupBy({
      by: ['clientId'],
      where: { pharmacieId, statut: 'PARTIELLE', clientId: { in: clientIds } },
      _min: { createdAt: true },
    })
    const depuisLeParClient = new Map<string, Date>()
    for (const row of plusAncienneVenteParClient) {
      if (row.clientId && row._min.createdAt) depuisLeParClient.set(row.clientId, row._min.createdAt)
    }

    const MS_PAR_JOUR = 24 * 60 * 60 * 1000
    const clientsAvecAnciennete = clients.map((c) => {
      const depuisLe = depuisLeParClient.get(c.id) ?? null
      const ancienneteJours = depuisLe ? Math.floor((Date.now() - depuisLe.getTime()) / MS_PAR_JOUR) : null
      const tranche =
        ancienneteJours === null ? 'inconnue' : ancienneteJours <= 30 ? '0-30' : ancienneteJours <= 60 ? '31-60' : '60+'
      return { ...c, depuisLe, ancienneteJours, tranche }
    })

    const tranches = ['0-30', '31-60', '60+', 'inconnue'] as const
    const parTranche = tranches
      .map((t) => {
        const clientsTranche = clientsAvecAnciennete.filter((c) => c.tranche === t)
        return {
          tranche: t,
          nbClients: clientsTranche.length,
          montant: clientsTranche.reduce((s, c) => s + c.soldeCredit, 0),
        }
      })
      .filter((t) => t.nbClients > 0)

    return apiSuccess({ clients: clientsAvecAnciennete, totalDu, parTranche, type })
  }

  if (type === 'commandes') {
    // BROUILLON exclue (jamais envoyee, pas une activite reelle) et ANNULEE
    // exclue des montants (meme principe que les ventes ANNULEE deja
    // exclues du CA — une commande annulee n'est pas une depense reelle).
    const commandes = await prisma.commandeFournisseur.findMany({
      where: {
        pharmacieId,
        createdAt: { gte: debut, lte: fin },
        statut: { in: ['ENVOYEE', 'RECUE'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        numeroCommande: true,
        statut: true,
        createdAt: true,
        dateLivraisonPrevue: true,
        dateReception: true,
        fournisseur: { select: { nom: true } },
        lignes: { select: { quantite: true, quantiteRecue: true, prixUnitaire: true } },
      },
    })

    const commandesEnrichies = commandes.map((c) => {
      const montantCommande = c.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0)
      const montantRecu = c.lignes.reduce((s, l) => s + (l.quantiteRecue ?? 0) * l.prixUnitaire, 0)
      // en retard : uniquement calculable si recue avec les deux dates
      // renseignees — meme regle de tolerance que /api/fournisseurs, pour
      // que le badge par commande et la fiabilite globale ne divergent
      // jamais (cf. src/lib/livraison.ts)
      const enRetard =
        c.statut === 'RECUE' && c.dateLivraisonPrevue && c.dateReception
          ? c.dateReception.getTime() > c.dateLivraisonPrevue.getTime() + TOLERANCE_RETARD_JOURS * 86_400_000
          : null
      return {
        id: c.id,
        numeroCommande: c.numeroCommande,
        statut: c.statut,
        createdAt: c.createdAt,
        fournisseur: c.fournisseur,
        montantCommande,
        montantRecu,
        enRetard,
      }
    })

    const montantTotalCommande = commandesEnrichies.reduce((s, c) => s + c.montantCommande, 0)
    const montantTotalRecu = commandesEnrichies.reduce((s, c) => s + c.montantRecu, 0)

    // Repartition par fournisseur
    const fournisseurMap = new Map<string, { nom: string; nbCommandes: number; montantCommande: number }>()
    for (const c of commandesEnrichies) {
      const nom = c.fournisseur.nom
      const cur = fournisseurMap.get(nom) ?? { nom, nbCommandes: 0, montantCommande: 0 }
      fournisseurMap.set(nom, {
        ...cur,
        nbCommandes: cur.nbCommandes + 1,
        montantCommande: cur.montantCommande + c.montantCommande,
      })
    }
    const parFournisseur = Array.from(fournisseurMap.values()).sort(
      (a, b) => b.montantCommande - a.montantCommande
    )

    // Fiabilite globale sur la periode (meme fonction que /api/fournisseurs)
    const recuesAvecDates = commandesEnrichies.filter((c) => c.enRetard !== null)
    const commandesATemps = recuesAvecDates.filter((c) => c.enRetard === false).length
    const { pourcentageATemps, niveau } = calculerNiveauFiabilite(
      recuesAvecDates.length,
      commandesATemps
    )

    // Ecarts de livraison (quantite recue != quantite commandee), sur les
    // lignes des commandes de la periode
    const lignesAvecReception = await prisma.ligneCommande.findMany({
      where: {
        commande: { pharmacieId, createdAt: { gte: debut, lte: fin } },
        quantiteRecue: { not: null },
      },
      select: { quantite: true, quantiteRecue: true, prixUnitaire: true },
    })
    const lignesEnEcart = lignesAvecReception.filter((l) => l.quantiteRecue !== l.quantite)
    const nombreEcarts = lignesEnEcart.length
    const valeurEcarts = lignesEnEcart.reduce(
      (s, l) => s + Math.abs(l.quantite - (l.quantiteRecue ?? 0)) * l.prixUnitaire,
      0
    )

    return apiSuccess({
      type,
      commandes: commandesEnrichies,
      montantTotalCommande,
      montantTotalRecu,
      parFournisseur,
      fiabilite: {
        totalCommandesRecues: recuesAvecDates.length,
        commandesATemps,
        pourcentageATemps,
        niveau,
      },
      ecarts: { nombre: nombreEcarts, valeur: valeurEcarts },
    })
  }

  return apiError('Type de rapport non reconnu', 400)
}