'use client'

import { useState, useEffect } from 'react'
import { formatMontant, formatDateTime } from '@/lib/utils'
import { exporterExcel, exporterCSV } from '@/lib/export'
import { pdf } from '@react-pdf/renderer'
import RapportPDF from '@/components/rapports/RapportPDF'
import BeneficeEvolutionChart from '@/components/rapports/BeneficeEvolutionChart'
import DepensesCategorieChart from '@/components/rapports/DepensesCategorieChart'

type TypeRapport = 'ventes' | 'stock' | 'benefice' | 'credits' | 'commandes'

const TITRES: Record<TypeRapport, string> = {
  benefice:  'Rapport Bénéfice Net',
  ventes:    'Rapport des Ventes',
  stock:     'Rapport de Stock',
  credits:   'Rapport des Crédits Clients',
  commandes: 'Rapport des Commandes',
}

const LABELS_FIABILITE: Record<string, string> = {
  fiable:               'Fiable',
  generalement_fiable:  'Généralement fiable',
  souvent_en_retard:    'Souvent en retard',
  insuffisant:          'Historique insuffisant',
}

export default function RapportsPage() {
  const [type, setType] = useState<TypeRapport>('benefice')
  const [debut, setDebut] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [fin, setFin] = useState(() => new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [nomPharmacie, setNomPharmacie] = useState('Ma Pharmacie')
  const [kpi, setKpi] = useState<{
    actuel: { ca: number; beneficeNet: number; totalDepenses: number; panierMoyen: number }
    precedent: { ca: number; beneficeNet: number; totalDepenses: number; panierMoyen: number }
    evolution: { ca: number | null; beneficeNet: number | null; totalDepenses: number | null; panierMoyen: number | null }
  } | null>(null)

  // Résumé KPI en tête de page (Phase 4.5) — indépendant du filtre de
  // rapport détaillé, toujours "ce mois-ci vs mois précédent"
  useEffect(() => {
    fetch('/api/rapports?type=kpi')
      .then((r) => r.json())
      .then((json) => setKpi(json.data))
      .catch(() => {})
  }, [])

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

      {kpi && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700 text-sm">Ce mois-ci</h2>
            <span className="text-xs text-gray-400">vs mois précédent</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {([
              { label: "Chiffre d'affaires", cle: 'ca' as const, couleur: 'text-green-600' },
              { label: 'Bénéfice net',        cle: 'beneficeNet' as const, couleur: 'text-blue-600' },
              { label: 'Dépenses',            cle: 'totalDepenses' as const, couleur: 'text-red-600' },
              { label: 'Panier moyen',        cle: 'panierMoyen' as const, couleur: 'text-gray-700' },
            ]).map(({ label, cle, couleur }) => {
              const evo = kpi.evolution[cle]
              // pour les depenses, une baisse (evolution negative) est une
              // bonne nouvelle — inverser le sens des couleurs vert/rouge
              const positifEstBon = cle !== 'totalDepenses'
              const estPositif = evo !== null && evo >= 0
              const estBonneNouvelle = evo !== null && (positifEstBon ? estPositif : !estPositif)
              return (
                <div key={cle} className="text-center">
                  <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{label}</p>
                  <p className={`text-xl font-bold ${couleur}`}>{formatMontant(kpi.actuel[cle])}</p>
                  {evo === null ? (
                    <p className="text-xs text-gray-400 mt-1">—</p>
                  ) : (
                    <p className={`text-xs mt-1 font-medium ${estBonneNouvelle ? 'text-green-600' : 'text-red-600'}`}>
                      {estPositif ? '▲' : '▼'} {Math.abs(evo)}%
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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
              <option value="commandes">Commandes</option>
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
      </div>

      {data && (
        <div className="bg-white rounded-xl shadow p-6">
          {/* Export : action secondaire (Phase 4.8) — plus discret que le
              bouton "Generer", puisque generer le rapport est l'action
              principale et exporter n'arrive qu'apres, sur demande */}
          <div className="flex justify-end gap-3 mb-4 text-xs text-gray-500">
            <button
              onClick={() => {
                if (data.type === 'ventes') exporterExcel((data.ventes as { id: string }[]).map(({ id: _id, ...rest }) => rest), 'rapport-ventes')
                if (data.type === 'stock') exporterExcel(data.stock as Record<string, unknown>[], 'rapport-stock')
                if (data.type === 'credits') exporterExcel(data.clients as Record<string, unknown>[], 'rapport-credits')
                if (data.type === 'commandes') exporterExcel(data.commandes as Record<string, unknown>[], 'rapport-commandes')
              }}
              className="hover:text-blue-600 hover:underline">
              Exporter Excel
            </button>
            <span className="text-gray-300">·</span>
            <button
              onClick={() => {
                if (data.type === 'ventes') exporterCSV((data.ventes as { id: string }[]).map(({ id: _id, ...rest }) => rest), 'rapport-ventes')
                if (data.type === 'stock') exporterCSV(data.stock as Record<string, unknown>[], 'rapport-stock')
                if (data.type === 'credits') exporterCSV(data.clients as Record<string, unknown>[], 'rapport-credits')
                if (data.type === 'commandes') exporterCSV(data.commandes as Record<string, unknown>[], 'rapport-commandes')
              }}
              className="hover:text-blue-600 hover:underline">
              Exporter CSV
            </button>
            <span className="text-gray-300">·</span>
            <button
              onClick={handleExportPDF}
              disabled={generatingPDF}
              className="hover:text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
              {generatingPDF ? 'Génération PDF...' : 'Exporter PDF'}
            </button>
          </div>

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
              <p className="text-sm text-gray-600 text-center mb-6 bg-gray-50 rounded-lg py-3 px-4">
                Ce que la pharmacie a réellement gagné : le chiffre d'affaires, moins ce que les médicaments vendus ont coûté à l'achat (CMV), moins les charges (dépenses).
                <span className="block text-xs text-gray-400 mt-1">Bénéfice net = CA − CMV − Dépenses</span>
              </p>

              <div className="grid grid-cols-2 gap-8 mb-2">
                <BeneficeEvolutionChart />
                <DepensesCategorieChart donnees={(data.repartitionDepenses as { categorie: string; montant: number }[]) ?? []} />
              </div>
            </div>
          )}

          {data.type === 'ventes' && (
            <div>
              <div className="flex justify-between items-start mb-6">
                <h2 className="font-semibold text-gray-700 text-lg">Rapport Ventes</h2>
                <div className="text-right">
                  <p className="text-green-600 font-bold text-lg">Total : {formatMontant(data.total as number)}</p>
                  <p className="text-sm text-gray-500">
                    Ticket moyen : <span className="font-medium text-gray-700">{formatMontant(data.ticketMoyen as number)}</span>
                  </p>
                  {(() => {
                    const comp = data.comparaison as { totalPeriodePrecedente: number; evolutionPourcentage: number | null }
                    if (comp.evolutionPourcentage === null) {
                      return <p className="text-xs text-gray-400 mt-1">Pas de données sur la période précédente pour comparer</p>
                    }
                    const positif = comp.evolutionPourcentage >= 0
                    return (
                      <p className={`text-xs mt-1 font-medium ${positif ? 'text-green-600' : 'text-red-600'}`}>
                        {positif ? '▲' : '▼'} {Math.abs(comp.evolutionPourcentage)}% vs période précédente ({formatMontant(comp.totalPeriodePrecedente)})
                      </p>
                    )
                  })()}
                </div>
              </div>

              {/* Top medicaments vendus */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-600 mb-3 text-sm">Top médicaments vendus</h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-600">Médicament</th>
                      <th className="text-right px-4 py-2 text-gray-600">Quantité vendue</th>
                      <th className="text-right px-4 py-2 text-gray-600">CA généré</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.topMedicaments as { nom: string; quantite: number; ca: number }[]).map((m) => (
                      <tr key={m.nom} className="border-b last:border-0">
                        <td className="px-4 py-2 font-medium">{m.nom}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{m.quantite}</td>
                        <td className="px-4 py-2 text-right font-medium text-green-600">{formatMontant(m.ca)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tableau détail */}
              <table className="w-full text-sm mb-8">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">N° facture</th>
                    <th className="text-left px-4 py-3 text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 text-gray-600">Caissier</th>
                    <th className="text-right px-4 py-3 text-gray-600">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.ventes as { id: string; numeroFacture: string | null; createdAt: string; montantTotal: number; user: { nom: string } }[]).map((v) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{v.numeroFacture ?? '—'}</td>
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
                <div className="text-right">
                  <p className="text-blue-600 font-bold">Valeur totale : {formatMontant(data.valeurTotale as number)}</p>
                  <p className="text-sm text-gray-500">{data.nbProduitsDormants as number} produit(s) dormant(s) (aucune vente depuis 90j)</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">Medicament</th>
                    <th className="text-right px-4 py-3 text-gray-600">Stock</th>
                    <th className="text-right px-4 py-3 text-gray-600">Valeur</th>
                    <th className="text-right px-4 py-3 text-gray-600">Rotation (période)</th>
                    <th className="text-left px-4 py-3 text-gray-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {(data.stock as { id: string; nom: string; stockTotal: number; valeur: number; rotation: number | null; produitDormant: boolean }[]).map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{m.nom}</td>
                      <td className="px-4 py-3 text-right">{m.stockTotal}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{formatMontant(m.valeur)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{m.rotation !== null ? m.rotation : '—'}</td>
                      <td className="px-4 py-3">
                        {m.produitDormant && (
                          <span className="px-2 py-1 bg-blue-50 text-blue-500 rounded-full text-xs">Dormant</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-3">
                Rotation = quantité vendue sur la période / stock actuel — indicatif seulement, pas un taux de rotation comptable exact.
              </p>
            </div>
          )}

          {data.type === 'credits' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-700 text-lg">Rapport Credits Clients</h2>
                <p className="text-red-600 font-bold">Total du : {formatMontant(data.totalDu as number)}</p>
              </div>

              {/* Repartition par tranche d'anciennete */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {(['0-30', '31-60', '60+', 'inconnue'] as const).map((tr) => {
                  const row = (data.parTranche as { tranche: string; nbClients: number; montant: number }[])
                    .find((t) => t.tranche === tr)
                  const labels: Record<string, string> = { '0-30': '0-30 jours', '31-60': '31-60 jours', '60+': '60+ jours', inconnue: 'Origine inconnue' }
                  const couleurs: Record<string, string> = { '0-30': 'bg-yellow-50 text-yellow-700', '31-60': 'bg-orange-50 text-orange-700', '60+': 'bg-red-50 text-red-700', inconnue: 'bg-gray-50 text-gray-500' }
                  if (!row) return null
                  return (
                    <div key={tr} className={`rounded-xl p-4 text-center ${couleurs[tr]}`}>
                      <p className="text-xs mb-1 uppercase tracking-wide opacity-80">{labels[tr]}</p>
                      <p className="text-lg font-bold">{formatMontant(row.montant)}</p>
                      <p className="text-xs opacity-70">{row.nbClients} client(s)</p>
                    </div>
                  )
                })}
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">Client</th>
                    <th className="text-left px-4 py-3 text-gray-600">Telephone</th>
                    <th className="text-right px-4 py-3 text-gray-600">Solde du</th>
                    <th className="text-right px-4 py-3 text-gray-600">Ancienneté</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.clients as { id: string; nom: string; telephone: string | null; soldeCredit: number; ancienneteJours: number | null }[]).map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{c.nom}</td>
                      <td className="px-4 py-3 text-gray-600">{c.telephone || '-'}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">{formatMontant(c.soldeCredit)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {c.ancienneteJours !== null ? `${c.ancienneteJours} j` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-3">
                Ancienneté = depuis la plus ancienne vente à crédit non soldée — approximatif, ne tient pas compte des remboursements partiels déjà effectués.
              </p>
            </div>
          )}

          {data.type === 'commandes' && (
            <div>
              <h2 className="font-semibold text-gray-700 mb-6 text-lg">Rapport des Commandes</h2>

              {/* KPI */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Total commandé</p>
                  <p className="text-2xl font-bold text-blue-600">{formatMontant(data.montantTotalCommande as number)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Total reçu</p>
                  <p className="text-2xl font-bold text-green-600">{formatMontant(data.montantTotalRecu as number)}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Fiabilité livraison</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {(data.fiabilite as { pourcentageATemps: number | null }).pourcentageATemps !== null
                      ? `${(data.fiabilite as { pourcentageATemps: number }).pourcentageATemps}%`
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {LABELS_FIABILITE[(data.fiabilite as { niveau: string }).niveau]}
                  </p>
                </div>
                <div className="bg-red-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Écarts détectés</p>
                  <p className="text-2xl font-bold text-red-600">{(data.ecarts as { nombre: number }).nombre}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatMontant((data.ecarts as { valeur: number }).valeur)}
                  </p>
                </div>
              </div>

              {/* Tableau détail */}
              <table className="w-full text-sm mb-8">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">N° commande</th>
                    <th className="text-left px-4 py-3 text-gray-600">Fournisseur</th>
                    <th className="text-left px-4 py-3 text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 text-gray-600">Statut</th>
                    <th className="text-right px-4 py-3 text-gray-600">Commandé</th>
                    <th className="text-right px-4 py-3 text-gray-600">Reçu</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.commandes as {
                    id: string; numeroCommande: string | null; statut: string; createdAt: string
                    fournisseur: { nom: string }; montantCommande: number; montantRecu: number
                    enRetard: boolean | null
                  }[]).map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{c.numeroCommande ?? '—'}</td>
                      <td className="px-4 py-3">{c.fournisseur.nom}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(c.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1">
                          {c.statut}
                          {c.enRetard === true && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">En retard</span>
                          )}
                          {c.enRetard === false && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">À temps</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatMontant(c.montantCommande)}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{formatMontant(c.montantRecu)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Repartition par fournisseur */}
              <div>
                <h3 className="font-semibold text-gray-600 mb-3 text-sm">Par fournisseur</h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-600">Fournisseur</th>
                      <th className="text-right px-4 py-2 text-gray-600">Nb commandes</th>
                      <th className="text-right px-4 py-2 text-gray-600">Total commandé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.parFournisseur as { nom: string; nbCommandes: number; montantCommande: number }[]).map((row) => (
                      <tr key={row.nom} className="border-b last:border-0">
                        <td className="px-4 py-2 font-medium">{row.nom}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{row.nbCommandes}</td>
                        <td className="px-4 py-2 text-right font-medium text-blue-600">{formatMontant(row.montantCommande)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}