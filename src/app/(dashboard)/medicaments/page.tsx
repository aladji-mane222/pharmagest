'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatMontant } from '@/lib/utils'
import ImportModal, { ImportField } from '@/components/ui/ImportModal'
import { Button, Card, PageHeader, EmptyState, BadgeStock, SkeletonTable } from '@/components/ui'

interface Medicament {
  id: string
  nom: string
  categorie: string | null
  prixVente: number
  stockTotal: number
  stockMinimum: number
  unite: string
}

const CHAMPS_IMPORT: ImportField[] = [
  { key: 'nom', label: 'Nom', required: true, guessKeywords: ['nom', 'designation', 'produit', 'medicament'] },
  { key: 'categorie', label: 'Categorie', guessKeywords: ['categorie', 'famille', 'type'] },
  { key: 'prixVente', label: 'Prix de vente', required: true, guessKeywords: ['prix vente', 'pu vente', 'prix de vente', 'vente'] },
  { key: 'prixAchat', label: 'Prix d\'achat', guessKeywords: ['prix achat', 'pu achat', 'prix d\'achat', 'achat'] },
  { key: 'unite', label: 'Unite', guessKeywords: ['unite', 'unit'] },
  { key: 'stockMinimum', label: 'Stock minimum', guessKeywords: ['stock min', 'seuil', 'stock minimum'] },
  { key: 'codeBarre', label: 'Code-barres', guessKeywords: ['code-barres', 'code barre', 'codebarre', 'ean', 'gencode'] },
  { key: 'dci', label: 'DCI', guessKeywords: ['dci', 'nom generique', 'denomination commune'] },
  { key: 'ordonnanceObligatoire', label: 'Ordonnance obligatoire', guessKeywords: ['ordonnance', 'prescription'] },
]

export default function MedicamentsPage() {
  const { data: sessionData } = useSession()
  const isAdmin = sessionData?.user?.role === 'ADMIN' || sessionData?.user?.role === 'SUPER_ADMIN'

  const [medicaments, setMedicaments] = useState<Medicament[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [categorieFiltree, setCategorieFiltree] = useState('')
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const LIMIT = 20
  const [importOuvert, setImportOuvert] = useState(false)

  const chargerMedicaments = () => {
    const params = new URLSearchParams({ search, categorie: categorieFiltree, page: String(page), limit: String(LIMIT) })
    fetch(`/api/medicaments?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Erreur ${res.status}`)
        }
        return res.json()
      })
      .then((json) => {
        setMedicaments(json.data?.medicaments || [])
        setTotal(json.data?.total || 0)
        setCategories(json.data?.categories || [])
        setLoading(false)
      })
      .catch(() => {
        // Panne reseau/base temporaire — on arrete le chargement plutot
        // que de laisser planter la page avec une erreur JSON cryptique.
        setLoading(false)
      })
  }

  // Revenir a la page 1 a chaque nouveau filtre — sinon on peut se
  // retrouver sur une page qui n'existe plus pour le nouveau filtre.
  useEffect(() => {
    setPage(1)
  }, [search, categorieFiltree])

  useEffect(() => {
    const timer = setTimeout(chargerMedicaments, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categorieFiltree, page])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const filtresActifs = search.trim() !== '' || categorieFiltree !== ''

  return (
    <div className="p-8">
      <PageHeader
        title="Médicaments"
        description={`${total} médicament${total > 1 ? 's' : ''} au total`}
        actions={isAdmin && (
          <>
            <Button variant="secondary" onClick={() => setImportOuvert(true)}>
              Importer
            </Button>
            <Link href="/medicaments/nouveau">
              <Button variant="primary">+ Nouveau médicament</Button>
            </Link>
          </>
        )}
      />

      <ImportModal
        open={importOuvert}
        onClose={() => setImportOuvert(false)}
        title="Importer des médicaments"
        fields={CHAMPS_IMPORT}
        apiEndpoint="/api/medicaments/import"
        templateHref="/modeles/medicaments-modele.xlsx"
        onImported={() => chargerMedicaments()}
      />

      {/* Filtres */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher un médicament..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-card focus:outline-none focus:ring-2 focus:ring-mint/50 focus:border-mint"
        />
        <select
          value={categorieFiltree}
          onChange={(e) => setCategorieFiltree(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-card focus:outline-none focus:ring-2 focus:ring-mint/50 focus:border-mint bg-white text-gray-700"
        >
          <option value="">Toutes catégories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={6} cols={5} />
          </div>
        ) : medicaments.length === 0 ? (
          <EmptyState
            icon="💊"
            title={filtresActifs ? 'Aucun médicament ne correspond' : 'Aucun médicament pour l’instant'}
            description={
              filtresActifs
                ? 'Essayez une autre recherche ou une autre catégorie.'
                : isAdmin
                  ? 'Ajoutez votre premier médicament ou importez un catalogue existant.'
                  : 'Les médicaments apparaîtront ici une fois ajoutés.'
            }
            action={!filtresActifs && isAdmin && (
              <Link href="/medicaments/nouveau">
                <Button variant="primary">+ Ajouter le premier médicament</Button>
              </Link>
            )}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-app-bg border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Nom</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Catégorie</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Stock</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Prix vente</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {medicaments.map((med) => (
                <tr key={med.id} className="border-b border-gray-100 last:border-0 hover:bg-app-bg">
                  <td className="px-6 py-4 font-medium text-navy">
                    <div className="flex items-center gap-2">
                      {med.nom}
                      {med.stockTotal < med.stockMinimum && (
                        <BadgeStock quantite={med.stockTotal} seuil={med.stockMinimum} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{med.categorie || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${med.stockTotal < med.stockMinimum ? 'text-danger' : 'text-navy'}`}>
                      {med.stockTotal} {med.unite}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{formatMontant(med.prixVente)}</td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/medicaments/${med.id}`}
                      className="text-mint-dark hover:underline"
                    >
                      Voir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {!loading && total > 0 && (
        <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
          <span>
            {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} sur {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ← Précédent
            </Button>
            <span className="px-2 py-1.5 text-gray-500">Page {page} / {totalPages}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Suivant →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}