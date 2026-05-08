'use client'

import { useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/utils'

interface AuditLog {
  id: string
  action: string
  details: Record<string, unknown> | null
  createdAt: string
  user: { nom: string } | null
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [selected, setSelected] = useState<AuditLog | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      fetch(`/api/audit?action=${action}`)
        .then((res) => res.json())
        .then((json) => {
          setLogs(json.data?.logs || [])
          setTotal(json.data?.total || 0)
          setLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [action])

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Journal d activite</h1>
          <p className="text-gray-500 text-sm">{total} actions enregistrees</p>
        </div>
        <input
          type="text"
          placeholder="Filtrer par action..."
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Detail</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <p className="text-sm text-gray-500 mb-1">Action : <span className="font-medium text-gray-800">{selected.action}</span></p>
            <p className="text-sm text-gray-500 mb-1">Par : <span className="font-medium">{selected.user?.nom || 'Systeme'}</span></p>
            <p className="text-sm text-gray-500 mb-4">Date : <span className="font-medium">{formatDateTime(selected.createdAt)}</span></p>
            {selected.details && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Details :</p>
                <pre className="text-xs text-gray-700 overflow-auto">
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucune action</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">Date</th>
                <th className="text-left px-6 py-3 text-gray-600">Action</th>
                <th className="text-left px-6 py-3 text-gray-600">Par</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600">{formatDateTime(log.createdAt)}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{log.user?.nom || 'Systeme'}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => setSelected(log)}
                      className="text-green-600 hover:underline text-sm">
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
