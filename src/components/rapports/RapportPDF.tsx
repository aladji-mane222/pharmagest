import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

// ── Types internes (miroir de rapports/page.tsx) ─────────────────────────────

interface VenteRow      { id: string; numeroFacture: string | null; createdAt: string; montantTotal: number; user: { nom: string } }
interface StockRow      { id: string; nom: string; stockTotal: number; valeur: number; statut: string }
interface CreditRow     { id: string; nom: string; telephone: string | null; soldeCredit: number; ancienneteJours: number | null }
interface CommandeRow   {
  id: string; numeroCommande: string | null; createdAt: string
  fournisseur: { nom: string }; montantCommande: number; montantRecu: number; enRetard: boolean | null
}
interface DepenseRow    { id: string; libelle: string; montant: number; categorie: string; createdAt: string; user: { nom: string } }
interface TopMedicament { nom: string; quantite: number; ca: number }
interface FournisseurAgg { nom: string; nbCommandes: number; montantCommande: number }
interface TrancheAgg    { tranche: string; nbClients: number; montant: number }
interface CategorieAgg  { categorie: string; nb: number; montant: number }

interface BeneficeData {
  type: 'benefice'
  ca: number
  totalDepenses: number
  beneficeNet: number
}
interface VentesData    { type: 'ventes';    ventes: VenteRow[]; total: number; ticketMoyen: number; topMedicaments: TopMedicament[] }
interface StockData     { type: 'stock';     stock: StockRow[]; valeurTotale: number; nbProduitsDormants: number }
interface CreditsData   { type: 'credits';   clients: CreditRow[]; totalDu: number; parTranche: TrancheAgg[] }
interface CommandesData {
  type: 'commandes'
  commandes: CommandeRow[]
  montantTotalCommande: number
  montantTotalRecu: number
  parFournisseur: FournisseurAgg[]
}
interface DepensesData  { type: 'depenses'; depenses: DepenseRow[]; total: number; parCategorie: CategorieAgg[] }

type RapportData = BeneficeData | VentesData | StockData | CreditsData | CommandesData | DepensesData

export interface RapportPDFProps {
  data:             RapportData
  titre:            string
  periode:          { debut: string; fin: string }
  nomPharmacie:     string
  // Cles des sections a inclure (Phase 4, 23/07/2026). Si absent : tout
  // afficher (comportement historique, utilise pour "benefice" qui n'a
  // pas de selection de sections).
  sectionsChoisies?: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Intl.NumberFormat('fr-FR') utilise un espace insecable fin (U+202F) comme
// separateur de milliers — glyphe absent de la police Helvetica de base
// utilisee par react-pdf, ce qui produit un rendu casse ("2/000" au lieu
// de "2 000", ou l'espace disparait carrement selon les cas). Meme bug
// deja identifie et corrige dans RecuPDF.tsx (Phase 2) mais jamais
// reporte ici — corrige au meme endroit avec la meme methode (espace
// ASCII normal, formatage manuel).
function fmt(n: number): string {
  const entier = Math.round(n)
  const avecEspaces = entier.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${avecEspaces} GNF`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtPeriode(debut: string, fin: string): string {
  return `Du ${fmtDate(debut)} au ${fmtDate(fin)}`
}

// ── Sections ──────────────────────────────────────────────────────────────────
// Chaque type de rapport peut proposer plusieurs sections (Phase 4,
// 23/07/2026) — avant, un seul tableau fixe par type, ce qui faisait que
// l'export "oubliait" toujours les tableaux secondaires (repartition par
// fournisseur, top medicaments...). Le PDF recoit maintenant la liste des
// sections choisies par l'utilisateur (meme mecanisme que Excel/CSV).

interface Colonne { label: string; flex: number; align: 'left' | 'right' }
interface SectionPDF { key: string; titre: string; colonnes: Colonne[]; lignes: string[][]; sommaire?: string }

function construireSections(data: RapportData): SectionPDF[] {
  if (data.type === 'ventes') {
    return [
      {
        key: 'detail', titre: 'Détail des ventes',
        colonnes: [
          { label: 'N° facture', flex: 3, align: 'left'  },
          { label: 'Date',       flex: 3, align: 'left'  },
          { label: 'Caissier',   flex: 4, align: 'left'  },
          { label: 'Montant',    flex: 3, align: 'right' },
        ],
        lignes: data.ventes.map((v) => [v.numeroFacture ?? '—', fmtDate(v.createdAt), v.user.nom, fmt(v.montantTotal)]),
        sommaire: `Total ventes : ${fmt(data.total)}  ·  Ticket moyen : ${fmt(data.ticketMoyen)}`,
      },
      {
        key: 'topMedicaments', titre: 'Top médicaments vendus',
        colonnes: [
          { label: 'Médicament',   flex: 5, align: 'left'  },
          { label: 'Quantité',     flex: 3, align: 'right' },
          { label: 'CA généré',    flex: 3, align: 'right' },
        ],
        lignes: data.topMedicaments.map((m) => [m.nom, String(m.quantite), fmt(m.ca)]),
      },
    ]
  }
  if (data.type === 'stock') {
    return [
      {
        key: 'detail', titre: 'Détail du stock',
        colonnes: [
          { label: 'Médicament', flex: 4, align: 'left'  },
          { label: 'Stock',      flex: 2, align: 'right' },
          { label: 'Valeur',     flex: 3, align: 'right' },
          { label: 'Statut',     flex: 2, align: 'left'  },
        ],
        lignes: data.stock.map((m) => [m.nom, String(m.stockTotal), fmt(m.valeur), m.statut]),
        sommaire: `Valeur totale stock : ${fmt(data.valeurTotale)}  ·  ${data.nbProduitsDormants} dormant(s)`,
      },
    ]
  }
  if (data.type === 'credits') {
    return [
      {
        key: 'detail', titre: 'Détail des créances',
        colonnes: [
          { label: 'Client',      flex: 4, align: 'left'  },
          { label: 'Téléphone',   flex: 3, align: 'left'  },
          { label: 'Solde dû',    flex: 3, align: 'right' },
          { label: 'Ancienneté',  flex: 2, align: 'right' },
        ],
        lignes: data.clients.map((c) => [c.nom, c.telephone ?? '—', fmt(c.soldeCredit), c.ancienneteJours !== null ? `${c.ancienneteJours} j` : '—']),
        sommaire: `Total dû : ${fmt(data.totalDu)}`,
      },
      {
        key: 'parTranche', titre: 'Répartition par ancienneté',
        colonnes: [
          { label: 'Tranche',   flex: 3, align: 'left'  },
          { label: 'Clients',   flex: 2, align: 'right' },
          { label: 'Montant',   flex: 3, align: 'right' },
        ],
        lignes: data.parTranche.map((t) => [t.tranche, String(t.nbClients), fmt(t.montant)]),
      },
    ]
  }
  if (data.type === 'commandes') {
    return [
      {
        key: 'detail', titre: 'Détail des commandes',
        colonnes: [
          { label: 'N° commande', flex: 3, align: 'left'  },
          { label: 'Fournisseur', flex: 4, align: 'left'  },
          { label: 'Commandé',    flex: 3, align: 'right' },
          { label: 'Reçu',        flex: 3, align: 'right' },
          { label: 'Statut',      flex: 2, align: 'left'  },
        ],
        lignes: data.commandes.map((c) => [
          c.numeroCommande ?? '—', c.fournisseur.nom, fmt(c.montantCommande), fmt(c.montantRecu),
          c.enRetard === true ? 'En retard' : c.enRetard === false ? 'À temps' : '—',
        ]),
        sommaire: `Commandé : ${fmt(data.montantTotalCommande)}  ·  Reçu : ${fmt(data.montantTotalRecu)}`,
      },
      {
        key: 'parFournisseur', titre: 'Répartition par fournisseur',
        colonnes: [
          { label: 'Fournisseur',      flex: 4, align: 'left'  },
          { label: 'Nb commandes',     flex: 3, align: 'right' },
          { label: 'Total commandé',   flex: 3, align: 'right' },
        ],
        lignes: data.parFournisseur.map((f) => [f.nom, String(f.nbCommandes), fmt(f.montantCommande)]),
      },
    ]
  }
  if (data.type === 'depenses') {
    return [
      {
        key: 'detail', titre: 'Détail des dépenses',
        colonnes: [
          { label: 'Date',       flex: 2, align: 'left'  },
          { label: 'Libellé',    flex: 4, align: 'left'  },
          { label: 'Catégorie',  flex: 3, align: 'left'  },
          { label: 'Montant',    flex: 3, align: 'right' },
        ],
        lignes: data.depenses.map((d) => [fmtDate(d.createdAt), d.libelle, d.categorie, fmt(d.montant)]),
        sommaire: `Total dépenses : ${fmt(data.total)}`,
      },
      {
        key: 'parCategorie', titre: 'Répartition par catégorie',
        colonnes: [
          { label: 'Catégorie', flex: 4, align: 'left'  },
          { label: 'Nb',        flex: 2, align: 'right' },
          { label: 'Montant',   flex: 3, align: 'right' },
        ],
        lignes: data.parCategorie.map((c) => [c.categorie, String(c.nb), fmt(c.montant)]),
      },
    ]
  }
  return []
}

// ── Styles A4 ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    paddingTop: 48, paddingBottom: 64, paddingHorizontal: 48,
    fontFamily: 'Helvetica', fontSize: 10, color: '#111827',
  },

  // Header
  headerBandeau: {
    backgroundColor: '#166534', borderRadius: 6,
    paddingVertical: 14, paddingHorizontal: 18, marginBottom: 20,
  },
  nomPharmacie: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', marginBottom: 4 },
  titreLine:    { fontSize: 13, color: '#DCFCE7' },
  metaLine:     { fontSize: 9,  color: '#A7F3D0', marginTop: 4 },

  // Bloc bénéfice (KPI)
  kpiRow:   { flexDirection: 'row', marginBottom: 16 },
  kpiCard:  { flex: 1, borderRadius: 6, padding: 14, marginRight: 10 },
  kpiCardLast: { marginRight: 0 },
  kpiLabel: { fontSize: 8, color: '#6B7280', marginBottom: 6 },
  kpiVal:   { fontSize: 18, fontFamily: 'Helvetica-Bold' },

  // Titre de section
  sectionTitre: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#166534', marginBottom: 8, marginTop: 18 },
  sectionTitreFirst: { marginTop: 0 },

  // Table
  tableHead: {
    flexDirection: 'row', backgroundColor: '#F3F4F6',
    paddingVertical: 7, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: '#D1D5DB',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6, paddingHorizontal: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  headCell: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#374151' },
  cell:     { fontSize: 9, color: '#374151' },
  cellRight: { textAlign: 'right' },

  // Résumé sous le tableau
  sommaire: {
    flexDirection: 'row', justifyContent: 'flex-end',
    marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  sommaireText: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#166534' },

  // Footer (fixé en bas de chaque page)
  footer: {
    position: 'absolute', bottom: 24, left: 48, right: 48,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 0.5, borderTopColor: '#D1D5DB', paddingTop: 6,
  },
  footerText: { fontSize: 8, color: '#9CA3AF' },
})

// ── Composant ─────────────────────────────────────────────────────────────────

export default function RapportPDF({ data, titre, periode, nomPharmacie, sectionsChoisies }: RapportPDFProps) {
  const dateGeneration = fmtDate(new Date().toISOString())
  const toutesSections = construireSections(data)
  const sections = sectionsChoisies
    ? toutesSections.filter((sec) => sectionsChoisies.includes(sec.key))
    : toutesSections

  return (
    <Document title={titre} author="PharmaGest">
      <Page size="A4" style={s.page}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={s.headerBandeau}>
          <Text style={s.nomPharmacie}>{nomPharmacie}</Text>
          <Text style={s.titreLine}>{titre}</Text>
          <Text style={s.metaLine}>
            {fmtPeriode(periode.debut, periode.fin)}{'   ·   '}Généré le {dateGeneration}
          </Text>
        </View>

        {/* ── Corps : KPI bénéfice ─────────────────────────────────────────── */}
        {data.type === 'benefice' && (
          <View style={s.kpiRow}>
            <View style={[s.kpiCard, { backgroundColor: '#DCFCE7' }]}>
              <Text style={s.kpiLabel}>Chiffre d'affaires</Text>
              <Text style={[s.kpiVal, { color: '#166534' }]}>{fmt(data.ca)}</Text>
            </View>
            <View style={[s.kpiCard, { backgroundColor: '#FEE2E2' }]}>
              <Text style={s.kpiLabel}>Total dépenses</Text>
              <Text style={[s.kpiVal, { color: '#DC2626' }]}>{fmt(data.totalDepenses)}</Text>
            </View>
            <View style={[s.kpiCard, s.kpiCardLast, {
              backgroundColor: data.beneficeNet >= 0 ? '#DBEAFE' : '#FEF3C7',
            }]}>
              <Text style={s.kpiLabel}>Bénéfice net</Text>
              <Text style={[s.kpiVal, { color: data.beneficeNet >= 0 ? '#1D4ED8' : '#D97706' }]}>
                {fmt(data.beneficeNet)}
              </Text>
            </View>
          </View>
        )}

        {/* ── Corps : sections (ventes / stock / credits / commandes / depenses) ── */}
        {sections.map((section, idx) => (
          <View key={section.key}>
            <Text style={[s.sectionTitre, ...(idx === 0 ? [s.sectionTitreFirst] : [])]}>
              {section.titre}
            </Text>

            <View style={s.tableHead}>
              {section.colonnes.map((col) => (
                <Text
                  key={col.label}
                  style={[s.headCell, { flex: col.flex }, ...(col.align === 'right' ? [s.cellRight] : [])]}
                >
                  {col.label}
                </Text>
              ))}
            </View>

            {section.lignes.map((ligne, i) => (
              <View key={i} style={[s.tableRow, ...(i % 2 !== 0 ? [s.tableRowAlt] : [])]}>
                {section.colonnes.map((col, j) => (
                  <Text
                    key={j}
                    style={[s.cell, { flex: col.flex }, ...(col.align === 'right' ? [s.cellRight] : [])]}
                  >
                    {ligne[j] ?? '—'}
                  </Text>
                ))}
              </View>
            ))}

            {section.sommaire && (
              <View style={s.sommaire}>
                <Text style={s.sommaireText}>{section.sommaire}</Text>
              </View>
            )}
          </View>
        ))}

        {/* ── Footer (fixé sur chaque page) ───────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Généré par PharmaGest — Pilotée par vous</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  )
}
