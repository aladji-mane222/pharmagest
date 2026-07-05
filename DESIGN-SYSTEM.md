# PharmaGest — Design System

> Référence unique pour les développeurs de l'équipe.  
> Dernière mise à jour : 05/07/2026

---

## 1. Palette de couleurs

Les couleurs de marque sont définies dans `tailwind.config.ts` et disponibles comme classes Tailwind. **Ne jamais mettre de hex en dur dans `style={{}}` — utiliser les classes ci-dessous.**

### Couleurs de marque

| Nom | Hex | Classe Tailwind | Usage |
|-----|-----|-----------------|-------|
| Navy (principal) | `#0D2847` | `text-navy` / `bg-navy` | Sidebar, textes titres, overlay modal |
| Navy light | `#16385f` | `bg-navy-light` | Hover sidebar |
| Mint (accent) | `#2ECC8A` | `bg-mint` / `text-mint` | Bouton primaire, liens actifs |
| Mint dark | `#25a86f` | `bg-mint-dark` | Hover bouton primaire |
| Fond app | `#EEF1F6` | `bg-app-bg` | Fond général des pages dashboard |
| Blanc | `#FFFFFF` | `bg-white` | Cards, formulaires, tables |

### Couleurs sémantiques (états)

| Rôle | DEFAULT | BG | Texte | Usage |
|------|---------|-----|-------|-------|
| success | `#16a34a` | `bg-success-bg` | `text-success-text` | Stock OK, vente complète, succès toast |
| warning | `#f59e0b` | `bg-warning-bg` | `text-warning-text` | Stock bas, péremption proche, partiel |
| danger | `#dc2626` | `bg-danger-bg` | `text-danger-text` | Rupture, erreur, annulé, action destructive |
| info | `#2563eb` | `bg-info-bg` | `text-info-text` | Commande envoyée, informationnel neutre |

```tsx
// ✅ Correct
<span className="bg-danger-bg text-danger-text">Rupture</span>

// ❌ À éviter
<span style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Rupture</span>
```

---

## 2. Typographie

La police est celle du système (sans-serif natif). Pas de Google Fonts.

| Élément | Classes | Contexte |
|---------|---------|----------|
| Titre de page H1 | `text-2xl font-semibold text-navy` | Via `<PageHeader>` — à préférer |
| Titre de section H2 | `text-lg font-semibold text-navy` | Sous-titres dans une card |
| Titre de card H3 | `text-base font-semibold text-gray-700` | En-tête d'un bloc |
| Corps de texte | `text-sm text-gray-600` | Contenu tableau, descriptions |
| Label de champ | `text-sm font-medium text-navy` | Via `<Input label="...">` |
| Texte secondaire | `text-sm text-gray-500` | Sous-titres, hints |
| Petit texte / note | `text-xs text-gray-400` | Dates, métadonnées, compteurs |
| KPI / montant | `text-2xl font-bold text-green-600` | Totaux dashboard, caisse |
| Valeur négative | `text-2xl font-bold text-red-600` | Déficit, dépenses |

```tsx
// Titre de page — utiliser PageHeader plutôt qu'un h1 brut
<PageHeader title="Médicaments" description="Gérez votre catalogue" />

// KPI
<p className="text-2xl font-bold text-green-600">{formatMontant(totalCA)}</p>
```

---

## 3. Espacements

### Page

| Usage | Valeur |
|-------|--------|
| Padding général des pages | `p-8` |
| Espace sous le header de page | `mb-6` |
| Gap entre sections | `mb-6` |
| Gap entre boutons d'action | `gap-3` |
| Gap dans les grilles de formulaire | `gap-4` |
| Gap dans les grilles de KPIs | `gap-4` ou `gap-6` |

### Tables

| Élément | Valeur |
|---------|--------|
| Cellule de données | `px-6 py-4` |
| Cellule d'en-tête | `px-6 py-3` |
| Couleur ligne survol | `hover:bg-gray-50` |
| Séparateur | `border-b` (dernière ligne : `last:border-0`) |

### Formulaires

| Élément | Valeur |
|---------|--------|
| Padding card formulaire | `p-6` |
| Marge sous formulaire | `mb-6` |
| Padding champ input | `px-3 py-2.5` (via `<Input>`) |

---

## 4. Rayons et ombres

| Élément | Classe | Valeur réelle |
|---------|--------|---------------|
| Cards, boutons, inputs, modales | `rounded-card` | `14px` (défini dans `tailwind.config.ts`) |
| Badges | `rounded-full` | pill complet |
| Ombre card standard | `shadow-sm` | légère |
| Ombre card au survol | `hover:shadow-md` | via prop `hover` sur `<Card>` |
| Ombre modale | `shadow-lg` | prononcée |
| Bordure card | `border border-gray-100` | gris très léger |

```tsx
// Toutes les cards utilisent rounded-card (14px), pas rounded-xl (12px)
<Card>...</Card>  // ✅ rounded-card automatique

// ❌ À éviter — rayon incohérent avec le reste
<div className="rounded-xl shadow">...</div>
```

---

## 5. Composants disponibles

Tous importables depuis `@/components/ui`.

```tsx
import Button from '@/components/ui/Button'
import Badge, { BadgeStatutVente, BadgeStatutCommande, BadgeStock } from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { Skeleton, SkeletonTable, SkeletonCard } from '@/components/ui/Skeleton'
// ou tout en une ligne :
import { Button, Badge, Card, Input, Select, Modal, useToast, EmptyState, PageHeader, Skeleton } from '@/components/ui'
```

---

### `Button`

Remplace tous les `<button className="bg-green-600 ...">` ad-hoc.

**Props :** `variant`, `size`, `loading`, `icon`, + tous les attributs HTML natifs.

| Variante | Apparence | Usage |
|----------|-----------|-------|
| `primary` (défaut) | Fond mint, texte navy | Action principale de la page |
| `secondary` | Fond blanc, bordure navy | Annuler, action secondaire |
| `danger` | Fond rouge | Archiver, supprimer |
| `ghost` | Transparent | Actions discrètes dans une table |

| Taille | Padding | Usage |
|--------|---------|-------|
| `sm` | `px-3 py-1.5` | Boutons dans les lignes de tableau |
| `md` (défaut) | `px-4 py-2.5` | Boutons de formulaire |
| `lg` | `px-5 py-3` | Bouton principal du POS |

```tsx
<Button variant="primary" onClick={valider}>Valider la vente</Button>
<Button variant="danger" loading={archivage} onClick={archiver}>Archiver</Button>
<Button variant="secondary" onClick={annuler}>Annuler</Button>
<Button variant="primary" size="sm" icon={<PlusIcon />}>Ajouter</Button>
```

---

### `Badge`

Remplace les `<span className="bg-red-100 text-red-600 ...">` manuels.

**Variantes :** `success`, `warning`, `danger`, `info`, `neutral` (défaut).

**Helpers métier (source unique — ne pas recréer un switch/case sur chaque page) :**

```tsx
// Statut d'une vente (COMPLETE / PARTIELLE / ANNULEE)
<BadgeStatutVente statut={vente.statut} />

// Statut d'une commande (BROUILLON / ENVOYEE / RECUE / ANNULEE)
<BadgeStatutCommande statut={commande.statut} />

// Stock (dérivé des chiffres, pas d'un enum)
<BadgeStock quantite={med.stockTotal} seuil={med.stockMinimum} />
// → "Rupture" (danger) | "Stock bas" (warning) | "Stock OK" (success)

// Badge générique pour un cas ponctuel
<Badge variant="warning">En attente</Badge>
```

---

### `Card`

Remplace les `<div className="bg-white rounded-xl shadow ...">` dupliqués.

**Props :** `padding` (`none` | `sm` | `md` | `lg`), `hover` (active le hover shadow).

```tsx
<Card>Contenu avec padding md (p-6) par défaut</Card>
<Card padding="lg">Formulaire ou section large</Card>
<Card padding="none" className="overflow-hidden">Table sans padding interne</Card>
<Card hover>Card cliquable avec ombre au survol</Card>
```

---

### `Input` et `Select`

Remplacent les `<input className="border border-gray-300 rounded-lg ...">` ad-hoc.  
Gèrent automatiquement le label, l'état d'erreur et le hint.

```tsx
<Input
  label="Nom du médicament"
  required
  value={nom}
  onChange={(e) => setNom(e.target.value)}
  error={erreurs.nom}
  hint="Tel qu'il apparaîtra sur les reçus"
/>

<Select label="Catégorie" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
  <option value="">Toutes</option>
  <option value="Antibiotiques">Antibiotiques</option>
</Select>
```

---

### `Modal`

Remplace **tous** les `window.confirm()` et `window.alert()` natifs.  
Gère la fermeture à la touche Échap. Accessible (`role="dialog"`, `aria-modal`).

**Props clés :** `open`, `onClose`, `title`, `description` ou `children`, `onConfirm`, `variant` (`default` | `danger`), `loading`.

```tsx
// Confirmation destructive (archivage, désactivation)
const [confirmArchive, setConfirmArchive] = useState<string | null>(null)

<Modal
  open={!!confirmArchive}
  onClose={() => setConfirmArchive(null)}
  onConfirm={handleArchive}
  title="Archiver ce fournisseur ?"
  description="Il n'apparaîtra plus dans les listes actives."
  variant="danger"
  confirmLabel="Archiver"
  loading={enCours}
/>

// Modale avec formulaire (children remplace description)
<Modal open={showForm} onClose={() => setShowForm(false)} title="Nouveau client">
  <form>...</form>
</Modal>
```

---

### `Toast` / `useToast`

Feedback non-bloquant après une action asynchrone. Affiché en bas à droite, disparaît automatiquement.

**Prérequis :** `<ToastProvider>` doit envelopper l'app (déjà configuré dans le layout racine).

**Hook :** `const { showToast } = useToast()`  
**Signature :** `showToast(message: string, variant?: 'success' | 'error' | 'info')`

```tsx
const { showToast } = useToast()

// Après une action réussie
showToast('Dépense archivée', 'success')

// Après une erreur d'API
showToast(json.error ?? 'Une erreur est survenue', 'error')

// Informatif (défaut si variant omis)
showToast('Synchronisation en cours...')
```

---

### `EmptyState`

À utiliser pour toute liste vide. Ne jamais laisser un tableau silencieux avec zéro ligne.

**Props :** `icon` (emoji, défaut `📭`), `title`, `description`, `action` (ReactNode).

```tsx
<EmptyState
  icon="💊"
  title="Aucun médicament trouvé"
  description="Essayez un autre terme de recherche ou ajoutez un nouveau médicament."
  action={<Button onClick={() => router.push('/medicaments/nouveau')}>+ Nouveau médicament</Button>}
/>
```

---

### `PageHeader`

En-tête standard de chaque page dashboard. Titre + description à gauche, boutons à droite.

```tsx
<PageHeader
  title="Fournisseurs"
  description="Gérez vos fournisseurs et leurs commandes"
  actions={
    <>
      <Button variant="secondary" onClick={exporterCSV}>Exporter</Button>
      <Button onClick={() => setShowForm(true)}>+ Nouveau fournisseur</Button>
    </>
  }
/>
```

---

### `Skeleton` / `SkeletonTable` / `SkeletonCard`

Remplacent les `<div>Chargement...</div>` par des placeholders animés.

```tsx
// Ligne de texte quelconque
<Skeleton className="h-4 w-48" />

// Tableau entier (5 lignes × 4 colonnes par défaut)
{loading ? <SkeletonTable rows={8} cols={5} /> : <table>...</table>}

// Grille de KPIs
{loading
  ? <div className="grid grid-cols-4 gap-4">{Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)}</div>
  : <div className="grid grid-cols-4 gap-4">...</div>
}
```

---

### `cn`

Utilitaire de fusion de classes Tailwind (équivalent `clsx`). Résout les conflits de classes.

```tsx
import { cn } from '@/components/ui/cn'

<div className={cn('px-4 py-2 rounded-card', isActive && 'bg-mint text-navy', className)} />
```

---

## 6. Règles d'usage

### Modal vs Toast

| Situation | Composant |
|-----------|-----------|
| Action destructive (archiver, désactiver, supprimer) | `Modal` — laisser le temps de confirmer |
| Feedback après succès (sauvegarde, archivage terminé) | `Toast` success |
| Erreur d'API après soumission | `Toast` error |
| Erreur de validation de formulaire en ligne | Message inline sous le champ (`error` prop sur `<Input>`) |
| Alerte bloquante nécessitant une lecture | `Modal` sans `onConfirm` (juste `onClose`) |

```tsx
// ❌ Jamais ça
window.confirm('Archiver ce médicament ?')
window.alert(json.error)

// ✅ À la place
<Modal open={confirm} onConfirm={handleArchive} variant="danger" ... />
showToast(json.error, 'error')
```

### EmptyState

À utiliser dès qu'une liste peut être vide — tableau, grille de cards, résultats de recherche.  
Prévoir toujours un `action` quand l'utilisateur peut résoudre le vide lui-même (ajouter un élément).

### PageHeader

À utiliser sur **toutes** les pages du dashboard en remplacement du pattern `<div className="flex justify-between mb-6"><h1>...</h1></div>`. Cela garantit un H1 cohérent et le bon responsive sur mobile.

### Boutons dans les tableaux

Utiliser `variant="ghost"` ou `variant="danger"` en taille `sm` pour garder les lignes compactes.

```tsx
// ✅
<Button variant="ghost" size="sm" onClick={() => startEdit(u)}>Modifier</Button>
<Button variant="danger" size="sm" loading={archivingId === u.id} onClick={() => setConfirm(u.id)}>
  Archiver
</Button>

// ❌ Classes ad-hoc incohérentes
<button className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-lg ...">Archiver</button>
```

### Rôles et accès

Le pattern d'affichage conditionnel est standardisé :

```tsx
const { data: session } = useSession()
const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

// Boutons Admin uniquement
{isAdmin && <Button variant="danger" onClick={...}>Archiver</Button>}
```

### Isolation multi-tenant

Chaque requête API filtre par `pharmacieId` issu de la session serveur. Ne jamais accepter un `pharmacieId` depuis le body ou les query params côté API.
