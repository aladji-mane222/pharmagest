import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { DonneesRecu, MODE_LABELS_RECU } from '@/lib/recu'

// ── Conversion mm -> points (1mm = 2.83465pt), unite native de react-pdf ──────
const MM = 2.83465

// Hauteur genereuse et fixe pour les formats thermiques : contrairement a
// une regle CSS @page appliquee via le dialogue d'impression du navigateur
// (deux tentatives ratees avant celle-ci — voir lib/recu.ts), ici la taille
// de page est une propriete du FICHIER PDF lui-meme, ecrite au moment de sa
// generation. Aucune negociation avec un pilote d'imprimante ou une
// destination de dialogue d'impression : le fichier fait exactement la
// taille qu'on lui donne, point final. Le surplus de hauteur (le recu ne
// remplit presque jamais toute la page) reste juste blanc — pas de risque
// de mise a l'echelle foireuse comme avec l'ancienne approche.
const TAILLES: Record<DonneesRecu['formatRecu'], 'A4' | [number, number]> = {
  A4: 'A4',
  THERMIQUE_58: [58 * MM, 1000 * MM],
  THERMIQUE_80: [80 * MM, 1000 * MM],
}

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' GNF'
}

export default function RecuPDF({ donnees: d }: { donnees: DonneesRecu }) {
  const estThermique = d.formatRecu !== 'A4'

  const s = StyleSheet.create({
    page: {
      paddingTop: estThermique ? 10 : 40,
      paddingBottom: estThermique ? 10 : 40,
      paddingHorizontal: estThermique ? 8 : 40,
      fontFamily: 'Helvetica',
      fontSize: estThermique ? 8 : 11,
      color: '#111111',
    },
    centre: { textAlign: 'center' },
    nomPharmacie: {
      fontFamily: 'Helvetica-Bold',
      fontSize: estThermique ? 10 : 16,
      color: '#0D2847',
    },
    meta: { fontSize: estThermique ? 7 : 9, color: '#999999', marginTop: 2 },
    separateur: {
      borderBottomWidth: 1, borderBottomColor: '#DDDDDD',
      marginVertical: estThermique ? 6 : 12,
    },
    ligneArticle: { marginBottom: estThermique ? 4 : 8 },
    ligneDetail: { flexDirection: 'row', justifyContent: 'space-between', color: '#666666' },
    ligneDetailMontant: { fontFamily: 'Helvetica-Bold', color: '#222222' },
    ligneTotal: {
      flexDirection: 'row', justifyContent: 'space-between',
      fontFamily: 'Helvetica-Bold', color: '#1A9D63',
      fontSize: estThermique ? 9 : 13,
    },
    lignePaiement: { flexDirection: 'row', justifyContent: 'space-between', color: '#555555' },
    ligneCredit: { flexDirection: 'row', justifyContent: 'space-between', color: '#C0392B', fontFamily: 'Helvetica-Bold' },
    merci: { textAlign: 'center', color: '#999999', fontSize: estThermique ? 7 : 9, marginTop: estThermique ? 8 : 16 },
  })

  return (
    <Document title={`Recu ${d.numero}`} author="PharmaGest">
      <Page size={TAILLES[d.formatRecu]} style={s.page}>
        <View style={s.centre}>
          <Text style={s.nomPharmacie}>{d.nomPharmacie}</Text>
          <Text style={s.meta}>Recu {d.numero}</Text>
          <Text style={s.meta}>{d.date}</Text>
        </View>

        <View style={s.separateur} />

        {d.lignes.map((l, i) => (
          <View key={i} style={s.ligneArticle}>
            <Text>{l.nom}</Text>
            <View style={s.ligneDetail}>
              <Text>{l.quantite} x {fmt(l.prixUnitaire)}</Text>
              <Text style={s.ligneDetailMontant}>{fmt(l.prixUnitaire * l.quantite)}</Text>
            </View>
          </View>
        ))}

        <View style={s.separateur} />

        <View style={s.ligneTotal}>
          <Text>Total</Text>
          <Text>{fmt(d.montantTotal)}</Text>
        </View>

        {d.paiements.map((p, i) => (
          <View key={i} style={s.lignePaiement}>
            <Text>{MODE_LABELS_RECU[p.modePaiement] ?? p.modePaiement}</Text>
            <Text>{fmt(p.montant)}</Text>
          </View>
        ))}

        {d.monnaie > 0 && (
          <View style={s.lignePaiement}>
            <Text>Monnaie</Text>
            <Text>{fmt(d.monnaie)}</Text>
          </View>
        )}

        {d.resteADu > 0 && (
          <View style={s.ligneCredit}>
            <Text>Reste a payer (credit{d.clientNom ? ` — ${d.clientNom}` : ''})</Text>
            <Text>{fmt(d.resteADu)}</Text>
          </View>
        )}

        <Text style={s.merci}>Merci de votre confiance !</Text>
      </Page>
    </Document>
  )
}