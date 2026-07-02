import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatMontant, formatDateTime } from '@/lib/utils'
import DashboardClient from '@/components/dashboard/DashboardClient'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const pharmacieId = session.user.pharmacieId
  const now         = new Date()
  const debutJour   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const debutMois   = new Date(now.getFullYear(), now.getMonth(), 1)
  const dans90Jours = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const result = await prisma.$queryRaw<any[]>`
    WITH stats AS (
      SELECT
        (SELECT COALESCE(SUM("montantTotal"), 0) FROM "Vente"
         WHERE "pharmacieId" = ${pharmacieId} AND "createdAt" >= ${debutJour} AND "statut" = 'COMPLETE') as ca_jour,
        (SELECT COALESCE(SUM("montantTotal"), 0) FROM "Vente"
         WHERE "pharmacieId" = ${pharmacieId} AND "createdAt" >= ${debutMois} AND "statut" = 'COMPLETE') as ca_mois,
        (SELECT COUNT(*) FROM "Medicament"
         WHERE "pharmacieId" = ${pharmacieId} AND "actif" = true) as total_meds
    ),
    ventes_recentes AS (
      SELECT json_agg(v) FROM (
        SELECT v.id, v."montantTotal", v."createdAt", u.nom as "userNom"
        FROM "Vente" v
        JOIN "User" u ON u.id = v."userId"
        WHERE v."pharmacieId" = ${pharmacieId}
        ORDER BY v."createdAt" DESC
        LIMIT 5
      ) v
    ),
    stock_bas AS (
      SELECT json_agg(s) FROM (
        SELECT m.id, m.nom, COALESCE(SUM(l.quantite), 0)::int as "stockTotal", m."stockMinimum"
        FROM "Medicament" m
        LEFT JOIN "Lot" l ON l."medicamentId" = m.id AND l.actif = true
        WHERE m."pharmacieId" = ${pharmacieId} AND m.actif = true
        GROUP BY m.id, m.nom, m."stockMinimum"
        HAVING COALESCE(SUM(l.quantite), 0) < m."stockMinimum"
        LIMIT 5
      ) s
    ),
    peremptions AS (
      SELECT json_agg(p) FROM (
        SELECT l.id, l."datePeremption", m.id as "medicamentId", m.nom as "medicamentNom"
        FROM "Lot" l
        JOIN "Medicament" m ON m.id = l."medicamentId"
        WHERE m."pharmacieId" = ${pharmacieId} AND l.actif = true
          AND l."datePeremption" <= ${dans90Jours} AND l."datePeremption" >= ${now}
        ORDER BY l."datePeremption" ASC
        LIMIT 5
      ) p
    )
    SELECT
      stats.*,
      COALESCE(ventes_recentes.json_agg, '[]'::json) as ventes_recentes,
      COALESCE(stock_bas.json_agg, '[]'::json) as stock_bas,
      COALESCE(peremptions.json_agg, '[]'::json) as peremptions
    FROM stats, ventes_recentes, stock_bas, peremptions;
  `

  const data = result[0]

  const initialData = {
    caJour:      Number(data.ca_jour),
    caMois:      Number(data.ca_mois),
    stockBas:    (data.stock_bas as any[]).length,
    peremptions: (data.peremptions as any[]).length,
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tableau de bord</h1>

        {/* Raccourcis rapides */}
        <div className="flex gap-3">
          <Link
            href="/ventes"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#2ECC8A' }}
          >
            🛒 Nouvelle vente
          </Link>
          <Link
            href="/caisse"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            💰 Ma caisse
          </Link>
          <Link
            href="/depenses"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            💸 Saisir dépense
          </Link>
        </div>
      </div>

      <DashboardClient initialData={initialData} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-8">
        {/* Alertes stock bas */}
        <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              ⚠️ Alertes Stock Bas
            </h2>
            {(data.stock_bas as any[]).length > 0 && (
              <Link href="/stock?filtre=bas"
                className="text-xs text-green-600 hover:underline">
                Voir tout →
              </Link>
            )}
          </div>
          {(data.stock_bas as any[]).length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune alerte</p>
          ) : (
            <ul className="space-y-3">
              {(data.stock_bas as any[]).map((med) => (
                <li key={med.id}>
                  <Link
                    href={`/medicaments/${med.id}`}
                    className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 rounded-lg transition-colors group"
                  >
                    <span className="text-gray-700 font-medium group-hover:text-green-600 transition-colors">
                      {med.nom}
                    </span>
                    <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded font-bold">
                      {med.stockTotal} / {med.stockMinimum} min
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Péremptions proches */}
        <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              📅 Péremptions proches
            </h2>
            {(data.peremptions as any[]).length > 0 && (
              <Link href="/stock?filtre=critiques"
                className="text-xs text-green-600 hover:underline">
                Voir tout →
              </Link>
            )}
          </div>
          {(data.peremptions as any[]).length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune alerte</p>
          ) : (
            <ul className="space-y-3">
              {(data.peremptions as any[]).map((lot) => {
                const jours = Math.ceil(
                  (new Date(lot.datePeremption).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                )
                return (
                  <li key={lot.id}>
                    <Link
                      href={`/stock`}
                      className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 rounded-lg transition-colors group"
                    >
                      <span className="text-gray-700 font-medium group-hover:text-green-600 transition-colors">
                        {lot.medicamentNom}
                      </span>
                      <span className={`px-2 py-1 rounded font-bold text-xs ${
                        jours <= 30 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                      }`}>
                        {jours <= 0 ? 'Expiré' : `J-${jours}`}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Ventes récentes */}
      <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-700">🛒 Ventes récentes</h2>
          <Link href="/ventes/historique"
            className="text-xs text-green-600 hover:underline">
            Voir tout →
          </Link>
        </div>
        {(data.ventes_recentes as any[]).length === 0 ? (
          <p className="text-gray-400 text-sm">Aucune vente pour le moment</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold">Caissier</th>
                  <th className="pb-3 text-right font-semibold">Montant</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {(data.ventes_recentes as any[]).map((vente) => (
                  <tr key={vente.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 text-gray-600">{formatDateTime(vente.createdAt)}</td>
                    <td className="py-3 text-gray-600">{vente.userNom}</td>
                    <td className="py-3 text-right font-bold text-green-600">
                      {formatMontant(vente.montantTotal)}
                    </td>
                    <td className="py-3 text-right">
                      <Link href={`/ventes/${vente.id}`}
                        className="text-xs text-green-600 hover:underline">
                        Voir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}