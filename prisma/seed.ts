import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────

function joursAvant(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(10, 0, 0, 0)
  return d
}

function joursApres(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

// ─────────────────────────────────────────────────────────────────
// PHARMACIE PILOTE
// ─────────────────────────────────────────────────────────────────

async function seedPharmacicPilote() {
  console.log('\n📍 Pharmacie pilote...')

  const pharmacie = await prisma.pharmacie.upsert({
    where: { id: 'pharmacie-pilote-001' },
    update: {},
    create: {
      id: 'pharmacie-pilote-001',
      nom: 'Pharmacie Centrale de Conakry',
      adresse: 'Kaloum, Conakry, Guinée',
      telephone: '+224 620 000 000',
      email: 'contact@pharmaciecentrale.gn',
      licenceActive: true,
    },
  })

  const adminPassword = await bcrypt.hash('Admin1234!', 10)
  const caissierPassword = await bcrypt.hash('Caissier1234!', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@pharmaciecentrale.gn' },
    update: {},
    create: {
      nom: 'Administrateur',
      email: 'admin@pharmaciecentrale.gn',
      password: adminPassword,
      role: 'ADMIN',
      pharmacieId: pharmacie.id,
    },
  })

  const caissier = await prisma.user.upsert({
    where: { email: 'caissier@pharmaciecentrale.gn' },
    update: {},
    create: {
      nom: 'Caissier Principal',
      email: 'caissier@pharmaciecentrale.gn',
      password: caissierPassword,
      role: 'CAISSIER',
      pharmacieId: pharmacie.id,
    },
  })

  // Médicaments pilote avec pharmacieId correct
  const medsPilote = [
    { id: 'med-pilote-para',   nom: 'Paracétamol 500mg',   categorie: 'Analgésique',        prixVente: 5000,  prixAchat: 2000, stockMinimum: 50 },
    { id: 'med-pilote-amoxi',  nom: 'Amoxicilline 250mg',  categorie: 'Antibiotique',        prixVente: 15000, prixAchat: 8000, stockMinimum: 30 },
    { id: 'med-pilote-chloro', nom: 'Chloroquine 100mg',   categorie: 'Antipaludéen',        prixVente: 3000,  prixAchat: 1500, stockMinimum: 80 },
    { id: 'med-pilote-ibu',    nom: 'Ibuprofène 400mg',    categorie: 'Anti-inflammatoire',  prixVente: 8000,  prixAchat: 4000, stockMinimum: 40 },
    { id: 'med-pilote-metro',  nom: 'Métronidazole 250mg', categorie: 'Antibiotique',        prixVente: 6000,  prixAchat: 3000, stockMinimum: 30 },
  ]

  for (const med of medsPilote) {
    await prisma.medicament.upsert({
      where: { id: med.id },
      update: {},
      create: { ...med, pharmacieId: pharmacie.id },
    })

    // Lot avec pharmacieId — champ obligatoire depuis Session A
    const lotId = `lot-pilote-${med.id}`
    const existing = await prisma.lot.findFirst({ where: { id: lotId } })
    if (!existing) {
      await prisma.lot.create({
        data: {
          id: lotId,
          numeroLot: `LOT-PILOTE-${med.id.slice(-4).toUpperCase()}`,
          datePeremption: new Date('2027-12-31'),
          quantite: 100,
          prixAchat: med.prixAchat,
          medicamentId: med.id,
          pharmacieId: pharmacie.id,
        },
      })
    }
  }

  await prisma.fournisseur.upsert({
    where: { id: 'fournisseur-pilote-001' },
    update: {},
    create: {
      id: 'fournisseur-pilote-001',
      nom: 'Pharmadis Guinée',
      contact: 'Mamadou Diallo',
      telephone: '+224 622 111 222',
      email: 'contact@pharmadis.gn',
      delaiLivraison: 3,
      pharmacieId: pharmacie.id,
    },
  })

  console.log('  ✅ Pharmacie pilote prête')
  console.log(`  👤 admin@pharmaciecentrale.gn / Admin1234!`)
  console.log(`  👤 caissier@pharmaciecentrale.gn / Caissier1234!`)
  return { pharmacie, admin, caissier }
}

// ─────────────────────────────────────────────────────────────────
// PHARMACIE DÉMO
// ─────────────────────────────────────────────────────────────────

async function seedPharmacieDemo() {
  console.log('\n🎭 Pharmacie démo...')

  const pharmacie = await prisma.pharmacie.upsert({
    where: { id: 'pharmacie-demo-001' },
    update: {},
    create: {
      id: 'pharmacie-demo-001',
      nom: 'Pharmacie Horizon',
      adresse: 'Dixinn, Conakry, Guinée',
      telephone: '+224 625 000 001',
      email: 'contact@pharmaciehorizon.gn',
      licenceActive: true,
    },
  })

  // ── Utilisateurs ──────────────────────────────────────────────
  const pass = await bcrypt.hash('Demo1234!', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.pharmagest.com' },
    update: {},
    create: {
      id: 'user-demo-admin',
      nom: 'Aissatou Baldé',
      email: 'admin@demo.pharmagest.com',
      password: pass,
      role: 'ADMIN',
      pharmacieId: pharmacie.id,
    },
  })

  const caissier1 = await prisma.user.upsert({
    where: { email: 'fatou@demo.pharmagest.com' },
    update: {},
    create: {
      id: 'user-demo-caissier1',
      nom: 'Fatou Camara',
      email: 'fatou@demo.pharmagest.com',
      password: pass,
      role: 'CAISSIER',
      pharmacieId: pharmacie.id,
    },
  })

  const caissier2 = await prisma.user.upsert({
    where: { email: 'mamadou@demo.pharmagest.com' },
    update: {},
    create: {
      id: 'user-demo-caissier2',
      nom: 'Mamadou Diallo',
      email: 'mamadou@demo.pharmagest.com',
      password: pass,
      role: 'CAISSIER',
      pharmacieId: pharmacie.id,
    },
  })

  const caissier3 = await prisma.user.upsert({
    where: { email: 'ibrahima@demo.pharmagest.com' },
    update: {},
    create: {
      id: 'user-demo-caissier3',
      nom: 'Ibrahima Sylla',
      email: 'ibrahima@demo.pharmagest.com',
      password: pass,
      role: 'CAISSIER',
      pharmacieId: pharmacie.id,
    },
  })

  // ── Médicaments (15 courants en Guinée) ───────────────────────
  const medsDemo = [
    // Antipaludéens — très courants en Guinée
    { id: 'med-demo-arthemeter',  nom: 'Arthémether/Luméfantrine 20/120mg', categorie: 'Antipaludéen',        prixVente: 25000, prixAchat: 14000, stockMinimum: 50,  quantiteLot: 120 },
    { id: 'med-demo-chloro',      nom: 'Chloroquine 100mg',                 categorie: 'Antipaludéen',        prixVente: 3000,  prixAchat: 1200,  stockMinimum: 100, quantiteLot: 300 },
    { id: 'med-demo-quinine',     nom: 'Quinine 300mg',                     categorie: 'Antipaludéen',        prixVente: 8000,  prixAchat: 4500,  stockMinimum: 60,  quantiteLot: 150 },
    // Antibiotiques
    { id: 'med-demo-amoxi250',    nom: 'Amoxicilline 250mg',                categorie: 'Antibiotique',        prixVente: 12000, prixAchat: 6000,  stockMinimum: 40,  quantiteLot: 80  },
    { id: 'med-demo-amoxi500',    nom: 'Amoxicilline 500mg',                categorie: 'Antibiotique',        prixVente: 18000, prixAchat: 10000, stockMinimum: 30,  quantiteLot: 60  },
    { id: 'med-demo-metro',       nom: 'Métronidazole 250mg',               categorie: 'Antibiotique',        prixVente: 6000,  prixAchat: 2800,  stockMinimum: 30,  quantiteLot: 90  },
    // Analgésiques / antipyrétiques
    { id: 'med-demo-para500',     nom: 'Paracétamol 500mg',                 categorie: 'Analgésique',         prixVente: 5000,  prixAchat: 1800,  stockMinimum: 80,  quantiteLot: 400 },
    { id: 'med-demo-ibu400',      nom: 'Ibuprofène 400mg',                  categorie: 'Anti-inflammatoire',  prixVente: 8000,  prixAchat: 3500,  stockMinimum: 40,  quantiteLot: 200 },
    // Vitamines & compléments
    { id: 'med-demo-vitc',        nom: 'Vitamine C 500mg',                  categorie: 'Vitamine',            prixVente: 4000,  prixAchat: 1500,  stockMinimum: 50,  quantiteLot: 250 },
    { id: 'med-demo-vitb',        nom: 'Vitamine B Complex',                categorie: 'Vitamine',            prixVente: 7500,  prixAchat: 3500,  stockMinimum: 30,  quantiteLot: 100 },
    { id: 'med-demo-fer',         nom: 'Sulfate de Fer 200mg',              categorie: 'Vitamine',            prixVente: 5000,  prixAchat: 2200,  stockMinimum: 40,  quantiteLot: 150 },
    // Antidiarrhéiques / digestifs
    { id: 'med-demo-ors',         nom: 'SRO — Sels de Réhydratation',       categorie: 'Antidiarrhéique',     prixVente: 2500,  prixAchat: 800,   stockMinimum: 100, quantiteLot: 500 },
    { id: 'med-demo-smecta',      nom: 'Diosmectite 3g',                    categorie: 'Antidiarrhéique',     prixVente: 6000,  prixAchat: 2500,  stockMinimum: 30,  quantiteLot: 80  },
    // Antiparasitaires
    { id: 'med-demo-mebenda',     nom: 'Mébendazole 100mg',                 categorie: 'Antiparasitaire',     prixVente: 4500,  prixAchat: 1800,  stockMinimum: 40,  quantiteLot: 120 },
    // Stock bas intentionnel pour tester les alertes
    { id: 'med-demo-cotri',       nom: 'Cotrimoxazole 480mg',               categorie: 'Antibiotique',        prixVente: 7000,  prixAchat: 3000,  stockMinimum: 60,  quantiteLot: 8   },
  ]

  for (const med of medsDemo) {
    const { quantiteLot, ...medData } = med
    await prisma.medicament.upsert({
      where: { id: med.id },
      update: {},
      create: { ...medData, pharmacieId: pharmacie.id },
    })
  }

  // ── Lots (2 par médicament — dont des péremptions proches) ────
  // Lot standard péremption 2027
  for (const med of medsDemo) {
    const lotId = `lot-demo-${med.id}-a`
    const existing = await prisma.lot.findFirst({ where: { id: lotId } })
    if (!existing) {
      await prisma.lot.create({
        data: {
          id: lotId,
          numeroLot: `LOT-2026-${med.id.slice(-3).toUpperCase()}-A`,
          datePeremption: new Date('2027-06-30'),
          quantite: med.quantiteLot,
          prixAchat: med.prixAchat,
          medicamentId: med.id,
          pharmacieId: pharmacie.id,
        },
      })
    }
  }

  // 2 lots supplémentaires qui expirent bientôt (< 90 jours) — pour déclencher les alertes
  const lotsPeremptionProche = [
    { id: 'lot-demo-expiry-1', medicamentId: 'med-demo-quinine',  datePeremption: joursApres(45),  quantite: 20, prixAchat: 4500, numeroLot: 'LOT-EXPIRE-QUI' },
    { id: 'lot-demo-expiry-2', medicamentId: 'med-demo-vitb',     datePeremption: joursApres(70),  quantite: 15, prixAchat: 3500, numeroLot: 'LOT-EXPIRE-VIT' },
  ]

  for (const lot of lotsPeremptionProche) {
    const existing = await prisma.lot.findFirst({ where: { id: lot.id } })
    if (!existing) {
      await prisma.lot.create({
        data: { ...lot, pharmacieId: pharmacie.id },
      })
    }
  }

  // ── Fournisseur ───────────────────────────────────────────────
  await prisma.fournisseur.upsert({
    where: { id: 'fournisseur-demo-001' },
    update: {},
    create: {
      id: 'fournisseur-demo-001',
      nom: 'Laborex Guinée',
      contact: 'Ousmane Kouyaté',
      telephone: '+224 628 444 555',
      email: 'commandes@laborex.gn',
      delaiLivraison: 2,
      pharmacieId: pharmacie.id,
    },
  })

  // ── Clients ───────────────────────────────────────────────────
  const clients = [
    { id: 'client-demo-1', nom: 'Mariama Bah',      telephone: '+224 621 100 001', soldeCredit: 0,     plafondCredit: 50000 },
    { id: 'client-demo-2', nom: 'Oumar Touré',       telephone: '+224 622 100 002', soldeCredit: 32000, plafondCredit: 50000 },  // crédit en cours
    { id: 'client-demo-3', nom: 'Kadiatou Diallo',   telephone: '+224 623 100 003', soldeCredit: 18500, plafondCredit: 75000 },  // crédit en cours
    { id: 'client-demo-4', nom: 'Seydou Konaté',     telephone: '+224 624 100 004', soldeCredit: 0,     plafondCredit: 30000 },
    { id: 'client-demo-5', nom: 'Aminata Soumah',    telephone: '+224 625 100 005', soldeCredit: 0,     plafondCredit: 50000 },
  ]

  for (const client of clients) {
    await prisma.client.upsert({
      where: { id: client.id },
      update: {},
      create: { ...client, pharmacieId: pharmacie.id },
    })
  }

  // ── Sessions caisse fermées (historique) ──────────────────────
  // 3 sessions par caissier sur les 7 derniers jours — fermées, pas de session ouverte au démarrage
  const sessionsCaisse = [
    // Fatou — 3 sessions
    { id: 'sc-demo-f1', userId: caissier1.id, montantOuverture: 50000,  montantCloture: 287500, dateOuverture: joursAvant(6), dateCloture: joursAvant(6), actif: false },
    { id: 'sc-demo-f2', userId: caissier1.id, montantOuverture: 50000,  montantCloture: 314000, dateOuverture: joursAvant(4), dateCloture: joursAvant(4), actif: false },
    { id: 'sc-demo-f3', userId: caissier1.id, montantOuverture: 50000,  montantCloture: 198000, dateOuverture: joursAvant(2), dateCloture: joursAvant(2), actif: false },
    // Mamadou — 3 sessions
    { id: 'sc-demo-m1', userId: caissier2.id, montantOuverture: 50000,  montantCloture: 265000, dateOuverture: joursAvant(6), dateCloture: joursAvant(6), actif: false },
    { id: 'sc-demo-m2', userId: caissier2.id, montantOuverture: 50000,  montantCloture: 341500, dateOuverture: joursAvant(3), dateCloture: joursAvant(3), actif: false },
    { id: 'sc-demo-m3', userId: caissier2.id, montantOuverture: 50000,  montantCloture: 222000, dateOuverture: joursAvant(1), dateCloture: joursAvant(1), actif: false },
    // Ibrahima — 2 sessions
    { id: 'sc-demo-i1', userId: caissier3.id, montantOuverture: 100000, montantCloture: 410000, dateOuverture: joursAvant(5), dateCloture: joursAvant(5), actif: false },
    { id: 'sc-demo-i2', userId: caissier3.id, montantOuverture: 100000, montantCloture: 290000, dateOuverture: joursAvant(2), dateCloture: joursAvant(2), actif: false },
  ]

  for (const sc of sessionsCaisse) {
    const existing = await prisma.sessionCaisse.findFirst({ where: { id: sc.id } })
    if (!existing) {
      await prisma.sessionCaisse.create({
        data: {
          ...sc,
          montantAttendu: sc.montantCloture,
          ecart: 0,
          pharmacieId: pharmacie.id,
        },
      })
    }
  }

  // ── Ventes (30 sur les 7 derniers jours) ──────────────────────
  // Structure : [jourAvant, medicamentId, quantite, modePaiement, clientId?, montantPaye?]
  // montantPaye < prixVente*qte → PARTIELLE (crédit)
  const ventesACreer = [
    // Jour 6
    { jour: 6, userId: caissier1.id, lignes: [{ medId: 'med-demo-para500', qte: 2 }, { medId: 'med-demo-chloro', qte: 3 }],   mode: 'ESPECES',           clientId: null,          montantPaye: null },
    { jour: 6, userId: caissier2.id, lignes: [{ medId: 'med-demo-amoxi250', qte: 1 }],                                         mode: 'ORANGE_MONEY',      clientId: null,          montantPaye: null },
    // Jour 5
    { jour: 5, userId: caissier1.id, lignes: [{ medId: 'med-demo-arthemeter', qte: 1 }, { medId: 'med-demo-quinine', qte: 2 }], mode: 'MTN_MONEY',         clientId: null,          montantPaye: null },
    { jour: 5, userId: caissier3.id, lignes: [{ medId: 'med-demo-ors', qte: 4 }, { medId: 'med-demo-vitc', qte: 2 }],          mode: 'ESPECES',           clientId: null,          montantPaye: null },
    { jour: 5, userId: caissier2.id, lignes: [{ medId: 'med-demo-mebenda', qte: 2 }],                                           mode: 'ESPECES',           clientId: null,          montantPaye: null },
    // Jour 4
    { jour: 4, userId: caissier1.id, lignes: [{ medId: 'med-demo-amoxi500', qte: 1 }, { medId: 'med-demo-metro', qte: 1 }],    mode: 'ESPECES',           clientId: null,          montantPaye: null },
    { jour: 4, userId: caissier2.id, lignes: [{ medId: 'med-demo-para500', qte: 3 }, { medId: 'med-demo-ibu400', qte: 2 }],    mode: 'ORANGE_MONEY',      clientId: null,          montantPaye: null },
    { jour: 4, userId: caissier3.id, lignes: [{ medId: 'med-demo-vitb', qte: 2 }],                                              mode: 'ESPECES',           clientId: null,          montantPaye: null },
    // Jour 3 — vente à crédit Oumar Touré
    { jour: 3, userId: caissier1.id, lignes: [{ medId: 'med-demo-arthemeter', qte: 2 }],                                        mode: 'CREDIT',            clientId: 'client-demo-2', montantPaye: 18000 },
    { jour: 3, userId: caissier2.id, lignes: [{ medId: 'med-demo-chloro', qte: 5 }, { medId: 'med-demo-ors', qte: 3 }],        mode: 'MTN_MONEY',         clientId: null,          montantPaye: null },
    { jour: 3, userId: caissier3.id, lignes: [{ medId: 'med-demo-smecta', qte: 2 }, { medId: 'med-demo-fer', qte: 1 }],        mode: 'ESPECES',           clientId: null,          montantPaye: null },
    { jour: 3, userId: caissier1.id, lignes: [{ medId: 'med-demo-quinine', qte: 1 }],                                           mode: 'PAIEMENT_MARCHAND', clientId: null,          montantPaye: null },
    // Jour 2 — vente à crédit Kadiatou Diallo
    { jour: 2, userId: caissier2.id, lignes: [{ medId: 'med-demo-amoxi500', qte: 2 }, { medId: 'med-demo-vitc', qte: 3 }],     mode: 'CREDIT',            clientId: 'client-demo-3', montantPaye: 24000 },
    { jour: 2, userId: caissier1.id, lignes: [{ medId: 'med-demo-para500', qte: 4 }, { medId: 'med-demo-chloro', qte: 2 }],    mode: 'ESPECES',           clientId: null,          montantPaye: null },
    { jour: 2, userId: caissier3.id, lignes: [{ medId: 'med-demo-mebenda', qte: 3 }],                                           mode: 'ORANGE_MONEY',      clientId: null,          montantPaye: null },
    { jour: 2, userId: caissier2.id, lignes: [{ medId: 'med-demo-vitb', qte: 1 }, { medId: 'med-demo-fer', qte: 2 }],          mode: 'ESPECES',           clientId: null,          montantPaye: null },
    // Jour 1
    { jour: 1, userId: caissier1.id, lignes: [{ medId: 'med-demo-arthemeter', qte: 3 }],                                        mode: 'MTN_MONEY',         clientId: null,          montantPaye: null },
    { jour: 1, userId: caissier3.id, lignes: [{ medId: 'med-demo-metro', qte: 2 }, { medId: 'med-demo-smecta', qte: 1 }],      mode: 'ESPECES',           clientId: null,          montantPaye: null },
    { jour: 1, userId: caissier2.id, lignes: [{ medId: 'med-demo-ibu400', qte: 1 }, { medId: 'med-demo-ors', qte: 5 }],        mode: 'ORANGE_MONEY',      clientId: null,          montantPaye: null },
    // Jour 0 (aujourd'hui)
    { jour: 0, userId: caissier1.id, lignes: [{ medId: 'med-demo-para500', qte: 2 }, { medId: 'med-demo-vitc', qte: 1 }],      mode: 'ESPECES',           clientId: null,          montantPaye: null },
    { jour: 0, userId: caissier2.id, lignes: [{ medId: 'med-demo-arthemeter', qte: 1 }],                                        mode: 'PAIEMENT_MARCHAND', clientId: null,          montantPaye: null },
    { jour: 0, userId: caissier3.id, lignes: [{ medId: 'med-demo-chloro', qte: 4 }, { medId: 'med-demo-quinine', qte: 1 }],    mode: 'MTN_MONEY',         clientId: null,          montantPaye: null },
    { jour: 0, userId: caissier1.id, lignes: [{ medId: 'med-demo-amoxi250', qte: 2 }],                                          mode: 'ESPECES',           clientId: null,          montantPaye: null },
    { jour: 0, userId: caissier2.id, lignes: [{ medId: 'med-demo-smecta', qte: 1 }, { medId: 'med-demo-fer', qte: 1 }],        mode: 'ORANGE_MONEY',      clientId: null,          montantPaye: null },
    { jour: 0, userId: caissier3.id, lignes: [{ medId: 'med-demo-mebenda', qte: 2 }, { medId: 'med-demo-ors', qte: 3 }],       mode: 'ESPECES',           clientId: null,          montantPaye: null },
    // Vente ANNULEE (pour tester historique et bouton annulation)
    { jour: 4, userId: caissier3.id, lignes: [{ medId: 'med-demo-vitb', qte: 1 }],                                              mode: 'ESPECES',           clientId: null,          montantPaye: null, statut: 'ANNULEE' as const },
  ]

  // Récupérer les prix une seule fois
  const medsPrix: Record<string, { prixVente: number; prixAchat: number }> = {}
  for (const med of medsDemo) {
    medsPrix[med.id] = { prixVente: med.prixVente, prixAchat: med.prixAchat }
  }

  let ventesCreees = 0
  for (const v of ventesACreer) {
    const montantLignes = v.lignes.reduce((sum, l) => sum + medsPrix[l.medId].prixVente * l.qte, 0)
    const montantPaye   = v.montantPaye !== null ? v.montantPaye : montantLignes
    const statut        = v.statut ?? (montantPaye < montantLignes ? 'PARTIELLE' : 'COMPLETE')
    const resteADu      = montantLignes - montantPaye

    const date = joursAvant(v.jour)

    const vente = await prisma.vente.create({
      data: {
        montantTotal:  montantLignes,
        montantPaye,
        modePaiement:  v.mode as any,
        statut,
        remise:        0,
        monnaie:       montantPaye > montantLignes ? montantPaye - montantLignes : 0,
        pharmacieId:   pharmacie.id,
        userId:        v.userId,
        clientId:      v.clientId ?? null,
        createdAt:     date,
        lignes: {
          create: v.lignes.map(l => ({
            quantite:     l.qte,
            prixUnitaire: medsPrix[l.medId].prixVente,
            medicamentId: l.medId,
          })),
        },
      },
    })

    // Si crédit → incrémenter soldeCredit du client (déjà hardcodé dans la création client)
    // Les lots sont créés en masse — pas de décrémentation FIFO ici pour le seed
    // → on ne touche pas aux lots pour garder du stock disponible pour les tests manuels

    // MouvementStock SORTIE pour chaque ligne (pour alimenter le journal de mouvements)
    if (statut !== 'ANNULEE') {
      for (const l of v.lignes) {
        await prisma.mouvementStock.create({
          data: {
            type:        'SORTIE',
            quantite:    l.qte,
            medicamentId: l.medId,
            userId:      v.userId,
            createdAt:   date,
          },
        })
      }
    }

    ventesCreees++
  }

  // ── Commande fournisseur (statut RECUE — pour tester l'historique) ──
  const commande = await prisma.commandeFournisseur.create({
    data: {
      id:           'commande-demo-001',
      statut:       'RECUE',
      montantTotal: 285000,
      pharmacieId:  pharmacie.id,
      fournisseurId: 'fournisseur-demo-001',
      createdAt:    joursAvant(10),
      lignes: {
        create: [
          { quantite: 50, prixUnitaire: 1200,  medicamentId: 'med-demo-chloro' },
          { quantite: 30, prixUnitaire: 6000,  medicamentId: 'med-demo-amoxi250' },
          { quantite: 40, prixUnitaire: 4500,  medicamentId: 'med-demo-quinine' },
        ],
      },
    },
  }).catch(() => null) // Ignorer si déjà existante

  // ── Dépenses (8 sur les 2 derniers mois) ─────────────────────
  const depenses = [
    { id: 'dep-demo-1',  libelle: 'Salaires du personnel — Mai 2026',      montant: 1200000, categorie: 'Salaires',                createdAt: joursAvant(55) },
    { id: 'dep-demo-2',  libelle: 'Loyer du local — Mai 2026',              montant:  300000, categorie: 'Loyer',                   createdAt: joursAvant(55) },
    { id: 'dep-demo-3',  libelle: 'Facture électricité & eau — Mai',        montant:   85000, categorie: 'Électricité & eau',        createdAt: joursAvant(40) },
    { id: 'dep-demo-4',  libelle: 'Taxe patente & impôts trimestriels',     montant:  180000, categorie: 'Impôts & taxes',           createdAt: joursAvant(35) },
    { id: 'dep-demo-5',  libelle: 'Salaires du personnel — Juin 2026',      montant: 1200000, categorie: 'Salaires',                createdAt: joursAvant(25) },
    { id: 'dep-demo-6',  libelle: 'Loyer du local — Juin 2026',             montant:  300000, categorie: 'Loyer',                   createdAt: joursAvant(25) },
    { id: 'dep-demo-7',  libelle: 'Réparation groupe électrogène',          montant:   65000, categorie: 'Réparations & entretien', createdAt: joursAvant(12) },
    { id: 'dep-demo-8',  libelle: 'Fournitures de bureau et emballages',    montant:   45000, categorie: 'Fournitures & matériel',  createdAt: joursAvant(5)  },
  ]

  for (const dep of depenses) {
    await prisma.depense.upsert({
      where: { id: dep.id },
      update: {},
      create: {
        ...dep,
        archivee:    false,
        pharmacieId: pharmacie.id,
        userId:      admin.id,
      },
    })
  }

  console.log(`  ✅ Pharmacie démo prête`)
  console.log(`  👤 admin@demo.pharmagest.com     / Demo1234!  (Admin)`)
  console.log(`  👤 fatou@demo.pharmagest.com     / Demo1234!  (Caissier)`)
  console.log(`  👤 mamadou@demo.pharmagest.com   / Demo1234!  (Caissier)`)
  console.log(`  👤 ibrahima@demo.pharmagest.com  / Demo1234!  (Caissier)`)
  console.log(`  📦 15 médicaments | 💊 lots variés | 🛒 ${ventesCreees} ventes | 👥 5 clients`)
  console.log(`  💳 2 clients avec crédit en cours | 1 vente annulée | 2 lots périmant bientôt`)
  console.log(`  ⚠️  Cotrimoxazole sous seuil minimal (stock bas intentionnel)`)
  console.log(`  ℹ️  Aucune session caisse ouverte — chaque caissier doit ouvrir la sienne`)
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 PharmaGest — Seed complet')
  console.log('════════════════════════════════')

  await seedPharmacicPilote()
  await seedPharmacieDemo()

  console.log('\n════════════════════════════════')
  console.log('✅ Seed terminé avec succès !\n')
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })