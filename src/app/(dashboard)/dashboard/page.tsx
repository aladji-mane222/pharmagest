import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Tableau de bord
        </h1>
        <p className="text-gray-500 mb-8">
          Bienvenue, {session.user.name} — {session.user.role}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700">Ventes du jour</h2>
            <p className="text-3xl font-bold text-green-600 mt-2">0 GNF</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700">Stock bas</h2>
            <p className="text-3xl font-bold text-orange-500 mt-2">0</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700">Péremptions</h2>
            <p className="text-3xl font-bold text-red-500 mt-2">0</p>
          </div>
        </div>
      </div>
    </div>
  )
}
