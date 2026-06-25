import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'PARENT') redirect('/unauthorized')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 bg-purple-900 text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-purple-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-purple-700 flex items-center justify-center font-bold text-sm">PE</div>
            <div>
              <div className="font-semibold text-sm">MICDS PE</div>
              <div className="text-xs text-purple-300">Parent View</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <Link href="/parent/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-purple-100 hover:bg-purple-800 hover:text-white transition-colors text-sm">
            <span>⊞</span><span>Dashboard</span>
          </Link>
        </nav>
        <div className="p-3 border-t border-purple-800">
          <p className="text-xs text-purple-400 px-3 mb-2">Read-only access</p>
          <a href="/api/auth/signout" className="flex items-center gap-2 px-3 py-2 rounded-lg text-purple-200 hover:bg-purple-800 hover:text-white transition-colors text-sm">
            <span>↩</span> Sign Out
          </a>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
