import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Créer la pharmacie pilote
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
  console.log('Pharmacie créée:', pharmacie.nom)

  // Créer les utilisateurs
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
  console.log('Admin créé:', admin.email)

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
  console.log('Caissier créé:', caissier.email)

  // Créer des médicaments
  const medicaments = [
    { nom: 'Paracétamol 500mg', categorie: 'Analgésique', prixVente: 5000, prixAchat: 2000, stockMinimum: 50 },
    { nom: 'Amoxicilline 250mg', categorie: 'Antibiotique', prixVente: 15000, prixAchat: 8000, stockMinimum: 30 },
    { nom: 'Chloroquine 100mg', categorie: 'Antipaludéen', prixVente: 3000, prixAchat: 1500, stockMinimum: 80 },
    { nom: 'Ibuprofène 400mg', categorie: 'Anti-inflammatoire', prixVente: 8000, prixAchat: 4000, stockMinimum: 40 },
    { nom: 'Métronidazole 250mg', categorie: 'Antibiotique', prixVente: 6000, prixAchat: 3000, stockMinimum: 30 },
  ]

  for (const med of medicaments) {
    const medicament = await prisma.medicament.upsert({
      where: { id: `med-${med.nom.toLowerCase().replace(/\s/g, '-')}` },
      update: {},
      create: {
        id: `med-${med.nom.toLowerCase().replace(/\s/g, '-')}`,
        ...med,
        pharmacieId: pharmacie.id,
      },
    })

    // Créer un lot pour chaque médicament
    await prisma.lot.create({
      data: {
        numeroLot: `LOT-2026-${Math.floor(Math.random() * 1000)}`,
        datePeremption: new Date('2027-12-31'),
        quantite: Math.floor(Math.random() * 200) + 50,
        medicamentId: medicament.id,
      } as any,
    })
    console.log('Médicament créé:', medicament.nom)
  }

  // Créer un fournisseur
  await prisma.fournisseur.upsert({
    where: { id: 'fournisseur-001' },
    update: {},
    create: {
      id: 'fournisseur-001',
      nom: 'Pharmadis Guinée',
      contact: 'Mamadou Diallo',
      telephone: '+224 622 111 222',
      email: 'contact@pharmadis.gn',
      delaiLivraison: 3,
      pharmacieId: pharmacie.id,
    },
  })
  console.log('Fournisseur créé')

  // Dépenses de démonstration — 7 catégories standard, 3 derniers mois
  const depensesDemo = [
    // Avril 2026
    { id: 'dep-avril-salaires',    libelle: 'Salaires du personnel — Avril 2026',   montant: 500000, categorie: 'Salaires',               createdAt: new Date('2026-04-03') },
    { id: 'dep-avril-loyer',       libelle: 'Loyer du local — Avril 2026',           montant: 150000, categorie: 'Loyer',                  createdAt: new Date('2026-04-03') },
    { id: 'dep-avril-elec',        libelle: 'Facture électricité & eau — Avril',     montant:  45000, categorie: 'Électricité & eau',       createdAt: new Date('2026-04-15') },
    // Mai 2026
    { id: 'dep-mai-salaires',      libelle: 'Salaires du personnel — Mai 2026',     montant: 500000, categorie: 'Salaires',               createdAt: new Date('2026-05-02') },
    { id: 'dep-mai-loyer',         libelle: 'Loyer du local — Mai 2026',             montant: 150000, categorie: 'Loyer',                  createdAt: new Date('2026-05-02') },
    { id: 'dep-mai-fournitures',   libelle: 'Fournitures & matériel de bureau',      montant:  25000, categorie: 'Fournitures & matériel', createdAt: new Date('2026-05-18') },
    { id: 'dep-mai-impots',        libelle: 'Taxe patente & impôts trimestriels',    montant:  80000, categorie: 'Impôts & taxes',          createdAt: new Date('2026-05-28') },
    // Juin 2026
    { id: 'dep-juin-salaires',     libelle: 'Salaires du personnel — Juin 2026',    montant: 500000, categorie: 'Salaires',               createdAt: new Date('2026-06-02') },
    { id: 'dep-juin-loyer',        libelle: 'Loyer du local — Juin 2026',            montant: 150000, categorie: 'Loyer',                  createdAt: new Date('2026-06-02') },
    { id: 'dep-juin-reparation',   libelle: 'Réparation groupe électrogène',         montant:  30000, categorie: 'Réparations & entretien', createdAt: new Date('2026-06-10') },
    { id: 'dep-juin-autres',       libelle: 'Diverses dépenses — Juin',              montant:  20000, categorie: 'Autres charges',         createdAt: new Date('2026-06-25') },
  ]

  for (const dep of depensesDemo) {
    await prisma.depense.upsert({
      where: { id: dep.id },
      update: {},
      create: {
        id: dep.id,
        libelle: dep.libelle,
        montant: dep.montant,
        categorie: dep.categorie,
        archivee: false,
        pharmacieId: pharmacie.id,
        userId: admin.id,
        createdAt: dep.createdAt,
      } as any,
    })
  }
  console.log('Dépenses de démonstration créées (11 entrées, 3 mois)')

  console.log('Seed terminé avec succès !')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
