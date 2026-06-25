import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') redirect('/unauthorized')

  const navLinks = [
    { href: '/student/dashboard', label: 'My Dashboard', icon: '⊞' },
    { href: '/student/history', label: 'My Classes', icon: '📚' },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 bg-green-900 text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-green-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-green-700 flex items-center justify-center font-bold text-sm">PE</div>
            <div>
              <div className="font-semibold text-sm">MICDS PE</div>
              <div className="text-xs text-green-300">Student</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navLinks.map(({ href, label, icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-3 py-2 rounded-lg text-green-100 hover:bg-green-800 hover:text-white transition-colors text-sm">
              <span>{icon}</span><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-green-800">
          <a href="/api/auth/signout" className="flex items-center gap-2 px-3 py-2 rounded-lg text-green-200 hover:bg-green-800 hover:text-white transition-colors text-sm">
            <span>↩</span> Sign Out
          </a>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
