'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, PageHeader, Input } from '@/components/ui'

interface Question {
  q: string
  a: string
  lien?: { href: string; label: string }
}

interface Categorie {
  titre: string
  icone: string
  questions: Question[]
}

// Contenu redige a partir de la connaissance fonctionnelle de l'app —
// pas de contenu de support externe existant a reprendre. A completer
// au fil des questions reelles remontees par les pharmacies (Phase 5.3,
// demande de Nabe le 26/07/2026).
const CATEGORIES: Categorie[] = [
  {
    titre: 'Ventes & caisse',
    icone: '💰',
    questions: [
      {
        q: "Comment ouvrir ou fermer ma session de caisse ?",
        a: "Rendez-vous sur la page Caisse. Le bouton \"Ouvrir la caisse\" demande le montant en espèces au démarrage (fond de caisse). En fin de journée, \"Fermer la caisse\" vous demande de compter les espèces réellement présentes dans le tiroir : l'écart avec le montant attendu par le système est affiché automatiquement.",
        lien: { href: '/caisse', label: 'Aller à la caisse' },
      },
      {
        q: "Un écart de caisse s'affiche à la fermeture, est-ce grave ?",
        a: "Un petit écart (quelques milliers de GNF) peut arriver — monnaie mal rendue, erreur d'appoint. Au-delà de 5 000 GNF, l'écart est mis en évidence pour que vous puissiez vérifier avant de valider la fermeture. L'écart est enregistré, pas bloquant.",
      },
      {
        q: "Comment encaisser une vente avec plusieurs modes de paiement (espèces + Mobile Money par exemple) ?",
        a: "Au moment du paiement, choisissez \"Paiement mixte\" et renseignez le montant pour chaque mode utilisé. Si le total payé est inférieur au montant de la vente, la différence est automatiquement enregistrée comme crédit client — vous devez donc sélectionner un client pour ce type de vente.",
      },
      {
        q: "Comment annuler une vente déjà encaissée ?",
        a: "Ouvrez la fiche de la vente depuis l'historique, puis \"Annuler la vente\" (réservé aux administrateurs). Un motif est obligatoire. Le stock est remis à jour automatiquement, et si la vente avait un crédit associé, il est retiré du solde du client.",
        lien: { href: '/ventes/historique', label: 'Voir l\'historique des ventes' },
      },
      {
        q: "Comment réimprimer ou renvoyer un reçu ?",
        a: "Depuis l'historique des ventes, ouvrez la vente concernée puis \"Imprimer / Envoyer\". Vous pouvez régénérer le PDF, le télécharger, ou l'envoyer directement par WhatsApp au client.",
      },
    ],
  },
  {
    titre: 'Stock & médicaments',
    icone: '💊',
    questions: [
      {
        q: "Pourquoi un médicament n'apparaît-il plus dans les ventes ?",
        a: "Soit son stock est à zéro (rupture), soit il a été archivé. Un médicament archivé n'est jamais supprimé définitivement — un administrateur peut le retrouver et le réactiver si besoin.",
      },
      {
        q: "Comment ajouter un nouveau médicament rapidement s'il y en a beaucoup ?",
        a: "Utilisez le bouton \"Importer\" sur la page Médicaments. Téléchargez d'abord le modèle Excel, remplissez-le, puis importez-le — l'outil essaie de reconnaître automatiquement vos colonnes même si leurs noms diffèrent légèrement.",
        lien: { href: '/medicaments', label: 'Aller aux médicaments' },
      },
      {
        q: "Quelle est la différence entre le stock affiché sur la fiche médicament et sur la page Stock ?",
        a: "La fiche médicament montre le stock total et le détail par lot (numéro de lot, date de péremption). La page Stock montre une vue d'ensemble de tous les médicaments avec des filtres pour repérer rapidement les ruptures, stocks bas, péremptions proches et produits dormants (aucune vente depuis 90 jours).",
        lien: { href: '/stock', label: 'Aller au stock' },
      },
      {
        q: "Comment fonctionne l'inventaire physique ?",
        a: "Lancez un inventaire depuis la page Inventaire : le système affiche le stock théorique de chaque médicament. Saisissez la quantité réellement comptée. Tout écart doit obligatoirement avoir un motif avant de pouvoir valider — la validation ajuste le stock automatiquement.",
        lien: { href: '/inventaire', label: 'Aller à l\'inventaire' },
      },
      {
        q: "Un médicament est en rupture mais un équivalent existe, comment le savoir ?",
        a: "Si le champ DCI (nom générique) est renseigné sur la fiche du médicament, une suggestion d'équivalents en stock ayant la même DCI s'affiche automatiquement en cas de rupture.",
      },
    ],
  },
  {
    titre: 'Clients & crédits',
    icone: '👥',
    questions: [
      {
        q: "Comment enregistrer un remboursement de crédit client ?",
        a: "Ouvrez la fiche du client, section \"Enregistrer un remboursement\". Un remboursement en espèces nécessite une session de caisse ouverte ; les autres modes de paiement (Mobile Money, carte...) ne le nécessitent pas.",
        lien: { href: '/clients', label: 'Aller aux clients' },
      },
      {
        q: "Comment voir tous les clients qui doivent de l'argent à la pharmacie ?",
        a: "La page Crédits liste tous les clients avec un solde impayé, triés par montant dû, avec un bouton pour les relancer directement par WhatsApp.",
        lien: { href: '/credits', label: 'Aller aux crédits' },
      },
      {
        q: "Un client a un plafond de crédit, que se passe-t-il s'il le dépasse ?",
        a: "Le plafond de crédit sert d'indicateur visuel (barre de progression sur la fiche client) mais n'empêche pas techniquement une vente à crédit supplémentaire — à vous de décider au cas par cas selon la relation avec le client.",
      },
    ],
  },
  {
    titre: 'Fournisseurs & commandes',
    icone: '🚚',
    questions: [
      {
        q: "Comment passer une commande à un fournisseur ?",
        a: "Depuis Fournisseurs > Commandes, cliquez sur \"Nouvelle commande\", choisissez le fournisseur et ajoutez les médicaments souhaités avec leurs quantités. Vous pouvez aussi utiliser \"Commandes suggérées\" pour une proposition automatique basée sur les stocks bas.",
        lien: { href: '/fournisseurs/commandes', label: 'Aller aux commandes' },
      },
      {
        q: "Comment réceptionner une commande à sa livraison ?",
        a: "Ouvrez la commande et utilisez le bouton de réception. Saisissez pour chaque ligne la quantité réellement reçue (elle peut différer de la quantité commandée) ainsi que le numéro de lot et la date de péremption de chaque sous-lot livré.",
      },
      {
        q: "Que veut dire le badge de fiabilité sur un fournisseur ?",
        a: "Il reflète le taux de livraisons reçues dans les délais prévus sur les 90 derniers jours. \"Historique insuffisant\" signifie simplement qu'il n'y a pas encore assez de commandes reçues avec une date prévue pour calculer un taux fiable.",
      },
    ],
  },
  {
    titre: 'Dépenses & rapports',
    icone: '📈',
    questions: [
      {
        q: "Comment suivre les charges de la pharmacie (loyer, salaires...) ?",
        a: "Utilisez la page Dépenses pour enregistrer chaque charge avec une catégorie. Elles sont automatiquement déduites dans le calcul du bénéfice net visible dans les Rapports.",
        lien: { href: '/depenses', label: 'Aller aux dépenses' },
      },
      {
        q: "Comment est calculé le bénéfice net ?",
        a: "Bénéfice net = Chiffre d'affaires − Coût des marchandises vendues (calculé au prix réel d'achat de chaque lot, méthode FIFO) − Dépenses. Les ventes annulées sont exclues du chiffre d'affaires.",
      },
      {
        q: "Où voir l'historique de toutes les actions effectuées dans la pharmacie ?",
        a: "Le Journal d'activité (dans Rapports) trace les actions sensibles : ventes, annulations, modifications de stock, créations/modifications de comptes, etc. — utile pour retracer qui a fait quoi et quand.",
        lien: { href: '/rapports/audit', label: 'Voir le journal d\'activité' },
      },
    ],
  },
  {
    titre: 'Personnel & rôles',
    icone: '👤',
    questions: [
      {
        q: "Quelle est la différence entre les rôles Caissier, Pharmacien et Admin ?",
        a: "Un tableau détaillé des droits par rôle (ventes, gestion des médicaments, accès aux rapports, gestion du personnel...) est disponible sur la page Personnel, dans la section dépliable \"Droits par rôle\".",
        lien: { href: '/personnel', label: 'Voir les droits par rôle' },
      },
      {
        q: "Comment créer un nouveau compte pour un employé ?",
        a: "Depuis la page Personnel (réservée aux administrateurs), \"Nouveau compte\" : nom, email, mot de passe temporaire et rôle. L'employé pourra ensuite se connecter avec ces identifiants.",
      },
      {
        q: "Comment désactiver l'accès d'un employé qui a quitté la pharmacie ?",
        a: "Sur la page Personnel, utilisez \"Désactiver\" en face de son nom — son compte reste dans l'historique (aucune donnée n'est supprimée) mais il ne peut plus se connecter. Réactivable à tout moment.",
      },
    ],
  },
]

export default function AidePage() {
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState<string | null>(null)

  const termeNormalise = recherche.trim().toLowerCase()

  const categoriesFiltrees = CATEGORIES.map((cat) => ({
    ...cat,
    questions: termeNormalise
      ? cat.questions.filter(
          (q) =>
            q.q.toLowerCase().includes(termeNormalise) ||
            q.a.toLowerCase().includes(termeNormalise)
        )
      : cat.questions,
  })).filter((cat) => cat.questions.length > 0)

  const toggle = (id: string) => setOuvert((cur) => (cur === id ? null : id))

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        title="Aide"
        description="Questions fréquentes sur l'utilisation de PharmaGest"
      />

      <div className="mb-6">
        <Input
          placeholder="Rechercher une question... (ex: caisse, crédit, inventaire)"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>

      {categoriesFiltrees.length === 0 ? (
        <Card>
          <p className="text-gray-500 text-sm text-center">
            Aucune question ne correspond à « {recherche} ». Essayez un autre mot-clé.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {categoriesFiltrees.map((cat) => (
            <div key={cat.titre}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                <span>{cat.icone}</span> {cat.titre}
              </h2>
              <Card padding="none" className="overflow-hidden divide-y divide-gray-100">
                {cat.questions.map((item) => {
                  const id = `${cat.titre}__${item.q}`
                  const estOuvert = ouvert === id
                  return (
                    <div key={id}>
                      <button
                        onClick={() => toggle(id)}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-app-bg transition-colors"
                      >
                        <span className="text-sm font-medium text-navy">{item.q}</span>
                        <span className="text-gray-400 shrink-0">{estOuvert ? '▲' : '▼'}</span>
                      </button>
                      {estOuvert && (
                        <div className="px-5 pb-4 -mt-1">
                          <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                          {item.lien && (
                            <Link
                              href={item.lien.href}
                              className="inline-block mt-2 text-sm text-mint-dark hover:underline"
                            >
                              {item.lien.label} →
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </Card>
            </div>
          ))}
        </div>
      )}

      <Card className="mt-8 bg-app-bg border-none">
        <p className="text-sm text-gray-500 text-center">
          Votre question n&apos;est pas dans la liste ? Contactez votre administrateur ou le support PharmaGest.
        </p>
      </Card>
    </div>
  )
}
