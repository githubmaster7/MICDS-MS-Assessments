import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { StudentAppShell } from '@/components/layout/StudentAppShell'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') redirect('/unauthorized')

  return (
    <StudentAppShell
      userName={session.user.name ?? undefined}
      userEmail={session.user.email ?? undefined}
    >
      {children}
    </StudentAppShell>
  )
}
