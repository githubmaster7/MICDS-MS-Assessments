import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TeacherAppShell } from '@/components/layout/TeacherAppShell'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') redirect('/unauthorized')

  return (
    <TeacherAppShell
      userName={session.user.name ?? undefined}
      userEmail={session.user.email ?? undefined}
    >
      {children}
    </TeacherAppShell>
  )
}
