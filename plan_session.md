

PharmaGest
Plan de Sessions Révisé v3.0

Basé sur l’audit complet du code de Sadio — 07/06/2026


Contexte de la révision
Sadio a créé des fichiers pour presque toutes les sessions prévues, mais avec des fonctionnalités incomplètes sur chaque module et 4 bugs bloquants qui empêchent le système de fonctionner correctement en production. Ce plan révisé ne repart pas de zéro : il s’appuie sur ce qui est solide, corrige ce qui est cassé, et complète ce qui manque.

Ce qui est solide et ne sera pas retouché :
•	Médicaments (API + interface) — complet
•	Lots & FIFO — complet et correct
•	Fournisseurs (API + interface) — complet
•	Authentification & middleware — complet
•	Dashboard SSE temps réel + VentesChart — complet
•	Audit log (createAuditLog) — présent partout
•	Personnel & Paramètres — complets
•	Export Excel/CSV (lib/export.ts) — complet
•	Email alerts (lib/email.ts + cron) — complet
•	Super Admin — complet

Récapitulatif des bugs critiques à corriger en priorité

#	Fichier	Bug	Impact
1	api/commandes/[id]/route.ts	medicamentId: ligne.id au lieu de ligne.medicamentId lors de RECUE — plus medicamentId absent du schéma LigneCommande	Tous les lots reçus sont corrompus
2	api/caisse/route.ts	Ouverture vérifie pharmacieId seulement, pas userId — un caissier bloque tous les autres	Multi-caisse impossible
3	api/ventes/route.ts	Aucun contrôle de stock avant la vente — decrementerLotFifo retourne false silencieusement	Vente possible à stock 0
4	api/inventaires/[id]/route.ts	motifEcart absent du schéma et de l’API — validation sans justification possible	Règle métier violée

Migrations SQL requises (Supabase SQL Editor)
Ces 5 changements de schéma doivent être appliqués avant de commencer le code de la Session A.

Migration 1 — LigneCommande : ajouter medicamentId
ALTER TABLE "LigneCommande" ADD COLUMN "medicamentId" TEXT;
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_medicamentId_fkey"
  FOREIGN KEY ("medicamentId") REFERENCES "Medicament"(id) ON DELETE SET NULL ON UPDATE CASCADE;

Migration 2 — LigneInventaire : ajouter motifEcart
ALTER TABLE "LigneInventaire" ADD COLUMN "motifEcart" TEXT;

Migration 3 — Depense : ajouter archivee et userId
ALTER TABLE "Depense" ADD COLUMN "archivee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Depense" ADD COLUMN "userId" TEXT;
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Depense_userId_idx" ON "Depense"("userId");

Migration 4 — Vente : ajouter remise
ALTER TABLE "Vente" ADD COLUMN "remise" FLOAT NOT NULL DEFAULT 0;

Migration 5 — MouvementStock : ajouter RETOUR dans l’enum
ALTER TYPE "TypeMouvement" ADD VALUE 'RETOUR';

Après chaque migration : mettre à jour schema.prisma localement pour qu’il reflète la BDD, puis npx prisma generate (sans migrate).

 
Plan de Sessions Révisé

SESSION A — Corrections critiques + Migrations schéma (2h) ⚠️ PRIORITÉ ABSOLUE
Objectif : Corriger les 4 bugs bloquants et aligner le schéma Prisma avec les migrations.

Tâches

1. Appliquer les 5 migrations SQL
Dans le Supabase SQL Editor (voir ci-dessus), puis mettre à jour schema.prisma et lancer npx prisma generate.

2. Corriger prisma/schema.prisma — 5 changements :
•	Ajouter medicamentId String? + relation sur LigneCommande
•	Ajouter motifEcart String? sur LigneInventaire
•	Ajouter archivee Boolean @default(false) et userId String? + relation sur Depense
•	Ajouter remise Float @default(0) sur Vente
•	Ajouter RETOUR dans l’enum TypeMouvement

3. Corriger Bug #2 — Caisse multi-caissiers dans src/app/api/caisse/route.ts :
•	Action ouvrir : la vérification doit filtrer sur { pharmacieId, userId: session.user.id, dateCloture: null, actif: true } — chaque caissier a sa propre session indépendante.
•	Action fermer : idem, filtrer sur userId: session.user.id pour ne fermer que sa propre session.
•	GET : renvoyer la session active de l’utilisateur connecté uniquement, pas la première session ouverte de la pharmacie.

4. Corriger Bug #3 — Blocage stock zéro dans src/app/api/ventes/route.ts :
•	Avant la boucle de calcul montantTotal, pour chaque ligne, récupérer le stock total via prisma.lot.aggregate({ where: { medicamentId: ligne.medicamentId, actif: true }, _sum: { quantite: true } }).
•	Si stockTotal < ligne.quantite → retourner apiError('Stock insuffisant pour ${nom}: ${stockTotal} disponible(s)', 400).
•	Cette vérification doit se faire avant la transaction, pour toutes les lignes à la fois.

5. Corriger Bug #4 — motifEcart inventaire dans src/app/api/inventaires/[id]/route.ts :
•	Action valider : avant de valider, vérifier que toutes les lignes où ecart !== 0 ont un motifEcart non vide.
•	Si une ligne manque son motif : return apiError('Motif obligatoire pour chaque écart', 400).
•	Action saisir : accepter et sauvegarder motifEcart dans le ligneInventaire.update.

6. Corriger Bug #1 — Réception commandes dans src/app/api/commandes/[id]/route.ts :
•	Ajouter medicamentId String? dans la création de LigneCommande au POST /api/commandes.
•	Dans PATCH action RECUE : utiliser ligne.medicamentId (pas ligne.id) pour créer le lot, et créer également un MouvementStock de type ENTREE avec userId: session.user.id pour chaque ligne.
•	Ajouter une vérification : si ligne.medicamentId est null → skip la création de lot avec un log.

Commits git
fix(schema): ajouter medicamentId LigneCommande, motifEcart LigneInventaire, archivee Depense, remise Vente, RETOUR TypeMouvement
fix(caisse): corriger session multi-caissiers — filtrer par userId a l'ouverture et fermeture
fix(ventes): ajouter blocage stock zero avant transaction — verifier chaque ligne
fix(inventaire): exiger motifEcart si ecart != 0 avant validation
fix(commandes): corriger medicamentId lors reception + creer MouvementStock ENTREE

Tests fin de session
□	Caissier A ouvre une session → Caissier B peut ouvrir la sienne → chacun voit sa propre session
□	Vente médicament à stock 0 → message « Stock insuffisant » → transaction non créée
□	Inventaire avec écart → valider sans motif → bloqué → ajouter motif → passe
□	Réceptionner commande → lots créés avec le bon medicamentId → mouvements ENTREE présents

SESSION B — Module Dépenses complet (1h30)
Objectif : Finaliser le module dépenses avec droits corrects, archivage, PATCH Admin et catégories pré-remplies dans le seed.

Tâches

1. Corriger les droits POST dépenses dans src/app/api/depenses/route.ts :
•	Supprimer if (session.user.role === 'CAISSIER') return apiError(...) — le plan v2.4 autorise le caissier à saisir une dépense.
•	Ajouter userId: session.user.id dans le prisma.depense.create.

2. Créer src/app/api/depenses/[id]/route.ts — deux méthodes :
•	PATCH : Admin uniquement (if role === 'CAISSIER' → 403). Met à jour libelle, montant, categorie. Crée un AuditLog DEPENSE_MODIFIEE.
•	DELETE (archivage logique) : Admin uniquement. prisma.depense.update({ data: { archivee: true } }). Crée un AuditLog DEPENSE_ARCHIVEE. Jamais de suppression physique.

3. Modifier le GET dépenses dans src/app/api/depenses/route.ts :
•	Ajouter archivee: false dans le filtre where pour exclure les dépenses archivées de la liste.
•	Ajouter filtre par categorie via searchParams.get('categorie').

4. Ajouter les catégories pré-remplies dans prisma/seed.ts :
•	Catégories standard : Salaires, Loyer, Electricité & eau, Impôts & taxes, Fournitures & matériel, Réparations & entretien, Autres charges.

5. Mettre à jour la page src/app/(dashboard)/depenses/page.tsx :
•	Remplacer les catégories hardcodées dans le <select> par les 7 catégories standard du plan.
•	Ajouter un bouton « Archiver » (visible Admin seulement, via useSession) sur chaque ligne du tableau qui appelle DELETE /api/depenses/[id].
•	Après archivage : retirer la ligne du state local.

Commits git
fix(depenses): autoriser caissier a saisir, ajouter userId obligatoire
feat(depenses): creer routes PATCH et archivage /api/depenses/[id]
fix(depenses): filtrer archivees=false dans GET, ajouter filtre categorie
feat(seed): documenter categories depenses standard
feat(depenses): ajouter bouton archivage Admin dans interface

Tests fin de session
□	Caissier saisit une dépense → OK (n’était plus possible)
□	Caissier tente d’archiver → 403
□	Admin archive une dépense → archivee = true en BDD → n’apparaît plus dans la liste
□	AuditLog DEPENSE_AJOUTEE présent avec userId renseigné

SESSION C — Module Clients & Crédits complet (2h)
Objectif : Compléter le module clients avec fiche individuelle, remboursements, vérification plafond au POS, et tableau de bord crédits Admin.

Tâches

1. Créer src/app/api/clients/[id]/route.ts — trois méthodes :
•	GET : retourner la fiche client avec ses ventes (include: { ventes: { orderBy: { createdAt: 'desc' }, take: 20, include: { lignes: { include: { medicament: true } } } } }). Filtrer par pharmacieId.
•	PATCH : Admin uniquement. Permet de modifier nom, telephone, email, plafondCredit. AuditLog CLIENT_MODIFIE.
•	DELETE (archivage) : Admin uniquement. actif: false. AuditLog CLIENT_ARCHIVE.

2. Créer src/app/api/clients/[id]/rembourser/route.ts — méthode POST :
•	Body : { montant: number, note?: string }.
•	Vérifier que montant > 0 et montant <= client.soldeCredit.
•	Transaction : client.update({ data: { soldeCredit: { decrement: montant } } }) + AuditLog REMBOURSEMENT_ENREGISTRE avec details: { clientId, montant, note }.
•	Retourner le client mis à jour avec le nouveau solde.

3. Ajouter vérification plafond dans src/app/api/ventes/route.ts :
•	Si clientId est fourni et statut === 'PARTIELLE' : avant la transaction, récupérer le client et vérifier client.soldeCredit + resteADu <= client.plafondCredit.
•	Si dépassement → apiError('Plafond de crédit dépassé. Solde actuel: X GNF, Plafond: Y GNF', 400).

4. Créer src/app/(dashboard)/clients/[id]/page.tsx — fiche client :
•	Section infos : nom, téléphone, email, solde crédit (rouge si > 0), plafond, bouton « Modifier » (Admin).
•	Section remboursement : formulaire montant + note → POST /api/clients/[id]/rembourser → met à jour l’affichage du solde en temps réel.
•	Section historique achats : tableau des 20 dernières ventes avec date, montant, statut.

5. Créer src/app/(dashboard)/credits/page.tsx — tableau de bord Admin :
•	Accessible Admin uniquement (vérification via useSession côté client + route protégée middleware).
•	Appelle GET /api/clients?avecCredit=true (ajouter ce filtre : soldeCredit: { gt: 0 }).
•	Affiche : tableau nom / solde dû / plafond / taux d’utilisation (solde/plafond en %) / bouton « Voir fiche ».
•	KPI en haut : total dû toutes pharmacies, nombre de clients en retard, plus gros débiteur.

6. Ajouter /credits dans le middleware src/middleware.ts :
•	Ajouter '/credits/:path*' dans le matcher.
•	Ajouter dans la fonction middleware : if (pathname.startsWith('/credits') && token?.role === 'CAISSIER') → redirect('/dashboard').

7. Ajouter le lien /credits dans src/components/Sidebar.tsx — visible Admin uniquement.

Commits git
feat(clients): creer routes GET, PATCH, archivage /api/clients/[id]
feat(clients): creer route remboursement /api/clients/[id]/rembourser
fix(ventes): ajouter verification plafond credit avant transaction
feat(clients): creer page fiche client avec historique et remboursement
feat(credits): creer tableau de bord credits Admin
fix(middleware): ajouter protection route /credits pour caissiers

Tests fin de session
□	Plafond : client solde 45 000, plafond 50 000, vente crédit 8 000 → bloqué
□	Remboursement 10 000 → soldeCredit décrémente en BDD → KPI mis à jour
□	Caissier tente d’accéder à /credits → redirigé vers dashboard

SESSION D — POS complet : remises, modes paiement, annulation (2h)
Objectif : Compléter le POS avec les fonctionnalités manquantes (remise, modes paiement, annulation Admin, page détail vente).

Tâches

1. Mettre à jour src/app/api/ventes/route.ts — POST :
•	Accepter remise: number (montant fixe en GNF) dans le body.
•	Calcul : montantTotal = somme lignes - remise. Si remise < 0 ou remise > somme lignes → apiError.
•	Sauvegarder remise dans prisma.vente.create.
•	Accepter les nouveaux modes : ORANGE_MONEY, MTN_MONEY, PAIEMENT_MARCHAND — mettre à jour l’enum ModePaiement dans schema.prisma et appliquer la migration.

2. Migration SQL — ModePaiement (Supabase SQL Editor avant de coder) :
ALTER TYPE "ModePaiement" ADD VALUE 'ORANGE_MONEY';
ALTER TYPE "ModePaiement" ADD VALUE 'MTN_MONEY';
ALTER TYPE "ModePaiement" ADD VALUE 'PAIEMENT_MARCHAND';

3. Mettre à jour src/app/(dashboard)/ventes/page.tsx — interface POS :
•	Ajouter un champ « Remise (GNF) » avec recalcul automatique du total affiché.
•	Remplacer le <select> mode paiement pour inclure : Espèces, Orange Money, MTN Money, Paiement marchand, Mobile Money (générique), Crédit.
•	Le reçu affiché après validation doit afficher la remise si > 0.
•	Envoyer remise dans le body du POST.

4. Créer src/app/api/ventes/[id]/annuler/route.ts — méthode POST :
•	Admin uniquement.
•	Body : { motif: string } — obligatoire.
•	Transaction atomique : vente.update({ data: { statut: 'ANNULEE' } }), pour chaque LigneVente → remise en stock FIFO + MouvementStock { type: 'RETOUR' }, si vente crédit → décrémenter client.soldeCredit, AuditLog VENTE_ANNULEE.

5. Créer src/app/(dashboard)/ventes/[id]/page.tsx — page détail vente :
•	Afficher : date, caissier, client, mode paiement, remise si > 0, lignes avec quantités et prix, total, statut.
•	Bouton « Annuler la vente » visible Admin uniquement → modal confirmation + champ motif → POST /api/ventes/[id]/annuler.

6. Lien « Détail » dans src/app/(dashboard)/ventes/historique/page.tsx :
•	Remplacer le bouton « Voir » (qui ouvre une modal) par un <Link href={/ventes/${v.id}}> vers la page dédiée.

Commits git
feat(schema): ajouter ORANGE_MONEY, MTN_MONEY, PAIEMENT_MARCHAND dans ModePaiement
feat(ventes): ajouter remise dans API POST et calcul montantTotal
feat(pos): ajouter champ remise et nouveaux modes paiement dans interface
feat(ventes): creer route POST /api/ventes/[id]/annuler avec remise en stock
feat(ventes): creer page detail vente /ventes/[id]
fix(historique): remplacer modal par lien vers page detail

Tests fin de session
□	Vente avec remise 5 000 GNF → montantTotal = somme - 5 000 → reçu affiche remise
□	Annulation Admin : stock remonte dans le bon lot + MouvementStock RETOUR créé
□	Annulation d’une vente crédit → soldeCredit du client décrémenté
□	Caissier tente d’annuler → 403

SESSION E — Stock : vue mouvements + commandes suggérées (1h30)
Objectif : Compléter le module stock avec le journal des mouvements, et ajouter les commandes suggérées automatiques.

Tâches

1. Créer src/app/api/stock/mouvements/route.ts — méthode GET :
•	Paramètres : ?medicamentId=, ?type= (ENTREE/SORTIE/AJUSTEMENT/RETOUR), ?debut=, ?fin=, ?page=, ?limit=20.
•	Requête SQL optimisée avec jointures sur Medicament et User, tri par createdAt DESC, pagination.
•	Retourner aussi le total pour la pagination.

2. Créer src/app/(dashboard)/stock/mouvements/page.tsx :
•	Filtres en haut : sélecteur médicament, type de mouvement, période (date début/fin).
•	Tableau : date, médicament, type (badge coloré : vert=ENTREE, rouge=SORTIE, orange=AJUSTEMENT, bleu=RETOUR), quantité, user.
•	Pagination simple (Précédent / Suivant).
•	Lien « Journal des mouvements » dans la Sidebar sous « Stock ».

3. Créer src/app/api/commandes/suggerer/route.ts — méthode GET :
•	Récupérer tous les médicaments actifs dont stockTotal < stockMinimum.
•	Pour chaque médicament, calculer la quantité suggérée : Math.max(stockMinimum * 2 - stockTotal, stockMinimum).
•	Retourner : [{ medicamentId, nom, stockActuel, stockMinimum, quantiteSuggeree }].

4. Mettre à jour src/app/(dashboard)/fournisseurs/commandes/page.tsx :
•	Ajouter un bouton « 📋 Commandes suggérées » à côté de « + Nouvelle commande ».
•	Au clic : fetch GET /api/commandes/suggerer → afficher un panel/modal avec la liste des médicaments sous seuil et les quantités suggérées.

5. Ajouter le lien mouvements dans src/components/Sidebar.tsx :
•	Ajouter { href: '/stock/mouvements', label: 'Mouvements stock', icon: '🔄' } sous /stock.

Commits git
feat(stock): creer route GET /api/stock/mouvements avec filtres et pagination
feat(stock): creer page journal des mouvements
feat(commandes): creer route GET /api/commandes/suggerer
feat(commandes): ajouter panel commandes suggerees dans interface

Tests fin de session
□	Après une vente : le mouvement SORTIE apparaît dans le journal
□	Médicament sous stockMinimum → apparaît dans les suggestions avec quantité calculée
□	Filtre par type RETOUR → affiche uniquement les annulations

SESSION F — Inventaire : interface saisie + rapport écart (1h30)
Objectif : L’inventaire existe en BDD et en API, mais l’interface ne permet pas la saisie avec motif. Corriger et compléter.
Rappel : Bug #4 (motifEcart) est déjà corrigé en Session A. Cette session se concentre sur l’interface.

Tâches

1. Mettre à jour src/app/(dashboard)/inventaire/page.tsx :
•	Ajouter le champ motif dans le tableau de saisie : une colonne « Motif de l’écart » — champ <input type="text"> qui s’affiche uniquement si ecart !== 0.
•	Le motif doit être requis visuellement (bordure rouge si vide et écart ≠ 0) avant de permettre la validation.
•	Mettre à jour mettreAJourQuantite pour stocker aussi le motifEcart dans le state local.
•	Passer motifEcart dans le body du PATCH action: 'saisir'.

2. Ajouter le rapport d’écart en bas de la page :
•	Nombre de lignes avec écart positif (surplus).
•	Nombre de lignes avec écart négatif (manque).
•	Valeur totale des écarts en GNF (calculée localement : |ecart| × prixAchat pour chaque ligne).
•	Ce récapitulatif se met à jour en temps réel pendant la saisie.

3. Améliorer la liste des inventaires :
•	Dans la liste (quand actif est null), ajouter les colonnes : nb de lignes, nb d’écarts, lien « Revoir ».
•	Quand on clique « Revoir » sur un inventaire VALIDE → afficher en lecture seule le résumé des écarts avec leurs motifs.

Commits git
feat(inventaire): ajouter champ motifEcart dans interface saisie
feat(inventaire): ajouter rapport ecart en temps reel
feat(inventaire): ameliorer liste avec nb ecarts et vue lecture seule

Tests fin de session
□	Saisir une quantité différente → champ motif apparaît → validation sans motif bloquée
□	Rapport écart affiche la valeur totale en GNF correctement
□	Valider → motifEcart stocké en BDD → visible dans vue lecture seule

SESSION G — Backup BDD + Relances crédits WhatsApp (2h)
Objectif : Implémenter le backup quotidien Backblaze B2 et les relances automatiques clients en retard.

Tâches

1. Créer src/app/api/cron/backup/route.ts :
•	Méthode GET, protégée par CRON_SECRET dans les headers (pas de session NextAuth).
•	Exporter les données critiques via Prisma en JSON (ventes du mois, stock, dépenses) et uploader vers Backblaze B2 via l’API HTTP B2.
•	Uploader vers le bucket pharmagest-backups avec le nom backup-${pharmacieId}-${date}.json.
•	Ne jamais logger les clés B2.
•	Variables .env requises : B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID.

2. Créer src/lib/cron/relances.ts — relances crédit clients :
•	Fonction envoyerRelancesCredit(pharmacieId: string).
•	Récupérer tous les clients actifs avec soldeCredit > 0.
•	Pour chaque client avec telephone renseigné, générer le lien WhatsApp wa.me/ avec message de relance personnalisé.
•	Utiliser la date de la dernière vente partielle du client comme référence pour la logique J-3 / J+0 / J+7.

3. Intégrer les relances dans src/app/api/cron/alertes/route.ts :
•	Ajouter l’appel à envoyerRelancesCredit dans le cron existant.
•	Retourner aussi { relancesEnvoyees: number } dans la réponse.

4. Configurer le cron Vercel dans vercel.json (créer à la racine) :
{ "crons": [
  { "path": "/api/cron/alertes", "schedule": "0 7 * * *" },
  { "path": "/api/cron/backup", "schedule": "0 2 * * *" }
]}

5. Ajouter CRON_SECRET, B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID dans les variables Vercel.

Commits git
feat(backup): creer cron backup quotidien vers Backblaze B2
feat(relances): creer lib relances credits clients WhatsApp
feat(cron): integrer relances dans cron alertes quotidien
chore: configurer vercel.json avec crons

Tests fin de session
□	Appel manuel GET /api/cron/backup → fichier JSON apparaît dans B2
□	Client avec solde > 0 et téléphone → lien WhatsApp généré correctement

SESSION H — Export PDF rapports + Tests sécurité (2h)
Objectif : Ajouter l’export PDF aux rapports et effectuer les tests de sécurité multi-tenant.

Tâches

1. Installer @react-pdf/renderer :
npm install @react-pdf/renderer

2. Créer src/components/rapports/RapportPDF.tsx :
•	Composant React PDF générique avec Document, Page, View, Text de @react-pdf/renderer.
•	Header : nom pharmacie, type de rapport, période, date de génération.
•	Corps : tableau des données (ventes / stock / crédits / bénéfice).
•	Footer : « PharmaGest — Pilotée par vous, où que vous soyez ».

3. Ajouter le bouton « Exporter PDF » dans src/app/(dashboard)/rapports/page.tsx :
•	À côté des boutons Excel/CSV existants.
•	Utiliser pdf(<RapportPDF data={data} />).toBlob() puis URL.createObjectURL pour déclencher le téléchargement.

4. Tests de sécurité multi-tenant — à documenter dans JOURNAL.md :
•	Test 1 : Depuis la pharmacie A, appeler GET /api/medicaments et GET /api/ventes → vérifier que les données de la pharmacie B n’apparaissent jamais.
•	Test 2 : Prendre un ID de médicament appartenant à la pharmacie B et appeler GET /api/medicaments/[id_B] depuis un token de la pharmacie A → doit retourner 404.
•	Test 3 : Appeler toutes les routes API sans token → doivent retourner 401.
•	Test 4 : Avec un token CAISSIER, appeler PATCH /api/medicaments/[id], DELETE /api/medicaments/[id], POST /api/depenses, GET /api/credits → vérifier les 403.
•	Corriger toute faille trouvée avant de continuer.

Commits git
feat(rapports): ajouter composant RapportPDF avec react-pdf
feat(rapports): ajouter bouton export PDF dans page rapports
fix(security): corriger failles detectees lors des tests multi-tenant

Tests fin de session
□	Rapport bénéfice → « Exporter PDF » → fichier PDF téléchargé avec les bons chiffres
□	Tous les tests sécurité passent sans fuite de données

SESSION I — Optimisations + Domaine + Lancement 🚀 (2h)
Objectif : Optimiser les performances, configurer le domaine, et mettre en production officielle.

Tâches

1. Optimiser la requête dashboard dans src/app/api/dashboard/route.ts :
•	Remplacer la boucle de 7 requêtes séparées pour le graphique CA 7 jours par une seule requête GROUP BY DATE.
•	Vérifier les index PostgreSQL — tous les index définis dans schema.prisma sont-ils bien créés en BDD ? Vérifier via Supabase.

2. Test performance POS :
•	Simuler 20 ventes consécutives rapides — le temps de réponse du POST /api/ventes doit rester sous 1 seconde.

3. Configurer le domaine personnalisé sur Vercel :
•	Dans le tableau de bord Vercel → Settings → Domains → ajouter le domaine pharmagest.app (ou le domaine choisi).
•	Configurer les DNS chez le registrar.
•	Vérifier que HTTPS est actif et que les redirections HTTP → HTTPS fonctionnent.

4. Créer le mode démo :
•	Dans prisma/seed.ts, ajouter un bloc if (process.env.SEED_MODE === 'demo') qui crée une pharmacie démo avec 3 mois de ventes fictives, une dizaine de médicaments avec différents niveaux de stock, quelques dépenses et clients avec solde.
•	Documenter les identifiants démo dans le README.

5. Mettre à jour CONTEXTE.md — section « Projet lancé » :
•	Date de lancement, URL de production, liste des fonctionnalités livrées.

6. Dernière mise à jour JOURNAL.md — entrée « Lancement officiel de PharmaGest ».

Commits git
perf(dashboard): remplacer boucle 7 requetes par GROUP BY DATE
perf(db): verifier et confirmer index PostgreSQL actifs
feat(seed): ajouter mode demo avec donnees fictives
chore: configurer domaine et variables env production
chore(docs): mettre a jour CONTEXTE.md — projet lance

Tests fin de session
□	🚀 Application accessible sur le domaine de production
□	Mode démo : connexion avec identifiants démo → données pré-remplies visibles
□	Dashboard : temps de chargement < 2 secondes

 
Tableau de suivi révisé

Session	Contenu	Durée	Statut
Sessions 1-7	Phase 1 complète	—	✅ Terminées
Session 8	Dashboard données réelles	2h	✅ Terminée
Sessions 9-16	Réalisées par Sadio (incomplètes)	—	⚠️ À corriger
Sessions 17-24	Réalisées par Sadio (partielles)	—	⚠️ À vérifier
Session A	Bugs critiques + Migrations	2h	□ À faire
Session B	Dépenses complet	1h30	□ À faire
Session C	Clients & Crédits complet	2h	□ À faire
Session D	POS complet	2h	□ À faire
Session E	Stock mouvements + Commandes suggérées	1h30	□ À faire
Session F	Inventaire interface complète	1h30	□ À faire
Session G	Backup + Relances crédits	2h	□ À faire
Session H	Export PDF + Tests sécurité	2h	□ À faire
Session I	Optimisations + Lancement 🚀	2h	□ À faire

Total sessions restantes : 9 sessions — environ 3 à 4 semaines au rythme de 3 sessions/semaine.

Notes importantes pour l’exécution

1.	Session A est bloquante — ne pas commencer B, C, D, E, F sans avoir terminé A. Les bugs de caisse et stock zéro rendront les tests impossibles.

2.	Ordre des sessions B-F est flexible sauf dépendances :
•	Session D (POS remises) dépend de la migration remise faite en A.
•	Session C (Clients) dépend de la correction du plafond faite en A.
•	Sessions E et F sont indépendantes.

3.	Pour chaque session : git pull → nouvelle branche → code → tests → commit → push → PR → merge.

4.	Sadio doit lire ce plan complet + CONTEXTE.md avant de reprendre. Aucune session ne doit être commencée sans avoir lu les règles métier qui s’appliquent.

5.	PWA Offline (IndexedDB) n’est pas dans ce plan révisé — c’est délibéré. Cette fonctionnalité complexe (db.ts, queue.ts, sync.ts) sera traitée après le lancement officiel comme amélioration v2, une fois que la pharmacie pilote aura validé le MVP.

