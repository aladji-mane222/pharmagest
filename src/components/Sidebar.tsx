'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const menuItems = [
  { href: '/dashboard', label: 'Tableau de bord', icon: '📊' },
  { href: '/medicaments', label: 'Medicaments', icon: '💊' },
  { href: '/stock', label: 'Stock', icon: '📦' },
  { href: '/ventes', label: 'Ventes POS', icon: '🛒' },
  { href: '/caisse', label: 'Caisse', icon: '💰' },
  { href: '/clients', label: 'Clients', icon: '👥' },
  { href: '/fournisseurs', label: 'Fournisseurs', icon: '🚚' },
  { href: '/inventaire', label: 'Inventaire', icon: '📋' },
  { href: '/depenses', label: 'Depenses', icon: '💸' },
  { href: '/rapports', label: 'Rapports', icon: '📈' },
  { href: '/personnel', label: 'Personnel', icon: '👤' },
  { href: '/parametres', label: 'Parametres', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="w-64 min-h-screen bg-green-800 text-white flex flex-col">
      <div className="p-6 border-b border-green-700">
        <h1 className="text-xl font-bold">PharmaGest</h1>
        <p className="text-green-300 text-xs mt-1">Pilotee par vous</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-green-600 text-white font-medium'
                  : 'text-green-100 hover:bg-green-700'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-green-700">
        <div className="mb-3">
          <p className="text-sm font-medium">{session?.user?.name}</p>
          <p className="text-xs text-green-300">{session?.user?.role}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-left text-xs text-green-300 hover:text-white transition-colors"
        >
          Se deconnecter
        </button>
      </div>
    </aside>
  )
}
