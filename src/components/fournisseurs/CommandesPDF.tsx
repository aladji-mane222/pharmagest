
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

interface LigneExportPDF {
  fournisseur:            string
  dateCommande:           string
  dateLivraisonPrevue:    string
  dateReceptionReelle:    string
  statut:                 string
  montantTotal:           number
  ecart:                  boolean
}

export interface CommandesPDFProps {
  lignes:       LigneExportPDF[]
  nomPharmacie: string
  filtreLabel:  string | null
}

// Meme bug que RapportPDF.tsx et RecuPDF.tsx : Intl.NumberFormat('fr-FR')
// utilise un espace insecable fin non supporte par la police Helvetica
// de base — corrige ici directement plutot que de le reproduire une 3e
// fois dans le projet.
function fmt(n: number): string {
  const entier = Math.round(n)
  const avecEspaces = entier.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${avecEspaces} GNF`
}

const s = StyleSheet.create({
  page: {
    paddingTop: 48, paddingBottom: 64, paddingHorizontal: 32,
    fontFamily: 'Helvetica', fontSize: 9, color: '#111827',
  },
  entete: { marginBottom: 16 },
  pharmacie: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  titre: { fontSize: 11, color: '#4B5563', marginBottom: 2 },
  filtre: { fontSize: 9, color: '#6B7280' },
  table: { display: 'flex', width: '100%' },
  ligneEntete: {
    flexDirection: 'row', backgroundColor: '#F3F4F6',
    paddingVertical: 6, paddingHorizontal: 4, fontWeight: 700,
  },
  ligne: {
    flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  colFournisseur: { width: '20%' },
  colDate:        { width: '14%' },
  colStatut:      { width: '12%' },
  colMontant:     { width: '15%', textAlign: 'right' },
  colEcart:       { width: '11%', textAlign: 'center' },
  ecartOui: { color: '#DC2626', fontWeight: 700 },
  pied: {
    position: 'absolute', bottom: 24, left: 32, right: 32,
    fontSize: 8, color: '#9CA3AF', textAlign: 'center',
  },
})

export default function CommandesPDF({ lignes, nomPharmacie, filtreLabel }: CommandesPDFProps) {
  const montantCumule = lignes.reduce((sum, l) => sum + l.montantTotal, 0)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.entete}>
          <Text style={s.pharmacie}>{nomPharmacie}</Text>
          <Text style={s.titre}>Historique des commandes fournisseurs</Text>
          <Text style={s.filtre}>
            {filtreLabel || 'Toutes les commandes'} — {lignes.length} commande{lignes.length > 1 ? 's' : ''} — Total : {fmt(montantCumule)}
          </Text>
        </View>

        <View style={s.table}>
          <View style={s.ligneEntete}>
            <Text style={s.colFournisseur}>Fournisseur</Text>
            <Text style={s.colDate}>Commande</Text>
            <Text style={s.colDate}>Livr. prévue</Text>
            <Text style={s.colDate}>Livr. réelle</Text>
            <Text style={s.colStatut}>Statut</Text>
            <Text style={s.colMontant}>Montant</Text>
            <Text style={s.colEcart}>Écart</Text>
          </View>

          {lignes.map((l, i) => (
            <View key={i} style={s.ligne}>
              <Text style={s.colFournisseur}>{l.fournisseur}</Text>
              <Text style={s.colDate}>{l.dateCommande}</Text>
              <Text style={s.colDate}>{l.dateLivraisonPrevue || '—'}</Text>
              <Text style={s.colDate}>{l.dateReceptionReelle || '—'}</Text>
              <Text style={s.colStatut}>{l.statut}</Text>
              <Text style={s.colMontant}>{fmt(l.montantTotal)}</Text>
              <Text style={[s.colEcart, l.ecart ? s.ecartOui : {}]}>{l.ecart ? 'Oui' : 'Non'}</Text>
            </View>
          ))}
        </View>

        <Text style={s.pied} fixed>
          Généré le {new Date().toLocaleDateString('fr-FR')} — PharmaGest
        </Text>
      </Page>
    </Document>
  )
}