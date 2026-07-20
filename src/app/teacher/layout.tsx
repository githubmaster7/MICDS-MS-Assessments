import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') redirect('/unauthorized')

  const navLinks = [
    { href: '/teacher/dashboard', label: 'Dashboard', icon: '⊞' },
    { href: '/teacher/grade/students', label: 'Grade Students', icon: '✏️' },
    { href: '/teacher/mass-grading', label: 'Year at a Glance', icon: '📊' },
    { href: '/teacher/history', label: 'My History', icon: '📚' },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 h-screen sticky top-0 bg-slate-800 text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-slate-600 flex items-center justify-center font-bold text-sm">PE</div>
            <div>
              <div className="font-semibold text-sm">MICDS PE</div>
              <div className="text-xs text-slate-400">Teacher</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navLinks.map(({ href, label, icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm">
              <span>{icon}</span><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <div className="text-xs text-slate-400 px-3 mb-2">{session.user.email}</div>
          <a href="/api/auth/signout" className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm">
            <span>↩</span> Sign Out
          </a>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
