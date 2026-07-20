
'use client'

import { useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/utils'

interface AuditLog {
  id: string
  action: string
  details: Record<string, unknown> | null
  createdAt: string
  user: { nom: string } | null
}

const LABELS_ACTIONS: Record<string, string> = {
  CAISSE_OUVERTE:          'Ouverture de caisse',
  CAISSE_FERMEE:           'Fermeture de caisse',
  VENTE_ANNULEE:           'Annulation de vente',
  VENTE_EFFECTUEE:         'Vente enregistrée',
  CLIENT_CREE:             'Nouveau client créé',
  CLIENT_MODIFIE:          'Client modifié',
  CLIENT_ARCHIVE:          'Client archivé',
  CREDIT_REMBOURSE:        'Remboursement de crédit',
  DEPENSE_AJOUTEE:         'Nouvelle dépense',
  DEPENSE_MODIFIEE:        'Dépense modifiée',
  DEPENSE_ARCHIVEE:        'Dépense archivée',
  MEDICAMENT_CREE:         'Nouveau médicament',
  MEDICAMENT_MODIFIE:      'Médicament modifié',
  MEDICAMENT_ARCHIVE:      'Médicament archivé',
  COMMANDE_CREEE:          'Commande fournisseur créée',
  COMMANDE_RECEPTIONNEE:   'Commande reçue',
  COMMANDE_STATUT_CHANGE:  'Statut de commande modifié',
  COMMANDE_ECART_LIVRAISON: 'Écart de livraison constaté',
  INVENTAIRE_LANCE:        'Inventaire lancé',
  INVENTAIRE_VALIDE:       'Inventaire validé',
  INVENTAIRE_ECART:        "Écart d'inventaire constaté",
  FOURNISSEUR_CREE:        'Nouveau fournisseur',
  FOURNISSEUR_MODIFIE:     'Fournisseur modifié',
  FOURNISSEUR_ARCHIVE:     'Fournisseur archivé',
  LOT_CREE:                'Lot créé',
  LOT_MODIFIE:             'Lot modifié',
  USER_CREE:               'Nouvel employé créé',
  USER_MODIFIE:            'Employé modifié',
  IMPORT_MEDICAMENTS:      'Import de médicaments en masse',
  IMPORT_STOCK:            'Import de stock initial en masse',
  IMPORT_CLIENTS:          'Import de clients en masse',
  IMPORT_FOURNISSEURS:     'Import de fournisseurs en masse',
  BACKUP_REUSSI:           'Sauvegarde réussie',
  BACKUP_ECHEC:            'Échec de sauvegarde',
}

const DESCRIPTIONS_ACTIONS: Record<string, string> = {
  CAISSE_OUVERTE:         'Un caissier a ouvert sa session de caisse',
  CAISSE_FERMEE:          'Une session de caisse a été clôturée',
  VENTE_EFFECTUEE:        'Une vente a été finalisée en caisse',
  VENTE_ANNULEE:          'Une vente a été annulée et le stock remis à jour',
  CLIENT_CREE:            'Un nouveau client a été ajouté au fichier clients',
  CLIENT_MODIFIE:         "Les informations d'un client ont été modifiées",
  CLIENT_ARCHIVE:         "Un client a été archivé et n'est plus actif",
  CREDIT_REMBOURSE:       'Un remboursement de crédit a été enregistré',
  DEPENSE_AJOUTEE:        'Une nouvelle dépense a été saisie',
  DEPENSE_MODIFIEE:       'Une dépense existante a été modifiée',
  DEPENSE_ARCHIVEE:       'Une dépense a été archivée',
  MEDICAMENT_CREE:        'Un nouveau médicament a été ajouté au catalogue',
  MEDICAMENT_MODIFIE:     "Les informations d'un médicament ont été modifiées",
  MEDICAMENT_ARCHIVE:     'Un médicament a été archivé du catalogue',
  COMMANDE_CREEE:         'Une commande fournisseur a été créée',
  COMMANDE_RECEPTIONNEE:  'Une commande a été marquée reçue et le stock mis à jour',
  COMMANDE_STATUT_CHANGE: "Le statut d'une commande a été modifié (envoyée ou annulée)",
  COMMANDE_ECART_LIVRAISON: "Une ou plusieurs lignes d'une commande ont été livrées en quantité différente de celle commandée (manque ou surplus)",
  INVENTAIRE_LANCE:       'Un inventaire a été lancé',
  INVENTAIRE_VALIDE:      'Un inventaire a été validé et le stock ajusté en conséquence',
  INVENTAIRE_ECART:       "Un écart entre le stock théorique et compté a été constaté lors d'un inventaire",
  FOURNISSEUR_CREE:       'Un nouveau fournisseur a été ajouté',
  FOURNISSEUR_MODIFIE:    "Les informations d'un fournisseur ont été modifiées",
  FOURNISSEUR_ARCHIVE:    "Un fournisseur a été archivé et n'est plus actif",
  LOT_CREE:               'Un nouveau lot de stock a été créé',
  LOT_MODIFIE:            "Les informations d'un lot de stock ont été modifiées",
  USER_CREE:              'Un nouveau compte employé a été créé',
  USER_MODIFIE:           "Les informations ou le mot de passe d'un employé ont été modifiés",
  IMPORT_MEDICAMENTS:     'Un import en masse de médicaments a été effectué depuis un fichier',
  IMPORT_STOCK:           'Un import en masse de stock initial (lots) a été effectué depuis un fichier',
  IMPORT_CLIENTS:         'Un import en masse de clients a été effectué depuis un fichier',
  IMPORT_FOURNISSEURS:    'Un import en masse de fournisseurs a été effectué depuis un fichier',
  BACKUP_REUSSI:          "La sauvegarde automatique B2 s'est terminée avec succès",
  BACKUP_ECHEC:           'La sauvegarde automatique B2 a échoué',
}

// Traduction des noms de champs bruts stockes dans `details` vers un
// libelle comprehensible sans avoir a deviner leur sens technique.
const LABELS_CHAMPS: Record<string, string> = {
  numeroCommande:    'Commande',
  fournisseurNom:    'Fournisseur',
  medicamentNom:     'Médicament',
  clientNom:         'Client',
  nom:               'Nom',
  libelle:           'Libellé',
  montantTotal:      'Montant total',
  montant:           'Montant',
  montantOuverture:  "Montant d'ouverture",
  montantCloture:    'Montant de clôture',
  totalVentes:       'Total des ventes',
  nbLignes:          'Nombre de lignes',
  lignes:            'Nombre de lignes',
  quantite:          'Quantité',
  commande:          'Quantité commandée',
  recue:             'Quantité reçue',
  statut:            'Nouveau statut',
  modePaiement:      'Mode de paiement',
  crees:             'Créés',
  misAJour:          'Mis à jour',
  ignores:           'Ignorés',
  erreurs:           'Erreurs',
  total:             'Total de lignes traitées',
  fichier:           'Fichier',
  taille:            'Taille',
  erreur:            'Erreur',
  role:              'Rôle',
  changements:       'Modifications apportées',
}

// Traductions de valeurs pour certains champs precis (le champ "statut"
// contient un code technique comme ENVOYEE/RECUE, pas un texte lisible)
const LABELS_STATUTS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  ENVOYEE:   'Envoyée',
  RECUE:     'Reçue',
  ANNULEE:   'Annulée',
}

// Une cle se terminant par "Id" est une reference technique interne
// (cuid) — jamais parlante pour un utilisateur non-developpeur. On la
// masque de la vue lisible ; elle reste consultable dans le detail
// technique (JSON) pour le debug.
function estCleTechnique(cle: string): boolean {
  return /Id$/.test(cle) || cle === 'ligneId'
}

function formaterValeurChamp(cle: string, valeur: unknown): string {
  if (valeur === null || valeur === undefined) return '—'
  if (typeof valeur === 'boolean') return valeur ? 'Oui' : 'Non'
  if (cle === 'statut' && typeof valeur === 'string') return LABELS_STATUTS[valeur] ?? valeur
  if (/montant/i.test(cle) && typeof valeur === 'number') {
    return `${valeur.toLocaleString('fr-FR')} GNF`
  }
  if (typeof valeur === 'object') return JSON.stringify(valeur)
  return String(valeur)
}

export default function AuditPage() {
  const [logs,      setLogs]      = useState<AuditLog[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [action,    setAction]    = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin,   setDateFin]   = useState('')
  const [selected,  setSelected]  = useState<AuditLog | null>(null)
  const [voirJSON,  setVoirJSON]  = useState(false)
  const [page,      setPage]      = useState(1)
  const LIMITE_PAR_PAGE = 20

  const ouvrirDetail = (log: AuditLog) => {
    setVoirJSON(false)
    setSelected(log)
  }

  // Liste des actions triee par libelle, pour le menu deroulant du filtre
  const actionsTriees = Object.entries(LABELS_ACTIONS).sort((a, b) =>
    a[1].localeCompare(b[1], 'fr')
  )

  // Revenir a la page 1 des qu'un filtre change — sinon on peut se
  // retrouver sur une page 3 qui n'existe plus pour le nouveau filtre
  useEffect(() => {
    setPage(1)
  }, [action, dateDebut, dateFin])

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      const params = new URLSearchParams()
      if (action)    params.set('action',    action)
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin)   params.set('dateFin',   dateFin)
      params.set('page', String(page))

      fetch(`/api/audit?${params.toString()}`)
        .then((res) => res.json())
        .then((json) => {
          setLogs(json.data?.logs || [])
          setTotal(json.data?.total || 0)
          setLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [action, dateDebut, dateFin, page])

  const totalPages = Math.max(1, Math.ceil(total / LIMITE_PAR_PAGE))

  const reinitialiser = () => {
    setAction('')
    setDateDebut('')
    setDateFin('')
  }

  const filtresActifs = action || dateDebut || dateFin

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Journal d&apos;activité</h1>
        <p className="text-gray-500 text-sm">{total} action{total > 1 ? 's' : ''} enregistrée{total > 1 ? 's' : ''}</p>
      </div>

      {/* Barre de filtres */}
      <div className="bg-white rounded-xl shadow p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-64"
          >
            <option value="">Toutes les actions</option>
            {actionsTriees.map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        {filtresActifs && (
          <button
            onClick={reinitialiser}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Modal détail */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-6 pb-2 shrink-0">
              <h2 className="text-lg font-bold">{LABELS_ACTIONS[selected.action] ?? selected.action}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="px-6 pb-4 overflow-y-auto flex-1 min-h-0">
              <p className="text-sm text-gray-500 mb-1">Par : <span className="font-medium text-gray-800">{selected.user?.nom || 'Système'}</span></p>
              <p className="text-sm text-gray-500 mb-4">Date : <span className="font-medium text-gray-800">{formatDateTime(selected.createdAt)}</span></p>
              {DESCRIPTIONS_ACTIONS[selected.action] && (
                <p className="text-sm text-gray-600 mb-4">{DESCRIPTIONS_ACTIONS[selected.action]}</p>
              )}

              {/* Cas particulier : ecarts de livraison — tableau dedie plutot
                  qu'un JSON brut avec des identifiants illisibles */}
              {selected.action === 'COMMANDE_ECART_LIVRAISON' &&
              Array.isArray((selected.details as any)?.ecarts) ? (
                <div className="space-y-3">
                  {(selected.details as any).numeroCommande && (
                    <p className="text-sm text-gray-700">
                      Commande <span className="font-medium">{(selected.details as any).numeroCommande}</span>
                      {(selected.details as any).fournisseurNom && (
                        <> — {(selected.details as any).fournisseurNom}</>
                      )}
                    </p>
                  )}
                  <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-600">Médicament</th>
                        <th className="text-right px-3 py-2 text-gray-600">Commandé</th>
                        <th className="text-right px-3 py-2 text-gray-600">Reçu</th>
                        <th className="text-right px-3 py-2 text-gray-600">Écart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.details as any).ecarts.map((e: any, i: number) => {
                        const diff = e.recue - e.commande
                        return (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-3 py-2">{e.medicamentNom || 'Médicament'}</td>
                            <td className="px-3 py-2 text-right">{e.commande}</td>
                            <td className="px-3 py-2 text-right">{e.recue}</td>
                            <td className={`px-3 py-2 text-right font-medium ${diff < 0 ? 'text-orange-500' : 'text-blue-500'}`}>
                              {diff > 0 ? `+${diff}` : diff}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                selected.details && (
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg px-3">
                    {Object.entries(selected.details)
                      .filter(([cle]) => !estCleTechnique(cle))
                      .map(([cle, valeur]) => (
                        <div key={cle} className="flex justify-between gap-4 py-2 text-sm">
                          <span className="text-gray-500">{LABELS_CHAMPS[cle] ?? cle}</span>
                          <span className="font-medium text-gray-800 text-right">
                            {formaterValeurChamp(cle, valeur)}
                          </span>
                        </div>
                      ))}
                  </div>
                )
              )}

              {selected.details && (
                <div className="mt-4">
                  <button
                    onClick={() => setVoirJSON((v) => !v)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    {voirJSON ? 'Masquer' : 'Afficher'} les données techniques
                  </button>
                  {voirJSON && (
                    <pre className="mt-2 bg-gray-50 rounded-lg p-3 text-xs text-gray-600 overflow-auto max-h-40">
                      {JSON.stringify(selected.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucune action trouvée</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Date</th>
                <th className="text-left px-6 py-3 text-gray-600">Action</th>
                <th className="text-left px-6 py-3 text-gray-600">Par</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="px-6 py-4">
                    <span
                      className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium cursor-default"
                      title={DESCRIPTIONS_ACTIONS[log.action]}
                    >
                      {LABELS_ACTIONS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{log.user?.nom || 'Système'}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => ouvrirDetail(log)}
                      className="text-green-600 hover:underline text-sm"
                    >
                      Détail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">Page {page} sur {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              ← Précédent
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}