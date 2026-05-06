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
      },
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
