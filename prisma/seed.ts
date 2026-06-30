/**
 * PharmaGest — Seed
 *
 * ⚠️  EXÉCUTION LOCALE IMPOSSIBLE EN GUINÉE
 * Les ports 5432 et 6543 sont bloqués par les opérateurs réseau.
 * Ce fichier ne peut pas être exécuté avec ts-node depuis Conakry.
 *
 * ✅  MÉTHODE UTILISÉE : seed_demo.sql exécuté directement dans
 *     le Supabase SQL Editor (Session I — 30/06/2026)
 *
 * Ce fichier est conservé comme référence et pour les environnements
 * disposant d'un accès réseau direct à Supabase (ex: CI/CD, autre pays).
 *
 * COMPTES CRÉÉS EN BDD :
 * ── Pharmacie pilote ──────────────────────────────────────────
 *   admin@pharmaciecentrale.gn    / Admin1234!     (ADMIN)
 *   caissier@pharmaciecentrale.gn / Caissier1234!  (CAISSIER)
 *   caissier2@pharmaciecentrale.gn / Caissier1234! (CAISSIER)
 *
 * ── Pharmacie démo ────────────────────────────────────────────
 *   admin@demo.pharmagest.com    / Demo1234!   (ADMIN)
 *   fatou@demo.pharmagest.com    / Demo1234!   (CAISSIER)
 *   mamadou@demo.pharmagest.com  / Demo1234!   (CAISSIER)
 *   ibrahima@demo.pharmagest.com / Demo1234!   (CAISSIER)
 *
 * DONNÉES DÉMO :
 *   - 15 médicaments courants en Guinée
 *   - 22 lots (dont 2 avec péremption < 90 jours)
 *   - 26 ventes sur 7 jours (mix tous modes de paiement)
 *   - 2 ventes à crédit (PARTIELLE), 1 vente ANNULEE
 *   - 5 clients (dont 2 avec soldeCredit > 0)
 *   - 8 sessions caisse fermées (3 caissiers)
 *   - 8 dépenses sur 2 mois
 *   - 1 commande fournisseur RECUE
 *   - Cotrimoxazole : stock=8, seuil=60 → alerte stock bas active
 *
 * Pour re-seeder : exécuter prisma/seed_demo.sql dans Supabase SQL Editor
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

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

async function seedPharmaciePilote() {
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

  const adminHash    = await bcrypt.hash('Admin1234!', 10)
  const caissierHash = await bcrypt.hash('Caissier1234!', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@pharmaciecentrale.gn' },
    update: {},
    create: {
      id: 'user-pilote-admin',
      nom: 'Administrateur',
      email: 'admin@pharmaciecentrale.gn',
      password: adminHash,
      role: 'ADMIN',
      pharmacieId: pharmacie.id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'caissier@pharmaciecentrale.gn' },
    update: {},
    create: {
      id: 'user-pilote-caissier',
      nom: 'Caissier Principal',
      email: 'caissier@pharmaciecentrale.gn',
      password: caissierHash,
      role: 'CAISSIER',
      pharmacieId: pharmacie.id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'caissier2@pharmaciecentrale.gn' },
    update: {},
    create: {
      id: 'user-pilote-caiss2',
      nom: 'Caissier2',
      email: 'caissier2@pharmaciecentrale.gn',
      password: caissierHash,
      role: 'CAISSIER',
      pharmacieId: pharmacie.id,
    },
  })

  const meds = [
    { id: 'med-p-para',   nom: 'Paracétamol 500mg',   categorie: 'Analgésique',        prixVente: 5000,  prixAchat: 2000, stockMinimum: 50 },
    { id: 'med-p-amoxi',  nom: 'Amoxicilline 250mg',  categorie: 'Antibiotique',        prixVente: 15000, prixAchat: 8000, stockMinimum: 30 },
    { id: 'med-p-chloro', nom: 'Chloroquine 100mg',   categorie: 'Antipaludéen',        prixVente: 3000,  prixAchat: 1500, stockMinimum: 80 },
    { id: 'med-p-ibu',    nom: 'Ibuprofène 400mg',    categorie: 'Anti-inflammatoire',  prixVente: 8000,  prixAchat: 4000, stockMinimum: 40 },
    { id: 'med-p-metro',  nom: 'Métronidazole 250mg', categorie: 'Antibiotique',        prixVente: 6000,  prixAchat: 3000, stockMinimum: 30 },
  ]

  for (const med of meds) {
    await prisma.medicament.upsert({
      where: { id: med.id },
      update: {},
      create: { ...med, pharmacieId: pharmacie.id },
    })

    const lotId = `lot-p-${med.id}`
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
    where: { id: 'fourn-pilote-001' },
    update: {},
    create: {
      id: 'fourn-pilote-001',
      nom: 'Pharmadis Guinée',
      contact: 'Mamadou Diallo',
      telephone: '+224 622 111 222',
      email: 'contact@pharmadis.gn',
      delaiLivraison: 3,
      pharmacieId: pharmacie.id,
    },
  })

  console.log('  ✅ Pharmacie pilote prête')
}

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

  const demoHash = await bcrypt.hash('Demo1234!', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.pharmagest.com' },
    update: {},
    create: { id: 'user-demo-admin',  nom: 'Aissatou Baldé', email: 'admin@demo.pharmagest.com',    password: demoHash, role: 'ADMIN',    pharmacieId: pharmacie.id },
  })
  const c1 = await prisma.user.upsert({
    where: { email: 'fatou@demo.pharmagest.com' },
    update: {},
    create: { id: 'user-demo-caiss1', nom: 'Fatou Camara',   email: 'fatou@demo.pharmagest.com',    password: demoHash, role: 'CAISSIER', pharmacieId: pharmacie.id },
  })
  const c2 = await prisma.user.upsert({
    where: { email: 'mamadou@demo.pharmagest.com' },
    update: {},
    create: { id: 'user-demo-caiss2', nom: 'Mamadou Diallo', email: 'mamadou@demo.pharmagest.com',  password: demoHash, role: 'CAISSIER', pharmacieId: pharmacie.id },
  })
  const c3 = await prisma.user.upsert({
    where: { email: 'ibrahima@demo.pharmagest.com' },
    update: {},
    create: { id: 'user-demo-caiss3', nom: 'Ibrahima Sylla', email: 'ibrahima@demo.pharmagest.com', password: demoHash, role: 'CAISSIER', pharmacieId: pharmacie.id },
  })

  const medsDemo = [
    { id: 'med-d-arth',   nom: 'Arthémether/Luméfantrine 20/120mg', categorie: 'Antipaludéen',       prixVente: 25000, prixAchat: 14000, stockMinimum: 50,  qte: 120 },
    { id: 'med-d-chloro', nom: 'Chloroquine 100mg',                 categorie: 'Antipaludéen',       prixVente: 3000,  prixAchat: 1200,  stockMinimum: 100, qte: 300 },
    { id: 'med-d-quini',  nom: 'Quinine 300mg',                     categorie: 'Antipaludéen',       prixVente: 8000,  prixAchat: 4500,  stockMinimum: 60,  qte: 150 },
    { id: 'med-d-am250',  nom: 'Amoxicilline 250mg',                categorie: 'Antibiotique',       prixVente: 12000, prixAchat: 6000,  stockMinimum: 40,  qte: 80  },
    { id: 'med-d-am500',  nom: 'Amoxicilline 500mg',                categorie: 'Antibiotique',       prixVente: 18000, prixAchat: 10000, stockMinimum: 30,  qte: 60  },
    { id: 'med-d-metro',  nom: 'Métronidazole 250mg',               categorie: 'Antibiotique',       prixVente: 6000,  prixAchat: 2800,  stockMinimum: 30,  qte: 90  },
    { id: 'med-d-para',   nom: 'Paracétamol 500mg',                 categorie: 'Analgésique',        prixVente: 5000,  prixAchat: 1800,  stockMinimum: 80,  qte: 400 },
    { id: 'med-d-ibu',    nom: 'Ibuprofène 400mg',                  categorie: 'Anti-inflammatoire', prixVente: 8000,  prixAchat: 3500,  stockMinimum: 40,  qte: 200 },
    { id: 'med-d-vitc',   nom: 'Vitamine C 500mg',                  categorie: 'Vitamine',           prixVente: 4000,  prixAchat: 1500,  stockMinimum: 50,  qte: 250 },
    { id: 'med-d-vitb',   nom: 'Vitamine B Complex',                categorie: 'Vitamine',           prixVente: 7500,  prixAchat: 3500,  stockMinimum: 30,  qte: 100 },
    { id: 'med-d-fer',    nom: 'Sulfate de Fer 200mg',              categorie: 'Vitamine',           prixVente: 5000,  prixAchat: 2200,  stockMinimum: 40,  qte: 150 },
    { id: 'med-d-ors',    nom: 'SRO — Sels de Réhydratation',       categorie: 'Antidiarrhéique',    prixVente: 2500,  prixAchat: 800,   stockMinimum: 100, qte: 500 },
    { id: 'med-d-smec',   nom: 'Diosmectite 3g',                    categorie: 'Antidiarrhéique',    prixVente: 6000,  prixAchat: 2500,  stockMinimum: 30,  qte: 80  },
    { id: 'med-d-meben',  nom: 'Mébendazole 100mg',                 categorie: 'Antiparasitaire',    prixVente: 4500,  prixAchat: 1800,  stockMinimum: 40,  qte: 120 },
    { id: 'med-d-cotri',  nom: 'Cotrimoxazole 480mg',               categorie: 'Antibiotique',       prixVente: 7000,  prixAchat: 3000,  stockMinimum: 60,  qte: 8   },
  ]

  for (const { qte, ...med } of medsDemo) {
    await prisma.medicament.upsert({ where: { id: med.id }, update: {}, create: { ...med, pharmacieId: pharmacie.id } })
    const lotId = `lot-d-${med.id}`
    const existing = await prisma.lot.findFirst({ where: { id: lotId } })
    if (!existing) {
      await prisma.lot.create({ data: { id: lotId, numeroLot: `LOT-2026-${med.id.slice(-4).toUpperCase()}`, datePeremption: new Date('2027-06-30'), quantite: qte, prixAchat: med.prixAchat, medicamentId: med.id, pharmacieId: pharmacie.id } })
    }
  }

  // Lots péremption proche
  for (const lot of [
    { id: 'lot-d-quini-exp', medicamentId: 'med-d-quini', datePeremption: joursApres(45), quantite: 20, prixAchat: 4500, numeroLot: 'LOT-EXPIRE-QUI' },
    { id: 'lot-d-vitb-exp',  medicamentId: 'med-d-vitb',  datePeremption: joursApres(70), quantite: 15, prixAchat: 3500, numeroLot: 'LOT-EXPIRE-VIT' },
  ]) {
    const existing = await prisma.lot.findFirst({ where: { id: lot.id } })
    if (!existing) await prisma.lot.create({ data: { ...lot, pharmacieId: pharmacie.id } })
  }

  await prisma.fournisseur.upsert({
    where: { id: 'fourn-demo-001' },
    update: {},
    create: { id: 'fourn-demo-001', nom: 'Laborex Guinée', contact: 'Ousmane Kouyaté', telephone: '+224 628 444 555', email: 'commandes@laborex.gn', delaiLivraison: 2, pharmacieId: pharmacie.id },
  })

  for (const client of [
    { id: 'client-demo-1', nom: 'Mariama Bah',     telephone: '+224 621 100 001', soldeCredit: 0,     plafondCredit: 50000 },
    { id: 'client-demo-2', nom: 'Oumar Touré',     telephone: '+224 622 100 002', soldeCredit: 32000, plafondCredit: 50000 },
    { id: 'client-demo-3', nom: 'Kadiatou Diallo', telephone: '+224 623 100 003', soldeCredit: 18500, plafondCredit: 75000 },
    { id: 'client-demo-4', nom: 'Seydou Konaté',   telephone: '+224 624 100 004', soldeCredit: 0,     plafondCredit: 30000 },
    { id: 'client-demo-5', nom: 'Aminata Soumah',  telephone: '+224 625 100 005', soldeCredit: 0,     plafondCredit: 50000 },
  ]) {
    await prisma.client.upsert({ where: { id: client.id }, update: {}, create: { ...client, pharmacieId: pharmacie.id } })
  }

  console.log('  ✅ Pharmacie démo prête')
  console.log('  👤 admin@demo.pharmagest.com    / Demo1234!  (Admin)')
  console.log('  👤 fatou@demo.pharmagest.com    / Demo1234!  (Caissier)')
  console.log('  👤 mamadou@demo.pharmagest.com  / Demo1234!  (Caissier)')
  console.log('  👤 ibrahima@demo.pharmagest.com / Demo1234!  (Caissier)')
  console.log('  ℹ️  Ventes/sessions/dépenses : voir prisma/seed_demo.sql')
}

async function main() {
  console.log('🌱 PharmaGest — Seed')
  console.log('════════════════════')
  console.log('⚠️  Exécution locale impossible depuis Guinée (ports bloqués)')
  console.log('   Utiliser prisma/seed_demo.sql dans Supabase SQL Editor\n')

  await seedPharmaciePilote()
  await seedPharmacieDemo()

  console.log('\n════════════════════')
  console.log('✅ Seed terminé !\n')
}

main()
  .catch((e) => { console.error('❌ Erreur:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })