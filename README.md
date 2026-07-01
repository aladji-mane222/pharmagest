# PharmaGest

**Application web SaaS de gestion de pharmacie multi-tenant**, conçue pour les pharmacies d'Afrique francophone. Développée avec Next.js 14, elle permet à une pharmacie de gérer l'intégralité de son activité quotidienne depuis un navigateur, sans installation locale.

**Production :** https://pharmagest-zeta.vercel.app  
**Repo :** https://github.com/aladji-mane222/pharmagest  
**Stack :** Next.js 14 (App Router) · TypeScript · Prisma 5.22.0 · Supabase (PostgreSQL) · NextAuth 4 · Tailwind CSS

---

## Fonctionnalités

### Point de vente (POS)
- Interface caisse 2 panneaux : recherche médicament + panier
- Calcul automatique du total, de la monnaie rendue et de la remise
- Modes de paiement : Espèces, Orange Money, MTN Money, Paiement Marchand, Crédit
- Vente à crédit : incrémentation automatique du solde client
- Impression du reçu et partage WhatsApp
- Blocage automatique si stock insuffisant avant toute transaction

### Gestion du stock
- Gestion par lots avec traçabilité FIFO (premier périmé, premier sorti)
- Alertes stock bas (sous le seuil minimum défini par médicament)
- Alertes péremptions proches (< 90 jours)
- Journal des mouvements (entrées, sorties, ajustements, retours)
- Vue globale du stock par médicament avec total consolidé

### Caisse
- Ouverture et fermeture de session par caissier
- Isolation stricte : chaque caissier gère uniquement sa propre session
- Calcul automatique du montant attendu et de l'écart à la clôture

### Clients & Crédits
- Fiche client avec historique des 20 dernières ventes
- Suivi du solde crédit et du plafond par client
- Remboursement de crédit avec audit
- Tableau de bord Admin : liste des clients avec solde > 0, barre de progression du plafond

### Commandes fournisseurs
- Création de commandes avec sélection de médicaments et prix unitaires
- Workflow de statuts : Brouillon → Envoyée → Reçue → Annulée
- Réception automatique : création des lots et mouvements ENTREE
- Suggestions automatiques : médicaments sous seuil avec quantité recommandée

### Inventaire
- Lancement d'un inventaire (un seul EN_COURS à la fois par pharmacie)
- Saisie des quantités réelles par médicament
- Motif d'écart obligatoire si stock réel ≠ stock théorique
- Rapport d'écart en temps réel : surplus, manques, impact financier GNF
- Validation avec ajustement automatique des lots (FIFO)

### Dépenses
- Saisie par le Caissier ou l'Admin (7 catégories standard)
- Modification et archivage logique réservés à l'Admin
- Filtres par catégorie et par mois

### Rapports
- Chiffre d'affaires du jour et du mois
- Bénéfice net : CA − CMV (FIFO) − Dépenses
- Top médicaments vendus
- Rapport crédits clients
- Export Excel/CSV et PDF

### Dashboard temps réel
- CA du jour mis à jour en temps réel via SSE (Server-Sent Events)
- Graphique CA des 7 derniers jours
- Alertes stock bas et péremptions proches
- Statut session caisse (ouverte / fermée)

### Administration
- Gestion du personnel (création, modification, désactivation)
- Paramètres pharmacie (nom, adresse, contact)
- Journal d'audit complet (toutes les actions traçées)
- Panneau Super Admin : gestion des licences multi-pharmacies

### Automatisations (crons Vercel)
- **7h UTC** : alertes email stock bas + péremptions + génération des liens WhatsApp de relance crédit
- **2h UTC** : backup JSON de toutes les tables vers Backblaze B2

---

## Modules et routes

| Module | Route | Rôles |
|--------|-------|-------|
| Dashboard | `/dashboard` | Tous |
| Point de vente | `/ventes` | Tous |
| Historique ventes | `/ventes/historique` | Tous |
| Détail vente + annulation | `/ventes/[id]` | Tous / Admin |
| Caisse | `/caisse` | Tous |
| Médicaments | `/medicaments` | Tous (lecture) / Admin (écriture) |
| Stock global | `/stock` | Tous |
| Mouvements stock | `/stock/mouvements` | Tous |
| Clients | `/clients` | Tous |
| Tableau crédits | `/credits` | Admin |
| Fournisseurs | `/fournisseurs` | Admin |
| Commandes fournisseurs | `/fournisseurs/commandes` | Admin |
| Inventaire | `/inventaire` | Admin |
| Dépenses | `/depenses` | Tous (saisie) / Admin (archivage) |
| Rapports | `/rapports` | Admin |
| Journal audit | `/rapports/audit` | Admin |
| Personnel | `/personnel` | Admin |
| Paramètres | `/parametres` | Admin |
| Super Admin | `/superadmin` | Super Admin |

---

## Comptes de démonstration

### Pharmacie Horizon *(données pré-remplies)*
15 médicaments · 26 ventes sur 7 jours · 5 clients · 2 clients avec crédit en cours · alertes stock bas et péremptions actives · 3 caissiers indépendants à tester simultanément

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@demo.pharmagest.com | Demo1234! |
| Caissier | fatou@demo.pharmagest.com | Demo1234! |
| Caissier | mamadou@demo.pharmagest.com | Demo1234! |
| Caissier | ibrahima@demo.pharmagest.com | Demo1234! |

### Pharmacie Centrale de Conakry *(pharmacie de test)*

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@pharmaciecentrale.gn | Admin1234! |
| Caissier | caissier@pharmaciecentrale.gn | Caissier1234! |

---

## Variables d'environnement

Deux fichiers sont requis localement (jamais commités) — les valeurs sont disponibles dans le dashboard Vercel → Settings → Environment Variables.

### `.env` *(utilisé par Prisma uniquement)*

```env
# Connexion directe Supabase — port 5432
# Utilisé par Prisma pour npx prisma generate
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# Connexion via PgBouncer — port 6543
# Utilisé pour les migrations (si accessibles)
DIRECT_URL="postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&statement_cache_size=0"
```

### `.env.local` *(utilisé par Next.js en développement)*

```env
# Même URLs que .env — nécessaires pour les routes API à l'exécution
DATABASE_URL="..."
DIRECT_URL="..."

# NextAuth — clé secrète (générer avec : node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
NEXTAUTH_SECRET="votre-secret-32-caracteres"

# URL de l'application (localhost en dev, domaine en prod)
NEXTAUTH_URL="http://localhost:3000"

# Email admin pour les alertes automatiques
EMAIL_ADMIN="votre@email.com"

# SMTP pour l'envoi d'emails (alertes stock bas, péremptions)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="votre@gmail.com"
SMTP_PASS="votre-mot-de-passe-application"

# Backblaze B2 pour les backups quotidiens
B2_KEY_ID="votre-key-id"
B2_APPLICATION_KEY="votre-application-key"
B2_BUCKET_ID="votre-bucket-id"

# Secret partagé pour sécuriser les endpoints cron
# Générer avec : node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
CRON_SECRET="votre-secret-cron"
```

---

## Installation locale

```bash
git clone https://github.com/aladji-mane222/pharmagest
cd pharmagest
npm install
```

Recréer `.env` et `.env.local` depuis le dashboard Vercel, puis :

```bash
npm run dev
```

---

## Contraintes d'infrastructure — Guinée

> Ces contraintes sont permanentes et non négociables. Tout nouveau développeur doit les lire avant de toucher au projet.

### Ports bloqués par les opérateurs réseau

Les ports **5432** (PostgreSQL direct) et **6543** (PgBouncer Supabase) sont bloqués par les opérateurs réseau en Guinée.

**Conséquences directes :**

- `prisma migrate dev` est **inutilisable** depuis Conakry — ne jamais l'exécuter
- `prisma studio` ne fonctionne pas sur la machine Windows locale
- `npx ts-node prisma/seed.ts` échoue car Prisma ne peut pas joindre la BDD

**Ce qu'on fait à la place :**

- Toutes les migrations SQL sont appliquées manuellement dans le **Supabase SQL Editor**
- Les ajouts de valeurs d'enum (`ALTER TYPE ... ADD VALUE`) doivent être exécutés **seuls** dans un onglet dédié — ils échouent dans une transaction groupée
- Le seed est exécuté via `prisma/seed_demo.sql` dans le Supabase SQL Editor
- La vérification des données se fait via le **Supabase Table Editor** (Prisma Studio non fonctionnel)

### Latence réseau Conakry → Europe

Latence moyenne : **250–350ms par requête** vers les serveurs Supabase en Europe.

**Règles de code imposées :**

- Utiliser `prisma.$queryRaw` pour toutes les listes avec jointures ou agrégats — 10x plus rapide que l'ORM classique sur haute latence
- Ne jamais faire de requête Prisma dans une boucle `.map()` ou `for` (problème N+1)
- Utiliser `prisma.$transaction` pour toutes les opérations critiques (ventes, inventaires, réceptions)
- Utiliser `Promise.all([...])` pour les requêtes parallèles indépendantes

### Prisma — version fixée

`npm install` sans version explicite installe Prisma 7, incompatible avec la syntaxe `url`/`directUrl` utilisée dans ce projet.

Toujours forcer :
```bash
npm install prisma@5.22.0 @prisma/client@5.22.0 --save-dev
```

### Autres contraintes Windows

- `openssl` absent — utiliser `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` pour générer des secrets
- Les chemins PowerShell contenant des parenthèses (ex: `(dashboard)`) doivent être entre guillemets dans `git add`
- Les variables d'environnement ne sont jamais commitées — les recréer depuis Vercel après chaque clone frais

---

## Workflow de développement

```bash
# Démarrer une nouvelle session
git checkout main && git pull
git checkout -b session-[nom]

# Appliquer une migration SQL
# → Supabase SQL Editor (jamais prisma migrate dev)
# → Mettre à jour prisma/schema.prisma
# → npx prisma generate

# Commits
git commit -m "type(scope): description en français"
# Types : feat, fix, chore, perf, docs, refactor

# Fin de session
npm run build  # doit passer sans erreur
git push origin session-[nom]
# → Pull Request → merge sur main
```

---

## Documentation interne

- `prisma/seed_demo.sql` — script SQL pour re-seeder la pharmacie démo via Supabase