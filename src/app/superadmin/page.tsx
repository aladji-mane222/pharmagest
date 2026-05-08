'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Pharmacie {
  id: string
  nom: string
  adresse: string | null
  telephone: string | null
  licenceActive: boolean
  licenceExpire: string | null
  createdAt: string
  _count: { users: number; medicaments: number; ventes: number }
}

export default function SuperAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pharmacies, setPharmacies] = useState<Pharmacie[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'SUPER_ADMIN') {
      fetch('/api/superadmin/pharmacies')
        .then((res) => res.json())
        .then((json) => {
          setPharmacies(json.data || [])
          setLoading(false)
        })
    }
  }, [status, session])

  const toggleLicence = async (id: string, licenceActive: boolean) => {
    const res = await fetch(`/api/superadmin/pharmacies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenceActive: !licenceActive }),
    })
    if (res.ok) {
      setPharmacies(pharmacies.map((p) =>
        p.id === id ? { ...p, licenceActive: !licenceActive } : p
      ))
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Super Admin</h1>
        <p className="text-gray-500 mb-8">Gestion de toutes les pharmacies</p>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <p className="text-sm text-gray-500">Total pharmacies</p>
            <p className="text-3xl font-bold text-gray-800">{pharmacies.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <p className="text-sm text-gray-500">Licences actives</p>
            <p className="text-3xl font-bold text-green-600">{pharmacies.filter((p) => p.licenceActive).length}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <p className="text-sm text-gray-500">Licences inactives</p>
            <p className="text-3xl font-bold text-red-500">{pharmacies.filter((p) => !p.licenceActive).length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Pharmacie</th>
                <th className="text-left px-6 py-3 text-gray-600">Contact</th>
                <th className="text-center px-6 py-3 text-gray-600">Users</th>
                <th className="text-center px-6 py-3 text-gray-600">Medicaments</th>
                <th className="text-center px-6 py-3 text-gray-600">Ventes</th>
                <th className="text-center px-6 py-3 text-gray-600">Licence</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pharmacies.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium">{p.nom}</p>
                    <p className="text-gray-400 text-xs">{p.adresse || '-'}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{p.telephone || '-'}</td>
                  <td className="px-6 py-4 text-center">{p._count.users}</td>
                  <td className="px-6 py-4 text-center">{p._count.medicaments}</td>
                  <td className="px-6 py-4 text-center">{p._count.ventes}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.licenceActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {p.licenceActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleLicence(p.id, p.licenceActive)}
                      className={`text-xs px-3 py-1 rounded-lg ${p.licenceActive ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}>
                      {p.licenceActive ? 'Desactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
