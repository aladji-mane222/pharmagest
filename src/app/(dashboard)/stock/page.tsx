'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatMontant, formatDate } from '@/lib/utils'
import ImportModal, { ImportField } from '@/components/ui/ImportModal'
import { Button, Card, PageHeader, EmptyState, Badge, SkeletonTable } from '@/components/ui'

interface Lot {
  id: string
  numeroLot: string | null
  datePeremption: string
  quantite: number
}

interface MedicamentStock {
  id: string
  nom: string
  categorie: string | null
  unite: string
  prixVente: number
  prixAchat: number | null
  stockMinimum: number
  stockTotal: number
  stockBas: boolean
  rupture: boolean
  lotsCritiques: number
  produitDormant: boolean
  lots: Lot[]
}

const CHAMPS_IMPORT_STOCK: ImportField[] = [
  { key: 'nomMedicament', label: 'Medicament', required: true, guessKeywords: ['medicament', 'nom', 'designation', 'produit'] },
  { key: 'numeroLot', label: 'Numero de lot', guessKeywords: ['lot', 'numero lot'] },
  { key: 'datePeremption', label: 'Date de peremption', required: true, guessKeywords: ['peremption', 'expiration', 'date'] },
  { key: 'quantite', label: 'Quantite', required: true, guessKeywords: ['quantite', 'qte', 'stock'] },
  { key: 'prixAchat', label: 'Prix d\'achat', guessKeywords: ['prix achat', 'pu achat', 'achat'] },
]

const FILTRES = [
  { value: 'tous', label: 'Tous' },
  { value: 'ruptures', label: 'Ruptures' },
  { value: 'bas', label: 'Stock bas' },
  { value: 'critiques', label: 'Péremptions' },
  { value: 'dormants', label: 'Dormants' },
] as const

export default function StockPage() {
  const { data: sessionData } = useSession()
  const isAdmin = sessionData?.user?.role === 'ADMIN' || sessionData?.user?.role === 'SUPER_ADMIN'

  const [stock, setStock] = useState<MedicamentStock[]>([])
  const [valeurTotale, setValeurTotale] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<'tous' | 'ruptures' | 'bas' | 'critiques' | 'dormants'>('tous')
  const [selected, setSelected] = useState<MedicamentStock | null>(null)
  const [importOuvert, setImportOuvert] = useState(false)

  const chargerStock = () => {
    fetch('/api/stock')
      .then((res) => res.json())
      .then((json) => {
        setStock(json.data?.stock || [])
        setValeurTotale(json.data?.valeurTotale || 0)
        setLoading(false)
      })
  }

  useEffect(() => {
    chargerStock()
  }, [])

  const stockFiltre = stock.filter((med) => {
    if (filtre === 'ruptures')  return med.rupture
    if (filtre === 'bas')       return med.stockBas && !med.rupture
    if (filtre === 'critiques') return med.lotsCritiques > 0
    if (filtre === 'dormants')  return med.produitDormant
    return true
  })

  const ruptures        = stock.filter((m) => m.rupture)
  const stockBasNonNul   = stock.filter((m) => m.stockBas && !m.rupture)
  const peremptionProche = stock.filter((m) => m.lotsCritiques > 0)

  if (loading) {
    return (
      <div className="p-8">
        <PageHeader title="Stock" />
        <Card padding="none" className="overflow-hidden">
          <div className="p-6">
            <SkeletonTable rows={8} cols={5} />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Stock"
        description={`Valeur totale : ${formatMontant(valeurTotale)}`}
        actions={
          <>
            {isAdmin && (
              <Button variant="secondary" onClick={() => setImportOuvert(true)}>
                Importer le stock initial
              </Button>
            )}
            <Link href="/stock/mouvements">
              <Button variant="secondary">🔄 Mouvements</Button>
            </Link>
          </>
        }
      />

      <div className="flex gap-2 mb-6">
        {FILTRES.map((f) => (
          <span key={f.value} title={f.value === 'dormants' ? 'Médicaments sans aucune vente depuis 90 jours' : undefined}>
            <Button
              variant={filtre === f.value ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFiltre(f.value)}
            >
              {f.label}
            </Button>
          </span>
        ))}
      </div>

      {(ruptures.length > 0 || stockBasNonNul.length > 0 || peremptionProche.length > 0) && (
        <p className="text-sm text-gray-600 mb-4">
          ⚠️ {[
            ruptures.length > 0 ? `${ruptures.length} rupture${ruptures.length > 1 ? 's' : ''}` : null,
            stockBasNonNul.length > 0 ? `${stockBasNonNul.length} stock${stockBasNonNul.length > 1 ? 's' : ''} bas` : null,
            peremptionProche.length > 0 ? `${peremptionProche.length} péremption${peremptionProche.length > 1 ? 's' : ''} proche${peremptionProche.length > 1 ? 's' : ''}` : null,
          ].filter(Boolean).join(', ')}
        </p>
      )}

      <div className="grid grid-cols-5 gap-6 mb-6">
        <Card padding="sm">
          <p className="text-sm text-gray-500">Total médicaments</p>
          <p className="text-2xl font-bold text-navy">{stock.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Ruptures</p>
          <p className="text-2xl font-bold text-danger">{ruptures.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Stock bas</p>
          <p className="text-2xl font-bold text-warning">{stockBasNonNul.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Péremptions proches</p>
          <p className="text-2xl font-bold text-yellow-500">{peremptionProche.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500">Produits dormants</p>
          <p className="text-2xl font-bold text-info">{stock.filter((m) => m.produitDormant).length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Aucune vente depuis 90 jours</p>
        </Card>
      </div>

      {/* ── Sections d'alertes distinctes (Phase 3.7) — plutot qu'une
          liste unique a filtrer mentalement, chaque categorie a son
          propre encart, visible seulement si elle contient des elements */}
      {(ruptures.length > 0 || stockBasNonNul.length > 0 || peremptionProche.length > 0) && (
        <div className="grid grid-cols-3 gap-6 mb-6">
          {ruptures.length > 0 && (
            <Card padding="sm" className="bg-danger-bg border-danger/20">
              <h3 className="text-sm font-semibold text-danger mb-2">🔴 Ruptures ({ruptures.length})</h3>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {ruptures.map((m) => (
                  <li key={m.id}>
                    <button onClick={() => setSelected(m)} className="text-sm text-danger hover:underline text-left">
                      {m.nom}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {stockBasNonNul.length > 0 && (
            <Card padding="sm" className="bg-warning-bg border-warning/20">
              <h3 className="text-sm font-semibold text-warning-text mb-2">🟠 Stock bas ({stockBasNonNul.length})</h3>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {stockBasNonNul.map((m) => (
                  <li key={m.id}>
                    <button onClick={() => setSelected(m)} className="text-sm text-warning-text hover:underline text-left">
                      {m.nom} <span className="opacity-70">({m.stockTotal}/{m.stockMinimum})</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {peremptionProche.length > 0 && (
            <Card padding="sm" className="bg-yellow-50 border-yellow-200">
              <h3 className="text-sm font-semibold text-yellow-700 mb-2">🟡 Péremptions proches ({peremptionProche.length})</h3>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {peremptionProche.map((m) => (
                  <li key={m.id}>
                    <button onClick={() => setSelected(m)} className="text-sm text-yellow-800 hover:underline text-left">
                      {m.nom} <span className="text-yellow-600">({m.lotsCritiques} lot{m.lotsCritiques > 1 ? 's' : ''})</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">

        {/* ── Tableau principal ── */}
        <Card padding="none" className="col-span-2 overflow-hidden">
          {stockFiltre.length === 0 ? (
            <EmptyState
              icon="📦"
              title="Aucun médicament dans ce filtre"
              description="Essayez un autre filtre pour voir plus de résultats."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-app-bg border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600">Médicament</th>
                  <th className="text-right px-4 py-3 text-gray-600">Stock</th>
                  <th className="text-right px-4 py-3 text-gray-600">Min</th>
                  <th className="text-right px-4 py-3 text-gray-600">Valeur</th>
                  <th className="text-center px-4 py-3 text-gray-600">Statut</th>
                </tr>
              </thead>
              <tbody>
                {stockFiltre.map((med) => (
                  <tr
                    key={med.id}
                    onClick={() => setSelected(med)}
                    className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                      selected?.id === med.id ? 'bg-mint/10' : 'hover:bg-app-bg'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-navy">{med.nom}</td>
                    <td className={`px-4 py-3 text-right font-medium ${med.rupture ? 'text-danger' : med.stockBas ? 'text-warning' : 'text-success'}`}>
                      {med.stockTotal} {med.unite}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{med.stockMinimum}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {med.prixAchat ? formatMontant(med.stockTotal * med.prixAchat) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1 flex-wrap">
                        {med.rupture && <Badge variant="danger">Rupture</Badge>}
                        {med.stockBas && !med.rupture && <Badge variant="warning">Bas</Badge>}
                        {med.lotsCritiques > 0 && <Badge variant="warning">Péremption</Badge>}
                        {med.produitDormant && <Badge variant="info">Dormant</Badge>}
                        {!med.stockBas && med.lotsCritiques === 0 && !med.produitDormant && (
                          <Badge variant="success">OK</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* ── Panneau détail ── */}
        <Card>
          {selected ? (
            <>
              <div className="flex items-start justify-between mb-4">
                <h2 className="font-semibold text-navy">{selected.nom}</h2>
                <Link
                  href={`/medicaments/${selected.id}`}
                  className="text-xs text-mint-dark hover:underline whitespace-nowrap ml-2"
                >
                  Fiche →
                </Link>
              </div>
              <p className="text-sm text-gray-500 mb-3">Lots actifs</p>
              {selected.lots.length === 0 ? (
                <p className="text-gray-400 text-sm">Aucun lot</p>
              ) : (
                <ul className="space-y-3">
                  {selected.lots.map((lot) => (
                    <li key={lot.id} className="border border-gray-100 rounded-card p-3 text-sm">
                      <p className="font-medium">{lot.numeroLot || 'Sans numéro'}</p>
                      <p className="text-gray-500">Expire : {formatDate(lot.datePeremption)}</p>
                      <p className="text-success font-medium">{lot.quantite} unités</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-sm text-center mt-8">
              Cliquez sur un médicament pour voir ses lots
            </p>
          )}
        </Card>

      </div>

      <ImportModal
        open={importOuvert}
        onClose={() => setImportOuvert(false)}
        title="Importer le stock initial"
        fields={CHAMPS_IMPORT_STOCK}
        apiEndpoint="/api/stock/import"
        templateHref="/modeles/stock-modele.xlsx"
        onImported={() => chargerStock()}
      />
    </div>
  )
}
