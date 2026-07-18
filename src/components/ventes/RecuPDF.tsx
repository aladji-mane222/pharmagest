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
// Hauteur de page pour les formats thermiques : calculee a partir du
// contenu reel (nombre d'articles, de lignes de paiement, etc.) plutot
// qu'une valeur fixe arbitraire. Avant, une hauteur fixe de 1000mm avait
// ete choisie par prudence pour ne jamais risquer de couper le contenu —
// mais si le pilote d'impression thermique traite la page comme une taille
// fixe plutot que du papier continu, ca aurait imprime un metre de papier
// blanc a chaque reçu. Ici la page fait la taille du contenu, plus une
// marge de securite raisonnable — jamais de gaspillage, quel que soit le
// comportement du pilote cote imprimante.
function hauteurEstimeePt(d: DonneesRecu): number {
  const ENTETE = 62          // nom pharmacie + numero + date
  const SEPARATEUR = 12
  const PAR_ARTICLE = 26     // nom + ligne quantite/prix, par article
  const LIGNE_TOTAL = 16
  const PAR_PAIEMENT = 12
  const PIED_DE_PAGE = 26    // "Merci de votre confiance !" + marge
  const SECURITE = 40        // marge de securite (retour a la ligne d'un long nom, etc.)

  const hauteur =
    ENTETE +
    SEPARATEUR +
    d.lignes.length * PAR_ARTICLE +
    SEPARATEUR +
    LIGNE_TOTAL +
    d.paiements.length * PAR_PAIEMENT +
    (d.monnaie > 0 ? PAR_PAIEMENT : 0) +
    (d.resteADu > 0 ? PAR_PAIEMENT : 0) +
    PIED_DE_PAGE +
    SECURITE

  // Plancher raisonnable pour un tout petit reçu (1 seul article) — evite
  // une page ridiculement courte qui donnerait un rendu ecrase.
  return Math.max(hauteur, 220)
}

const tailleRecu = (d: DonneesRecu): 'A4' | [number, number] => {
  if (d.formatRecu === 'A4') return 'A4'
  const largeurPt = d.formatRecu === 'THERMIQUE_58' ? 58 * MM : 80 * MM
  return [largeurPt, hauteurEstimeePt(d)]
}

// Intl.NumberFormat('fr-FR') utilise un espace insecable fin (U+202F) comme
// separateur de milliers — glyphe absent de la police Helvetica de base
// utilisee par react-pdf, ce qui produisait un rendu casse ("2/000" au
// lieu de "2 000", ou l'espace disparaissait carrement selon les cas).
// Formatage manuel avec un espace ASCII normal, que la police supporte a
// coup sur.
function fmt(n: number): string {
  const entier = Math.round(n)
  const avecEspaces = entier.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${avecEspaces} GNF`
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
      <Page size={tailleRecu(d)} style={s.page}>
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