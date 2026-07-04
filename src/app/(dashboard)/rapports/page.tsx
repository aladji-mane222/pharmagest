'use client'

import { useState, useEffect } from 'react'
import { formatMontant, formatDateTime } from '@/lib/utils'
import { exporterExcel, exporterCSV } from '@/lib/export'
// @react-pdf/renderer et RapportPDF ne sont plus importés ici statiquement :
// c'est une librairie très lourde (moteur de mise en page PDF complet) qui
// gonflait le JS de CETTE PAGE à 671 kB au premier chargement — visible pour
// tout le monde même sans jamais cliquer sur "Exporter PDF". Corrigé le
// 04/07/2026 : chargement dynamique dans handleExportPDF, uniquement au clic.

type TypeRapport = 'benefice' | 'ventes' | 'stock' | 'credits'

const TITRES: Record<TypeRapport, string> = {
  benefice: 'Rapport Bénéfice Net',
  ventes:   'Rapport des Ventes',
  stock:    'Rapport de Stock',
  credits:  'Rapport des Crédits Clients',
}

const MODE_LABELS: Record<string, string> = {
  ESPECES:           'Espèces',
  MOBILE_MONEY:      'Mobile Money',
  ORANGE_MONEY:      'Orange Money',
  MTN_MONEY:         'MTN Money',
  PAIEMENT_MARCHAND: 'Paiement Marchand',
  CARTE:             'Carte',
  CREDIT:            'Crédit',
}

export default function RapportsPage() {
  const [type,   setType]   = useState<TypeRapport>('benefice')
  const [debut,  setDebut]  = useState(() =>
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  )
  const [fin,    setFin]    = useState(() => new Date().toISOString().slice(0, 10))
  const [data,   setData]   = useState<Record<string, unknown> | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [nomPharmacie, setNomPharmacie]   = useState('Ma Pharmacie')

  useEffect(() => {
    fetch('/api/parametres')
      .then((r) => r.json())
      .then((json) => {
        const nom = json.data?.nom ?? json.data?.pharmacie?.nom
        if (nom) setNomPharmacie(nom)
      })
      .catch(() => {})
  }, [])

  const genererRapport = async () => {
    setLoading(true)
    const res  = await fetch(`/api/rapports?type=${type}&debut=${debut}&fin=${fin}`)
    const json = await res.json()
    setData(json.data)
    setLoading(false)
  }

  const handleExportPDF = async () => {
    if (!data) return
    setGeneratingPDF(true)
    try {
      // Import dynamique : ce code (lourd) n'est téléchargé par le
      // navigateur que si l'utilisateur clique réellement sur "Exporter PDF"
      const [{ pdf }, { default: RapportPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/rapports/RapportPDF'),
      ])
      const blob = await pdf(
        <RapportPDF
          data={data as any}
          titre={TITRES[type]}
          periode={{ debut, fin }}
          nomPharmacie={nomPharmacie}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `rapport-${type}-${debut}-${fin}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGeneratingPDF(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Rapports</h1>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="grid grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de rapport</label>
            <select value={type} onChange={(e) => { setType(e.target.value as TypeRapport); setData(null) }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="benefice">Bénéfice net</option>
              <option value="ventes">Ventes</option>
              <option value="stock">Stock</option>
              <option value="credits">Crédits clients</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
            <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
            <input type="date" value={fin} onChange={(e) => setFin(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <button onClick={genererRapport} disabled={loading}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Chargement...' : 'Générer'}
          </button>
        </div>

        {data && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                if (data.type === 'ventes')  exporterExcel(data.ventes as Record<string, unknown>[], 'rapport-ventes')
                if (data.type === 'stock')   exporterExcel(data.stock  as Record<string, unknown>[], 'rapport-stock')
                if (data.type === 'credits') exporterExcel(data.clients as Record<string, unknown>[], 'rapport-credits')
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
              Exporter Excel
            </button>
            <button
              onClick={() => {
                if (data.type === 'ventes')  exporterCSV(data.ventes as Record<string, unknown>[], 'rapport-ventes')
                if (data.type === 'stock')   exporterCSV(data.stock  as Record<string, unknown>[], 'rapport-stock')
                if (data.type === 'credits') exporterCSV(data.clients as Record<string, unknown>[], 'rapport-credits')
              }}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm">
              Exporter CSV
            </button>
            <button onClick={handleExportPDF} disabled={generatingPDF}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm disabled:opacity-50">
              {generatingPDF ? 'Génération PDF...' : 'Exporter PDF'}
            </button>
          </div>
        )}
      </div>

      {/* Résultats */}
      {data && (
        <div className="space-y-6">

          {/* ── Bénéfice ─────────────────────────────────────────────── */}
          {data.type === 'benefice' && (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="font-semibold text-gray-700 mb-6 text-lg">Rapport Bénéfice Net</h2>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-gray-500 mb-1">Chiffre d'affaires</p>
                  <p className="text-2xl font-bold text-green-600">{formatMontant(data.ca as number)}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-gray-500 mb-1">Coût des marchandises (CMV)</p>
                  <p className="text-2xl font-bold text-orange-600">{formatMontant(data.cmv as number)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-gray-500 mb-1">Dépenses</p>
                  <p className="text-2xl font-bold text-red-600">{formatMontant(data.totalDepenses as number)}</p>
                </div>
                <div className={`rounded-xl p-5 text-center ${(data.beneficeNet as number) >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-gray-500 mb-1">Bénéfice net</p>
                  <p className={`text-2xl font-bold ${(data.beneficeNet as number) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatMontant(data.beneficeNet as number)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Formule : CA ({formatMontant(data.ca as number)}) − CMV ({formatMontant(data.cmv as number)}) − Dépenses ({formatMontant(data.totalDepenses as number)}) = {formatMontant(data.beneficeNet as number)}
              </p>
            </div>
          )}

          {/* ── Ventes ───────────────────────────────────────────────── */}
          {data.type === 'ventes' && (
            <>
              {/* Répartitions */}
              <div className="grid grid-cols-2 gap-6">
                {/* Par caissier */}
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="font-semibold text-gray-700 mb-4">Par caissier</h3>
                  {(data.parCaissier as any[]).length === 0 ? (
                    <p className="text-gray-400 text-sm">Aucune donnée</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2 text-gray-500 font-medium">Caissier</th>
                          <th className="text-center py-2 text-gray-500 font-medium">Nb ventes</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.parCaissier as any[]).map((c) => (
                          <tr key={c.nom} className="border-b last:border-0">
                            <td className="py-2 font-medium">{c.nom}</td>
                            <td className="py-2 text-center text-gray-600">{c.nb_ventes}</td>
                            <td className="py-2 text-right text-green-600 font-medium">{formatMontant(Number(c.total))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Par mode paiement */}
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="font-semibold text-gray-700 mb-4">Par mode de paiement</h3>
                  {(data.parMode as any[]).length === 0 ? (
                    <p className="text-gray-400 text-sm">Aucune donnée</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2 text-gray-500 font-medium">Mode</th>
                          <th className="text-center py-2 text-gray-500 font-medium">Nb ventes</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.parMode as any[]).map((m) => (
                          <tr key={m.modePaiement} className="border-b last:border-0">
                            <td className="py-2 font-medium">{MODE_LABELS[m.modePaiement] ?? m.modePaiement}</td>
                            <td className="py-2 text-center text-gray-600">{m.nb_ventes}</td>
                            <td className="py-2 text-right text-green-600 font-medium">{formatMontant(Number(m.total))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Liste ventes */}
              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-700">
                    Détail des ventes
                    <span className="ml-2 text-sm font-normal text-gray-400">
                      ({(data.ventes as any[]).length} ventes)
                    </span>
                  </h3>
                  <p className="text-green-600 font-bold">Total : {formatMontant(data.total as number)}</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 text-gray-600">Caissier</th>
                      <th className="text-right px-4 py-3 text-gray-600">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.ventes as any[]).map((v) => (
                      <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">{formatDateTime(v.createdAt)}</td>
                        <td className="px-4 py-3">{v.user.nom}</td>
                        <td className="px-4 py-3 text-right font-medium text-green-600">{formatMontant(v.montantTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Stock ────────────────────────────────────────────────── */}
          {data.type === 'stock' && (
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-700 text-lg">Rapport Stock</h2>
                <p className="text-blue-600 font-bold">Valeur totale : {formatMontant(data.valeurTotale as number)}</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">Médicament</th>
                    <th className="text-right px-4 py-3 text-gray-600">Stock</th>
                    <th className="text-right px-4 py-3 text-gray-600">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.stock as any[]).map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{m.nom}</td>
                      <td className="px-4 py-3 text-right">{m.stockTotal}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{formatMontant(Number(m.valeur))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Crédits ──────────────────────────────────────────────── */}
          {data.type === 'credits' && (
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-700 text-lg">Rapport Crédits Clients</h2>
                <p className="text-red-600 font-bold">Total dû : {formatMontant(data.totalDu as number)}</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">Client</th>
                    <th className="text-left px-4 py-3 text-gray-600">Téléphone</th>
                    <th className="text-right px-4 py-3 text-gray-600">Solde dû</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.clients as any[]).map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.nom}</td>
                      <td className="px-4 py-3 text-gray-600">{c.telephone || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">{formatMontant(c.soldeCredit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}