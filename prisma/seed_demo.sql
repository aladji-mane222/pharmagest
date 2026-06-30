-- ================================================================
-- PharmaGest — Seed complet v2 — Supabase SQL Editor
-- Hash Demo1234! : $2b$10$8oLc7fOJZJg422gvb/vmG.6QDSYx3is6.Ir.FQJXfchRzYhvuhk1G
-- ================================================================

-- ----------------------------------------------------------------
-- 0. NETTOYAGE COMPLET (ordre FK)
-- ----------------------------------------------------------------
DELETE FROM "AuditLog";
DELETE FROM "MouvementStock";
DELETE FROM "LigneVente";
DELETE FROM "Vente";
DELETE FROM "LigneCommande";
DELETE FROM "CommandeFournisseur";
DELETE FROM "LigneInventaire";
DELETE FROM "Inventaire";
DELETE FROM "SessionCaisse";
DELETE FROM "Depense";
DELETE FROM "Client";
DELETE FROM "Lot";
DELETE FROM "Medicament";
DELETE FROM "Fournisseur";
DELETE FROM "User";
DELETE FROM "Pharmacie";

-- ================================================================
-- PHARMACIE PILOTE
-- ================================================================

INSERT INTO "Pharmacie" (id, nom, adresse, telephone, email, "licenceActive", "createdAt", "updatedAt")
VALUES (
  'pharmacie-pilote-001',
  'Pharmacie Centrale de Conakry',
  'Kaloum, Conakry, Guinée',
  '+224 620 000 000',
  'contact@pharmaciecentrale.gn',
  true, NOW(), NOW()
);

INSERT INTO "User" (id, nom, email, password, role, actif, "pharmacieId", "createdAt", "updatedAt") VALUES
  ('user-pilote-admin',    'Administrateur',    'admin@pharmaciecentrale.gn',    '$2b$10$yVt9ot/tJw3j3W5/MGmYlOROJOvwgtxcZuYpqvcdS4I/4X1rO.t2q', 'ADMIN',    true, 'pharmacie-pilote-001', NOW(), NOW()),
  ('user-pilote-caissier', 'Caissier Principal','caissier@pharmaciecentrale.gn', '$2b$10$VbYHU180k9gKuJzzUZusl.qp.m4AKq8w2DYrUK9Vyx/myg97ZhtZ.', 'CAISSIER', true, 'pharmacie-pilote-001', NOW(), NOW()),
  ('user-pilote-caiss2',   'Caissier2',         'caissier2@pharmaciecentrale.gn','$2b$10$d3SCby.4X/WK3Dp1qqliAu7vLcSBN7uzmAUOtT5HeyLCkrvKdD9ny',  'CAISSIER', true, 'pharmacie-pilote-001', NOW(), NOW());

INSERT INTO "Medicament" (id, nom, categorie, "prixVente", "prixAchat", "stockMinimum", actif, "pharmacieId", "createdAt", "updatedAt") VALUES
  ('med-p-para',   'Paracétamol 500mg',   'Analgésique',        5000,  2000, 50, true, 'pharmacie-pilote-001', NOW(), NOW()),
  ('med-p-amoxi',  'Amoxicilline 250mg',  'Antibiotique',      15000,  8000, 30, true, 'pharmacie-pilote-001', NOW(), NOW()),
  ('med-p-chloro', 'Chloroquine 100mg',   'Antipaludéen',       3000,  1500, 80, true, 'pharmacie-pilote-001', NOW(), NOW()),
  ('med-p-ibu',    'Ibuprofène 400mg',    'Anti-inflammatoire', 8000,  4000, 40, true, 'pharmacie-pilote-001', NOW(), NOW()),
  ('med-p-metro',  'Métronidazole 250mg', 'Antibiotique',       6000,  3000, 30, true, 'pharmacie-pilote-001', NOW(), NOW());

INSERT INTO "Lot" (id, "numeroLot", "datePeremption", quantite, "prixAchat", actif, "medicamentId", "pharmacieId", "createdAt", "updatedAt") VALUES
  ('lot-p-para',   'LOT-PILOTE-PARA',   '2027-12-31', 100, 2000, true, 'med-p-para',   'pharmacie-pilote-001', NOW(), NOW()),
  ('lot-p-amoxi',  'LOT-PILOTE-AMOXI',  '2027-12-31', 100, 8000, true, 'med-p-amoxi',  'pharmacie-pilote-001', NOW(), NOW()),
  ('lot-p-chloro', 'LOT-PILOTE-CHLORO', '2027-12-31', 100, 1500, true, 'med-p-chloro', 'pharmacie-pilote-001', NOW(), NOW()),
  ('lot-p-ibu',    'LOT-PILOTE-IBU',    '2027-12-31', 100, 4000, true, 'med-p-ibu',    'pharmacie-pilote-001', NOW(), NOW()),
  ('lot-p-metro',  'LOT-PILOTE-METRO',  '2027-12-31', 100, 3000, true, 'med-p-metro',  'pharmacie-pilote-001', NOW(), NOW());

INSERT INTO "Fournisseur" (id, nom, contact, telephone, email, "delaiLivraison", actif, "pharmacieId", "createdAt", "updatedAt") VALUES
  ('fourn-pilote-001', 'Pharmadis Guinée', 'Mamadou Diallo', '+224 622 111 222', 'contact@pharmadis.gn', 3, true, 'pharmacie-pilote-001', NOW(), NOW());

-- ================================================================
-- PHARMACIE DÉMO
-- ================================================================

INSERT INTO "Pharmacie" (id, nom, adresse, telephone, email, "licenceActive", "createdAt", "updatedAt")
VALUES (
  'pharmacie-demo-001',
  'Pharmacie Horizon',
  'Dixinn, Conakry, Guinée',
  '+224 625 000 001',
  'contact@pharmaciehorizon.gn',
  true, NOW(), NOW()
);

INSERT INTO "User" (id, nom, email, password, role, actif, "pharmacieId", "createdAt", "updatedAt") VALUES
  ('user-demo-admin',  'Aissatou Baldé', 'admin@demo.pharmagest.com',    '$2b$10$8oLc7fOJZJg422gvb/vmG.6QDSYx3is6.Ir.FQJXfchRzYhvuhk1G', 'ADMIN',    true, 'pharmacie-demo-001', NOW(), NOW()),
  ('user-demo-caiss1', 'Fatou Camara',   'fatou@demo.pharmagest.com',    '$2b$10$8oLc7fOJZJg422gvb/vmG.6QDSYx3is6.Ir.FQJXfchRzYhvuhk1G', 'CAISSIER', true, 'pharmacie-demo-001', NOW(), NOW()),
  ('user-demo-caiss2', 'Mamadou Diallo', 'mamadou@demo.pharmagest.com',  '$2b$10$8oLc7fOJZJg422gvb/vmG.6QDSYx3is6.Ir.FQJXfchRzYhvuhk1G', 'CAISSIER', true, 'pharmacie-demo-001', NOW(), NOW()),
  ('user-demo-caiss3', 'Ibrahima Sylla', 'ibrahima@demo.pharmagest.com', '$2b$10$8oLc7fOJZJg422gvb/vmG.6QDSYx3is6.Ir.FQJXfchRzYhvuhk1G', 'CAISSIER', true, 'pharmacie-demo-001', NOW(), NOW());

-- ----------------------------------------------------------------
-- MÉDICAMENTS DÉMO (15)
-- ----------------------------------------------------------------
INSERT INTO "Medicament" (id, nom, categorie, "prixVente", "prixAchat", "stockMinimum", actif, "pharmacieId", "createdAt", "updatedAt") VALUES
  ('med-d-arth',   'Arthémether/Luméfantrine 20/120mg', 'Antipaludéen',       25000, 14000,  50, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-chloro', 'Chloroquine 100mg',                 'Antipaludéen',        3000,  1200, 100, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-quini',  'Quinine 300mg',                     'Antipaludéen',        8000,  4500,  60, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-am250',  'Amoxicilline 250mg',                'Antibiotique',       12000,  6000,  40, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-am500',  'Amoxicilline 500mg',                'Antibiotique',       18000, 10000,  30, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-metro',  'Métronidazole 250mg',               'Antibiotique',        6000,  2800,  30, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-para',   'Paracétamol 500mg',                 'Analgésique',         5000,  1800,  80, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-ibu',    'Ibuprofène 400mg',                  'Anti-inflammatoire',  8000,  3500,  40, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-vitc',   'Vitamine C 500mg',                  'Vitamine',            4000,  1500,  50, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-vitb',   'Vitamine B Complex',                'Vitamine',            7500,  3500,  30, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-fer',    'Sulfate de Fer 200mg',              'Vitamine',            5000,  2200,  40, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-ors',    'SRO — Sels de Réhydratation',       'Antidiarrhéique',     2500,   800, 100, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-smec',   'Diosmectite 3g',                    'Antidiarrhéique',     6000,  2500,  30, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-meben',  'Mébendazole 100mg',                 'Antiparasitaire',     4500,  1800,  40, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('med-d-cotri',  'Cotrimoxazole 480mg',               'Antibiotique',        7000,  3000,  60, true, 'pharmacie-demo-001', NOW(), NOW());
-- ⚠️ Cotrimoxazole : stock = 8, seuil = 60 → déclenche alerte stock bas

-- ----------------------------------------------------------------
-- LOTS DÉMO (17 lots)
-- ----------------------------------------------------------------
INSERT INTO "Lot" (id, "numeroLot", "datePeremption", quantite, "prixAchat", actif, "medicamentId", "pharmacieId", "createdAt", "updatedAt") VALUES
  -- Lots standard péremption 2027
  ('lot-d-arth',    'LOT-2026-ART', '2027-06-30', 120, 14000, true, 'med-d-arth',   'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-chloro',  'LOT-2026-CHL', '2027-06-30', 300,  1200, true, 'med-d-chloro', 'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-am250',   'LOT-2026-A25', '2027-06-30',  80,  6000, true, 'med-d-am250',  'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-am500',   'LOT-2026-A50', '2027-06-30',  60, 10000, true, 'med-d-am500',  'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-metro',   'LOT-2026-MET', '2027-06-30',  90,  2800, true, 'med-d-metro',  'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-para',    'LOT-2026-PAR', '2027-06-30', 400,  1800, true, 'med-d-para',   'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-ibu',     'LOT-2026-IBU', '2027-06-30', 200,  3500, true, 'med-d-ibu',    'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-vitc',    'LOT-2026-VIC', '2027-06-30', 250,  1500, true, 'med-d-vitc',   'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-fer',     'LOT-2026-FER', '2027-06-30', 150,  2200, true, 'med-d-fer',    'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-ors',     'LOT-2026-ORS', '2027-06-30', 500,   800, true, 'med-d-ors',    'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-smec',    'LOT-2026-SME', '2027-06-30',  80,  2500, true, 'med-d-smec',   'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-meben',   'LOT-2026-MEB', '2027-06-30', 120,  1800, true, 'med-d-meben',  'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-cotri',   'LOT-2026-COT', '2027-06-30',   8,  3000, true, 'med-d-cotri',  'pharmacie-demo-001', NOW(), NOW()),
  -- Vitamine B Complex lot standard
  ('lot-d-vitb',    'LOT-2026-VIB', '2027-06-30', 100,  3500, true, 'med-d-vitb',   'pharmacie-demo-001', NOW(), NOW()),
  -- Lots avec péremption proche (< 90 jours) → déclenchent alertes péremption
  ('lot-d-quini-a', 'LOT-EXPIRE-QUI', (CURRENT_DATE + INTERVAL '45 days')::date, 20, 4500, true, 'med-d-quini', 'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-quini-b', 'LOT-2026-QUI',   '2027-06-30',                              150, 4500, true, 'med-d-quini', 'pharmacie-demo-001', NOW(), NOW()),
  ('lot-d-vitb-exp','LOT-EXPIRE-VIT', (CURRENT_DATE + INTERVAL '70 days')::date,  15, 3500, true, 'med-d-vitb',  'pharmacie-demo-001', NOW(), NOW());

-- ----------------------------------------------------------------
-- FOURNISSEUR DÉMO
-- ----------------------------------------------------------------
INSERT INTO "Fournisseur" (id, nom, contact, telephone, email, "delaiLivraison", actif, "pharmacieId", "createdAt", "updatedAt") VALUES
  ('fourn-demo-001', 'Laborex Guinée', 'Ousmane Kouyaté', '+224 628 444 555', 'commandes@laborex.gn', 2, true, 'pharmacie-demo-001', NOW(), NOW());

-- ----------------------------------------------------------------
-- CLIENTS DÉMO (5)
-- ----------------------------------------------------------------
INSERT INTO "Client" (id, nom, telephone, "soldeCredit", "plafondCredit", actif, "pharmacieId", "createdAt", "updatedAt") VALUES
  ('client-demo-1', 'Mariama Bah',     '+224 621 100 001',  0,     50000, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('client-demo-2', 'Oumar Touré',     '+224 622 100 002',  32000, 50000, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('client-demo-3', 'Kadiatou Diallo', '+224 623 100 003',  18500, 75000, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('client-demo-4', 'Seydou Konaté',   '+224 624 100 004',  0,     30000, true, 'pharmacie-demo-001', NOW(), NOW()),
  ('client-demo-5', 'Aminata Soumah',  '+224 625 100 005',  0,     50000, true, 'pharmacie-demo-001', NOW(), NOW());

-- ----------------------------------------------------------------
-- SESSIONS CAISSE (8 fermées — aucune ouverte au démarrage)
-- ----------------------------------------------------------------
INSERT INTO "SessionCaisse" (id, "montantOuverture", "montantCloture", "montantAttendu", ecart, "dateOuverture", "dateCloture", actif, "userId", "pharmacieId") VALUES
  ('sc-f1', 50000,  287500, 287500, 0, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '8 hours', false, 'user-demo-caiss1', 'pharmacie-demo-001'),
  ('sc-f2', 50000,  314000, 314000, 0, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '8 hours', false, 'user-demo-caiss1', 'pharmacie-demo-001'),
  ('sc-f3', 50000,  198000, 198000, 0, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '8 hours', false, 'user-demo-caiss1', 'pharmacie-demo-001'),
  ('sc-m1', 50000,  265000, 265000, 0, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '8 hours', false, 'user-demo-caiss2', 'pharmacie-demo-001'),
  ('sc-m2', 50000,  341500, 341500, 0, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '8 hours', false, 'user-demo-caiss2', 'pharmacie-demo-001'),
  ('sc-m3', 50000,  222000, 222000, 0, NOW() - INTERVAL '1 day',  NOW() - INTERVAL '1 day'  + INTERVAL '8 hours', false, 'user-demo-caiss2', 'pharmacie-demo-001'),
  ('sc-i1', 100000, 410000, 410000, 0, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '8 hours', false, 'user-demo-caiss3', 'pharmacie-demo-001'),
  ('sc-i2', 100000, 290000, 290000, 0, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '8 hours', false, 'user-demo-caiss3', 'pharmacie-demo-001');

-- ----------------------------------------------------------------
-- VENTES (26 sur 7 jours)
-- ----------------------------------------------------------------

-- Jour 6
INSERT INTO "Vente" (id, "montantTotal", "montantPaye", monnaie, remise, "modePaiement", statut, "pharmacieId", "userId", "clientId", "createdAt") VALUES
  ('v01', 19000, 19000, 0, 0, 'ESPECES',      'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss1', null, NOW() - INTERVAL '6 days'),
  ('v02', 12000, 12000, 0, 0, 'ORANGE_MONEY', 'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss2', null, NOW() - INTERVAL '6 days');
INSERT INTO "LigneVente" (id, quantite, "prixUnitaire", "venteId", "medicamentId") VALUES
  ('lv01a', 2,  5000, 'v01', 'med-d-para'),
  ('lv01b', 3,  3000, 'v01', 'med-d-chloro'),
  ('lv02a', 1, 12000, 'v02', 'med-d-am250');

-- Jour 5
INSERT INTO "Vente" (id, "montantTotal", "montantPaye", monnaie, remise, "modePaiement", statut, "pharmacieId", "userId", "clientId", "createdAt") VALUES
  ('v03', 41000, 41000, 0, 0, 'MTN_MONEY', 'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss1', null, NOW() - INTERVAL '5 days'),
  ('v04', 18000, 18000, 0, 0, 'ESPECES',   'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss3', null, NOW() - INTERVAL '5 days'),
  ('v05',  9000,  9000, 0, 0, 'ESPECES',   'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss2', null, NOW() - INTERVAL '5 days');
INSERT INTO "LigneVente" (id, quantite, "prixUnitaire", "venteId", "medicamentId") VALUES
  ('lv03a', 1, 25000, 'v03', 'med-d-arth'),
  ('lv03b', 2,  8000, 'v03', 'med-d-quini'),
  ('lv04a', 4,  2500, 'v04', 'med-d-ors'),
  ('lv04b', 2,  4000, 'v04', 'med-d-vitc'),
  ('lv05a', 2,  4500, 'v05', 'med-d-meben');

-- Jour 4 (dont 1 vente ANNULEE)
INSERT INTO "Vente" (id, "montantTotal", "montantPaye", monnaie, remise, "modePaiement", statut, "pharmacieId", "userId", "clientId", "createdAt") VALUES
  ('v06', 24000, 24000, 0, 0, 'ESPECES',      'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss1', null, NOW() - INTERVAL '4 days'),
  ('v07', 31000, 31000, 0, 0, 'ORANGE_MONEY', 'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss2', null, NOW() - INTERVAL '4 days'),
  ('v08', 15000, 15000, 0, 0, 'ESPECES',      'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss3', null, NOW() - INTERVAL '4 days'),
  ('v09',  7500,  7500, 0, 0, 'ESPECES',      'ANNULEE',  'pharmacie-demo-001', 'user-demo-caiss3', null, NOW() - INTERVAL '4 days');
INSERT INTO "LigneVente" (id, quantite, "prixUnitaire", "venteId", "medicamentId") VALUES
  ('lv06a', 1, 18000, 'v06', 'med-d-am500'),
  ('lv06b', 1,  6000, 'v06', 'med-d-metro'),
  ('lv07a', 3,  5000, 'v07', 'med-d-para'),
  ('lv07b', 2,  8000, 'v07', 'med-d-ibu'),
  ('lv08a', 2,  7500, 'v08', 'med-d-vitb'),
  ('lv09a', 1,  7500, 'v09', 'med-d-vitb');

-- Jour 3 (dont 1 vente CREDIT Oumar Touré)
INSERT INTO "Vente" (id, "montantTotal", "montantPaye", monnaie, remise, "modePaiement", statut, "pharmacieId", "userId", "clientId", "createdAt") VALUES
  ('v10', 50000, 18000, 0, 0, 'CREDIT',            'PARTIELLE', 'pharmacie-demo-001', 'user-demo-caiss1', 'client-demo-2', NOW() - INTERVAL '3 days'),
  ('v11', 22500, 22500, 0, 0, 'MTN_MONEY',         'COMPLETE',  'pharmacie-demo-001', 'user-demo-caiss2', null,            NOW() - INTERVAL '3 days'),
  ('v12', 17000, 17000, 0, 0, 'ESPECES',           'COMPLETE',  'pharmacie-demo-001', 'user-demo-caiss3', null,            NOW() - INTERVAL '3 days'),
  ('v13',  8000,  8000, 0, 0, 'PAIEMENT_MARCHAND', 'COMPLETE',  'pharmacie-demo-001', 'user-demo-caiss1', null,            NOW() - INTERVAL '3 days');
INSERT INTO "LigneVente" (id, quantite, "prixUnitaire", "venteId", "medicamentId") VALUES
  ('lv10a', 2, 25000, 'v10', 'med-d-arth'),
  ('lv11a', 5,  3000, 'v11', 'med-d-chloro'),
  ('lv11b', 3,  2500, 'v11', 'med-d-ors'),
  ('lv12a', 2,  6000, 'v12', 'med-d-smec'),
  ('lv12b', 1,  5000, 'v12', 'med-d-fer'),
  ('lv13a', 1,  8000, 'v13', 'med-d-quini');

-- Jour 2 (dont 1 vente CREDIT Kadiatou Diallo)
INSERT INTO "Vente" (id, "montantTotal", "montantPaye", monnaie, remise, "modePaiement", statut, "pharmacieId", "userId", "clientId", "createdAt") VALUES
  ('v14', 48000, 24000, 0, 0, 'CREDIT',       'PARTIELLE', 'pharmacie-demo-001', 'user-demo-caiss2', 'client-demo-3', NOW() - INTERVAL '2 days'),
  ('v15', 26000, 26000, 0, 0, 'ESPECES',      'COMPLETE',  'pharmacie-demo-001', 'user-demo-caiss1', null,            NOW() - INTERVAL '2 days'),
  ('v16', 13500, 13500, 0, 0, 'ORANGE_MONEY', 'COMPLETE',  'pharmacie-demo-001', 'user-demo-caiss3', null,            NOW() - INTERVAL '2 days'),
  ('v17', 17500, 17500, 0, 0, 'ESPECES',      'COMPLETE',  'pharmacie-demo-001', 'user-demo-caiss2', null,            NOW() - INTERVAL '2 days');
INSERT INTO "LigneVente" (id, quantite, "prixUnitaire", "venteId", "medicamentId") VALUES
  ('lv14a', 2, 18000, 'v14', 'med-d-am500'),
  ('lv14b', 3,  4000, 'v14', 'med-d-vitc'),
  ('lv15a', 4,  5000, 'v15', 'med-d-para'),
  ('lv15b', 2,  3000, 'v15', 'med-d-chloro'),
  ('lv16a', 3,  4500, 'v16', 'med-d-meben'),
  ('lv17a', 1,  7500, 'v17', 'med-d-vitb'),
  ('lv17b', 2,  5000, 'v17', 'med-d-fer');

-- Jour 1
INSERT INTO "Vente" (id, "montantTotal", "montantPaye", monnaie, remise, "modePaiement", statut, "pharmacieId", "userId", "clientId", "createdAt") VALUES
  ('v18', 75000, 75000, 0, 0, 'MTN_MONEY',   'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss1', null, NOW() - INTERVAL '1 day'),
  ('v19', 18000, 18000, 0, 0, 'ESPECES',     'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss3', null, NOW() - INTERVAL '1 day'),
  ('v20', 20500, 20500, 0, 0, 'ORANGE_MONEY','COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss2', null, NOW() - INTERVAL '1 day');
INSERT INTO "LigneVente" (id, quantite, "prixUnitaire", "venteId", "medicamentId") VALUES
  ('lv18a', 3, 25000, 'v18', 'med-d-arth'),
  ('lv19a', 2,  6000, 'v19', 'med-d-metro'),
  ('lv19b', 1,  6000, 'v19', 'med-d-smec'),
  ('lv20a', 1,  8000, 'v20', 'med-d-ibu'),
  ('lv20b', 5,  2500, 'v20', 'med-d-ors');

-- Aujourd'hui (jour 0)
INSERT INTO "Vente" (id, "montantTotal", "montantPaye", monnaie, remise, "modePaiement", statut, "pharmacieId", "userId", "clientId", "createdAt") VALUES
  ('v21', 14000, 14000, 0, 0, 'ESPECES',           'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss1', null, NOW()),
  ('v22', 25000, 25000, 0, 0, 'PAIEMENT_MARCHAND', 'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss2', null, NOW()),
  ('v23', 20000, 20000, 0, 0, 'MTN_MONEY',         'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss3', null, NOW()),
  ('v24', 24000, 24000, 0, 0, 'ESPECES',           'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss1', null, NOW()),
  ('v25', 11000, 11000, 0, 0, 'ORANGE_MONEY',      'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss2', null, NOW()),
  ('v26', 22500, 22500, 0, 0, 'ESPECES',           'COMPLETE', 'pharmacie-demo-001', 'user-demo-caiss3', null, NOW());
INSERT INTO "LigneVente" (id, quantite, "prixUnitaire", "venteId", "medicamentId") VALUES
  ('lv21a', 2,  5000, 'v21', 'med-d-para'),
  ('lv21b', 1,  4000, 'v21', 'med-d-vitc'),
  ('lv22a', 1, 25000, 'v22', 'med-d-arth'),
  ('lv23a', 4,  3000, 'v23', 'med-d-chloro'),
  ('lv23b', 1,  8000, 'v23', 'med-d-quini'),
  ('lv24a', 2, 12000, 'v24', 'med-d-am250'),
  ('lv25a', 1,  6000, 'v25', 'med-d-smec'),
  ('lv25b', 1,  5000, 'v25', 'med-d-fer'),
  ('lv26a', 2,  4500, 'v26', 'med-d-meben'),
  ('lv26b', 3,  2500, 'v26', 'med-d-ors');

-- ----------------------------------------------------------------
-- MOUVEMENTS STOCK
-- ----------------------------------------------------------------
INSERT INTO "MouvementStock" (id, type, quantite, "medicamentId", "userId", "createdAt") VALUES
  ('ms01', 'SORTIE', 2, 'med-d-para',   'user-demo-caiss1', NOW() - INTERVAL '6 days'),
  ('ms02', 'SORTIE', 3, 'med-d-chloro', 'user-demo-caiss1', NOW() - INTERVAL '6 days'),
  ('ms03', 'SORTIE', 1, 'med-d-am250',  'user-demo-caiss2', NOW() - INTERVAL '6 days'),
  ('ms04', 'SORTIE', 1, 'med-d-arth',   'user-demo-caiss1', NOW() - INTERVAL '5 days'),
  ('ms05', 'SORTIE', 2, 'med-d-quini',  'user-demo-caiss1', NOW() - INTERVAL '5 days'),
  ('ms06', 'SORTIE', 4, 'med-d-ors',    'user-demo-caiss3', NOW() - INTERVAL '5 days'),
  ('ms07', 'SORTIE', 2, 'med-d-vitc',   'user-demo-caiss3', NOW() - INTERVAL '5 days'),
  ('ms08', 'SORTIE', 2, 'med-d-meben',  'user-demo-caiss2', NOW() - INTERVAL '5 days'),
  ('ms09', 'SORTIE', 1, 'med-d-am500',  'user-demo-caiss1', NOW() - INTERVAL '4 days'),
  ('ms10', 'SORTIE', 1, 'med-d-metro',  'user-demo-caiss1', NOW() - INTERVAL '4 days'),
  ('ms11', 'SORTIE', 3, 'med-d-para',   'user-demo-caiss2', NOW() - INTERVAL '4 days'),
  ('ms12', 'SORTIE', 2, 'med-d-ibu',    'user-demo-caiss2', NOW() - INTERVAL '4 days'),
  ('ms13', 'SORTIE', 2, 'med-d-vitb',   'user-demo-caiss3', NOW() - INTERVAL '4 days'),
  ('ms14', 'SORTIE', 2, 'med-d-arth',   'user-demo-caiss1', NOW() - INTERVAL '3 days'),
  ('ms15', 'SORTIE', 5, 'med-d-chloro', 'user-demo-caiss2', NOW() - INTERVAL '3 days'),
  ('ms16', 'SORTIE', 3, 'med-d-ors',    'user-demo-caiss2', NOW() - INTERVAL '3 days'),
  ('ms17', 'SORTIE', 2, 'med-d-smec',   'user-demo-caiss3', NOW() - INTERVAL '3 days'),
  ('ms18', 'SORTIE', 1, 'med-d-fer',    'user-demo-caiss3', NOW() - INTERVAL '3 days'),
  ('ms19', 'SORTIE', 1, 'med-d-quini',  'user-demo-caiss1', NOW() - INTERVAL '3 days'),
  ('ms20', 'SORTIE', 2, 'med-d-am500',  'user-demo-caiss2', NOW() - INTERVAL '2 days'),
  ('ms21', 'SORTIE', 3, 'med-d-vitc',   'user-demo-caiss2', NOW() - INTERVAL '2 days'),
  ('ms22', 'SORTIE', 4, 'med-d-para',   'user-demo-caiss1', NOW() - INTERVAL '2 days'),
  ('ms23', 'SORTIE', 2, 'med-d-chloro', 'user-demo-caiss1', NOW() - INTERVAL '2 days'),
  ('ms24', 'SORTIE', 3, 'med-d-meben',  'user-demo-caiss3', NOW() - INTERVAL '2 days'),
  ('ms25', 'SORTIE', 1, 'med-d-vitb',   'user-demo-caiss2', NOW() - INTERVAL '2 days'),
  ('ms26', 'SORTIE', 2, 'med-d-fer',    'user-demo-caiss2', NOW() - INTERVAL '2 days'),
  ('ms27', 'SORTIE', 3, 'med-d-arth',   'user-demo-caiss1', NOW() - INTERVAL '1 day'),
  ('ms28', 'SORTIE', 2, 'med-d-metro',  'user-demo-caiss3', NOW() - INTERVAL '1 day'),
  ('ms29', 'SORTIE', 1, 'med-d-smec',   'user-demo-caiss3', NOW() - INTERVAL '1 day'),
  ('ms30', 'SORTIE', 1, 'med-d-ibu',    'user-demo-caiss2', NOW() - INTERVAL '1 day'),
  ('ms31', 'SORTIE', 5, 'med-d-ors',    'user-demo-caiss2', NOW() - INTERVAL '1 day'),
  ('ms32', 'SORTIE', 2, 'med-d-para',   'user-demo-caiss1', NOW()),
  ('ms33', 'SORTIE', 1, 'med-d-vitc',   'user-demo-caiss1', NOW()),
  ('ms34', 'SORTIE', 1, 'med-d-arth',   'user-demo-caiss2', NOW()),
  ('ms35', 'SORTIE', 4, 'med-d-chloro', 'user-demo-caiss3', NOW()),
  ('ms36', 'SORTIE', 1, 'med-d-quini',  'user-demo-caiss3', NOW()),
  ('ms37', 'SORTIE', 2, 'med-d-am250',  'user-demo-caiss1', NOW()),
  ('ms38', 'SORTIE', 1, 'med-d-smec',   'user-demo-caiss2', NOW()),
  ('ms39', 'SORTIE', 1, 'med-d-fer',    'user-demo-caiss2', NOW()),
  ('ms40', 'SORTIE', 2, 'med-d-meben',  'user-demo-caiss3', NOW()),
  ('ms41', 'SORTIE', 3, 'med-d-ors',    'user-demo-caiss3', NOW());

-- ----------------------------------------------------------------
-- COMMANDE FOURNISSEUR (statut RECUE)
-- ----------------------------------------------------------------
INSERT INTO "CommandeFournisseur" (id, statut, "montantTotal", "pharmacieId", "fournisseurId", "createdAt", "updatedAt") VALUES
  ('cmd-demo-001', 'RECUE', 285000, 'pharmacie-demo-001', 'fourn-demo-001', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');
INSERT INTO "LigneCommande" (id, quantite, "prixUnitaire", "commandeId", "medicamentId") VALUES
  ('lc01', 50, 1200, 'cmd-demo-001', 'med-d-chloro'),
  ('lc02', 30, 6000, 'cmd-demo-001', 'med-d-am250'),
  ('lc03', 40, 4500, 'cmd-demo-001', 'med-d-quini');

-- ----------------------------------------------------------------
-- DÉPENSES DÉMO (8)
-- ----------------------------------------------------------------
INSERT INTO "Depense" (id, libelle, montant, categorie, archivee, "pharmacieId", "userId", "createdAt") VALUES
  ('dep-d-1', 'Salaires du personnel — Mai 2026',  1200000, 'Salaires',                false, 'pharmacie-demo-001', 'user-demo-admin', NOW() - INTERVAL '55 days'),
  ('dep-d-2', 'Loyer du local — Mai 2026',           300000, 'Loyer',                   false, 'pharmacie-demo-001', 'user-demo-admin', NOW() - INTERVAL '55 days'),
  ('dep-d-3', 'Facture électricité & eau — Mai',      85000, 'Électricité & eau',        false, 'pharmacie-demo-001', 'user-demo-admin', NOW() - INTERVAL '40 days'),
  ('dep-d-4', 'Taxe patente & impôts trimestriels',  180000, 'Impôts & taxes',           false, 'pharmacie-demo-001', 'user-demo-admin', NOW() - INTERVAL '35 days'),
  ('dep-d-5', 'Salaires du personnel — Juin 2026',  1200000, 'Salaires',                false, 'pharmacie-demo-001', 'user-demo-admin', NOW() - INTERVAL '25 days'),
  ('dep-d-6', 'Loyer du local — Juin 2026',           300000, 'Loyer',                   false, 'pharmacie-demo-001', 'user-demo-admin', NOW() - INTERVAL '25 days'),
  ('dep-d-7', 'Réparation groupe électrogène',         65000, 'Réparations & entretien', false, 'pharmacie-demo-001', 'user-demo-admin', NOW() - INTERVAL '12 days'),
  ('dep-d-8', 'Fournitures de bureau et emballages',   45000, 'Fournitures & matériel',  false, 'pharmacie-demo-001', 'user-demo-admin', NOW() - INTERVAL '5 days');

-- ================================================================
-- VÉRIFICATION FINALE
-- ================================================================
SELECT table_name, total FROM (
  SELECT 'Pharmacies'      AS table_name, 1 AS ord, COUNT(*)::int AS total FROM "Pharmacie"
  UNION ALL SELECT 'Users',              2, COUNT(*) FROM "User"
  UNION ALL SELECT 'Medicaments',        3, COUNT(*) FROM "Medicament"
  UNION ALL SELECT 'Lots',               4, COUNT(*) FROM "Lot"
  UNION ALL SELECT 'Fournisseurs',       5, COUNT(*) FROM "Fournisseur"
  UNION ALL SELECT 'Clients',            6, COUNT(*) FROM "Client"
  UNION ALL SELECT 'SessionsCaisse',     7, COUNT(*) FROM "SessionCaisse"
  UNION ALL SELECT 'Ventes',             8, COUNT(*) FROM "Vente"
  UNION ALL SELECT 'LignesVente',        9, COUNT(*) FROM "LigneVente"
  UNION ALL SELECT 'MouvementsStock',   10, COUNT(*) FROM "MouvementStock"
  UNION ALL SELECT 'Commandes',         11, COUNT(*) FROM "CommandeFournisseur"
  UNION ALL SELECT 'LignesCommande',    12, COUNT(*) FROM "LigneCommande"
  UNION ALL SELECT 'Depenses',          13, COUNT(*) FROM "Depense"
) t ORDER BY ord;