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
  BACKUP_REUSSI:          "La sauvegarde automatique B2 s'est terminée avec succès",
  BACKUP_ECHEC:           'La sauvegarde automatique B2 a échoué',
}

export default function AuditPage() {
  const [logs,      setLogs]      = useState<AuditLog[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [action,    setAction]    = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin,   setDateFin]   = useState('')
  const [selected,  setSelected]  = useState<AuditLog | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      const params = new URLSearchParams()
      if (action)    params.set('action',    action)
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin)   params.set('dateFin',   dateFin)

      fetch(`/api/audit?${params.toString()}`)
        .then((res) => res.json())
        .then((json) => {
          setLogs(json.data?.logs || [])
          setTotal(json.data?.total || 0)
          setLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [action, dateDebut, dateFin])

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
          <input
            type="text"
            placeholder="Ex : VENTE, CAISSE..."
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-52"
          />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Détail</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-1">
              Action : <span className="font-medium text-gray-800">{LABELS_ACTIONS[selected.action] ?? selected.action}</span>
              {LABELS_ACTIONS[selected.action] && (
                <span className="ml-2 text-xs text-gray-400 font-mono">{selected.action}</span>
              )}
            </p>
            <p className="text-sm text-gray-500 mb-1">Par : <span className="font-medium">{selected.user?.nom || 'Système'}</span></p>
            <p className="text-sm text-gray-500 mb-4">Date : <span className="font-medium">{formatDateTime(selected.createdAt)}</span></p>
            {DESCRIPTIONS_ACTIONS[selected.action] && (
              <p className="text-sm text-gray-500 mb-4 italic">{DESCRIPTIONS_ACTIONS[selected.action]}</p>
            )}
            {selected.details && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Données :</p>
                <pre className="text-xs text-gray-700 overflow-auto max-h-48">
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </div>
            )}
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
                      onClick={() => setSelected(log)}
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
    </div>
  )
}