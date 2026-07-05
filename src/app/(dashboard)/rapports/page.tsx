'use client'

import { useState, useEffect } from 'react'
import { formatMontant, formatDateTime } from '@/lib/utils'
import { exporterExcel, exporterCSV } from '@/lib/export'
import { pdf } from '@react-pdf/renderer'
import RapportPDF from '@/components/rapports/RapportPDF'

type TypeRapport = 'ventes' | 'stock' | 'benefice' | 'credits'

const TITRES: Record<TypeRapport, string> = {
  benefice: 'Rapport Bénéfice Net',
  ventes:   'Rapport des Ventes',
  stock:    'Rapport de Stock',
  credits:  'Rapport des Crédits Clients',
}

export default function RapportsPage() {
  const [type, setType] = useState<TypeRapport>('benefice')
  const [debut, setDebut] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [fin, setFin] = useState(() => new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [nomPharmacie, setNomPharmacie] = useState('Ma Pharmacie')

  // Récupère le nom de la pharmacie depuis les paramètres (une seule fois)
  useEffect(() => {
    fetch('/api/parametres')
      .then((r) => r.json())
      .then((json) => {
        const nom = json.data?.nom ?? json.data?.pharmacie?.nom
        if (nom) setNomPharmacie(nom)
      })
      .catch(() => {})
  }, [])

  const handleExportPDF = async () => {
    if (!data) return
    setGeneratingPDF(true)
    try {
      const blob = await pdf(
        <RapportPDF
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const genererRapport = async () => {
    setLoading(true)
    const res = await fetch(`/api/rapports?type=${type}&debut=${debut}&fin=${fin}`)
    const json = await res.json()
    setData(json.data)
    setLoading(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Rapports</h1>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="grid grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de rapport</label>
            <select value={type} onChange={(e) => setType(e.target.value as TypeRapport)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="benefice">Benefice net</option>
              <option value="ventes">Ventes</option>
              <option value="stock">Stock</option>
              <option value="credits">Credits clients</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date debut</label>
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
            {loading ? 'Chargement...' : 'Generer'}
          </button>
        </div>
        {data && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                if (data.type === 'ventes') exporterExcel(data.ventes as Record<string, unknown>[], 'rapport-ventes')
                if (data.type === 'stock') exporterExcel(data.stock as Record<string, unknown>[], 'rapport-stock')
                if (data.type === 'credits') exporterExcel(data.clients as Record<string, unknown>[], 'rapport-credits')
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
              Exporter Excel
            </button>
            <button
              onClick={() => {
                if (data.type === 'ventes') exporterCSV(data.ventes as Record<string, unknown>[], 'rapport-ventes')
                if (data.type === 'stock') exporterCSV(data.stock as Record<string, unknown>[], 'rapport-stock')
                if (data.type === 'credits') exporterCSV(data.clients as Record<string, unknown>[], 'rapport-credits')
              }}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm">
              Exporter CSV
            </button>
            <button
              onClick={handleExportPDF}
              disabled={generatingPDF}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {generatingPDF ? 'Génération PDF...' : 'Exporter PDF'}
            </button>
          </div>
        )}
      </div>

      {data && (
        <div className="bg-white rounded-xl shadow p-6">
          {data.type === 'benefice' && (
            <div>
              <h2 className="font-semibold text-gray-700 mb-6 text-lg">Rapport Bénéfice Net</h2>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-green-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Chiffre d'affaires</p>
                  <p className="text-2xl font-bold text-green-600">{formatMontant(data.ca as number)}</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">CMV</p>
                  <p className="text-2xl font-bold text-yellow-600">{formatMontant(data.cmv as number)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Dépenses</p>
                  <p className="text-2xl font-bold text-red-600">{formatMontant(data.totalDepenses as number)}</p>
                </div>
                <div className={`rounded-xl p-5 text-center ${(data.beneficeNet as number) >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Bénéfice net</p>
                  <p className={`text-2xl font-bold ${(data.beneficeNet as number) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {formatMontant(data.beneficeNet as number)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">
                Bénéfice = CA − CMV − Dépenses
              </p>
            </div>
          )}

          {data.type === 'ventes' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-700 text-lg">Rapport Ventes</h2>
                <p className="text-green-600 font-bold">Total : {formatMontant(data.total as number)}</p>
              </div>

              {/* Tableau détail */}
              <table className="w-full text-sm mb-8">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 text-gray-600">Caissier</th>
                    <th className="text-right px-4 py-3 text-gray-600">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.ventes as { id: string; createdAt: string; montantTotal: number; user: { nom: string } }[]).map((v) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(v.createdAt)}</td>
                      <td className="px-4 py-3">{v.user.nom}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">{formatMontant(v.montantTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Agrégats par caissier et mode */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-600 mb-3 text-sm">Par caissier</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2 text-gray-600">Caissier</th>
                        <th className="text-right px-4 py-2 text-gray-600">Nb ventes</th>
                        <th className="text-right px-4 py-2 text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.parCaissier as { nom: string; nbVentes: number; total: number }[]).map((row) => (
                        <tr key={row.nom} className="border-b last:border-0">
                          <td className="px-4 py-2 font-medium">{row.nom}</td>
                          <td className="px-4 py-2 text-right text-gray-600">{row.nbVentes}</td>
                          <td className="px-4 py-2 text-right font-medium text-green-600">{formatMontant(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-600 mb-3 text-sm">Par mode de paiement</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2 text-gray-600">Mode</th>
                        <th className="text-right px-4 py-2 text-gray-600">Nb ventes</th>
                        <th className="text-right px-4 py-2 text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.parMode as { mode: string; nbVentes: number; total: number }[]).map((row) => (
                        <tr key={row.mode} className="border-b last:border-0">
                          <td className="px-4 py-2 font-medium">{row.mode.replace('_', ' ')}</td>
                          <td className="px-4 py-2 text-right text-gray-600">{row.nbVentes}</td>
                          <td className="px-4 py-2 text-right font-medium text-green-600">{formatMontant(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {data.type === 'stock' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-700 text-lg">Rapport Stock</h2>
                <p className="text-blue-600 font-bold">Valeur totale : {formatMontant(data.valeurTotale as number)}</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">Medicament</th>
                    <th className="text-right px-4 py-3 text-gray-600">Stock</th>
                    <th className="text-right px-4 py-3 text-gray-600">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.stock as { id: string; nom: string; stockTotal: number; valeur: number }[]).map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{m.nom}</td>
                      <td className="px-4 py-3 text-right">{m.stockTotal}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{formatMontant(m.valeur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.type === 'credits' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-700 text-lg">Rapport Credits Clients</h2>
                <p className="text-red-600 font-bold">Total du : {formatMontant(data.totalDu as number)}</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">Client</th>
                    <th className="text-left px-4 py-3 text-gray-600">Telephone</th>
                    <th className="text-right px-4 py-3 text-gray-600">Solde du</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.clients as { id: string; nom: string; telephone: string | null; soldeCredit: number }[]).map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{c.nom}</td>
                      <td className="px-4 py-3 text-gray-600">{c.telephone || '-'}</td>
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
