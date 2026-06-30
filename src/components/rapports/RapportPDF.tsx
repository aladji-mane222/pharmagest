import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

// ── Types internes (miroir de rapports/page.tsx) ─────────────────────────────

interface VenteRow    { id: string; createdAt: string; montantTotal: number; user: { nom: string } }
interface StockRow    { id: string; nom: string; stockTotal: number; valeur: number }
interface CreditRow   { id: string; nom: string; telephone: string | null; soldeCredit: number }

interface BeneficeData {
  type: 'benefice'
  ca: number
  totalDepenses: number
  beneficeNet: number
}
interface VentesData  { type: 'ventes';  ventes:  VenteRow[];  total: number }
interface StockData   { type: 'stock';   stock:   StockRow[];  valeurTotale: number }
interface CreditsData { type: 'credits'; clients: CreditRow[]; totalDu: number }

type RapportData = BeneficeData | VentesData | StockData | CreditsData

export interface RapportPDFProps {
  data:          RapportData
  titre:         string
  periode:       { debut: string; fin: string }
  nomPharmacie:  string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' GNF'
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtPeriode(debut: string, fin: string): string {
  return `Du ${fmtDate(debut)} au ${fmtDate(fin)}`
}

// ── Définition des colonnes par type de rapport ───────────────────────────────

interface Colonne { label: string; flex: number; align: 'left' | 'right' }

const COLONNES: Record<string, Colonne[]> = {
  ventes: [
    { label: 'Date',     flex: 3, align: 'left'  },
    { label: 'Caissier', flex: 4, align: 'left'  },
    { label: 'Montant',  flex: 3, align: 'right' },
  ],
  stock: [
    { label: 'Médicament', flex: 5, align: 'left'  },
    { label: 'Stock',      flex: 2, align: 'right' },
    { label: 'Valeur',     flex: 3, align: 'right' },
  ],
  credits: [
    { label: 'Client',    flex: 4, align: 'left'  },
    { label: 'Téléphone', flex: 3, align: 'left'  },
    { label: 'Solde dû',  flex: 3, align: 'right' },
  ],
}

function extraireLignes(data: RapportData): string[][] {
  if (data.type === 'ventes')
    return data.ventes.map((v) => [fmtDate(v.createdAt), v.user.nom, fmt(v.montantTotal)])
  if (data.type === 'stock')
    return data.stock.map((m) => [m.nom, String(m.stockTotal), fmt(m.valeur)])
  if (data.type === 'credits')
    return data.clients.map((c) => [c.nom, c.telephone ?? '—', fmt(c.soldeCredit)])
  return []
}

function extraireSommaireTexte(data: RapportData): string {
  if (data.type === 'ventes')   return `Total ventes : ${fmt(data.total)}`
  if (data.type === 'stock')    return `Valeur totale stock : ${fmt(data.valeurTotale)}`
  if (data.type === 'credits')  return `Total dû : ${fmt(data.totalDu)}`
  return ''
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

export default function RapportPDF({ data, titre, periode, nomPharmacie }: RapportPDFProps) {
  const dateGeneration = fmtDate(new Date().toISOString())
  const colonnes       = COLONNES[data.type] ?? []
  const lignes         = extraireLignes(data)
  const sommaire       = extraireSommaireTexte(data)

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
          <>
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
          </>
        )}

        {/* ── Corps : tableau (ventes / stock / crédits) ───────────────────── */}
        {data.type !== 'benefice' && colonnes.length > 0 && (
          <>
            {/* En-têtes */}
            <View style={s.tableHead}>
              {colonnes.map((col) => (
                <Text
                  key={col.label}
                  style={[s.headCell, { flex: col.flex }, ...(col.align === 'right' ? [s.cellRight] : [])]}
                >
                  {col.label}
                </Text>
              ))}
            </View>

            {/* Lignes */}
            {lignes.map((ligne, i) => (
              <View key={i} style={[s.tableRow, ...(i % 2 !== 0 ? [s.tableRowAlt] : [])]}>
                {colonnes.map((col, j) => (
                  <Text
                    key={j}
                    style={[s.cell, { flex: col.flex }, ...(col.align === 'right' ? [s.cellRight] : [])]}

                  >
                    {ligne[j] ?? '—'}
                  </Text>
                ))}
              </View>
            ))}

            {/* Résumé total */}
            {sommaire !== '' && (
              <View style={s.sommaire}>
                <Text style={s.sommaireText}>{sommaire}</Text>
              </View>
            )}
          </>
        )}

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
