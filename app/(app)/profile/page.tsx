// app/(app)/profile/page.tsx
export const runtime = 'nodejs'

import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import StreakCounter from '@/components/StreakCounter'
import WeeklyActivity from '@/components/WeeklyActivity'

function avatarUrl(seed?: string) {
  const s = encodeURIComponent(seed || 'Learner')
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${s}`
}

// -- Server action: update display name (avatar auto-syncs)
async function updateProfile(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const displayName = String(formData.get('displayName') || '').trim().slice(0, 40)
  const seed = displayName || 'Learner'

  try {
    // normal Prisma update
    await prisma.userProfile.update({
      where: { userId: session.user.id },
      data: { displayName: displayName || null, avatarSeed: seed },
    })
  } catch (err) {
    // fallback: log error and try a raw SQL update that only touches the textual fields
    console.error('prisma update failed in updateProfile — attempting raw SQL fallback', err)
    try {
      await prisma.$executeRaw`UPDATE "UserProfile" SET "displayName" = ${displayName || null}, "avatarSeed" = ${seed} WHERE "userId" = ${session.user.id}`
    } catch (err2) {
      console.error('raw update fallback also failed', err2)
      // swallow to avoid showing 500 to the user; consider alerting in logs/monitoring
    }
  }

  revalidatePath('/profile')
}

// -- Server action: shuffle avatar
async function shuffleAvatar(_formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true },
  })
  const name = profile?.displayName || 'Learner'
  const rand = Math.floor(Math.random() * 10000)
  const newSeed = `${name}-${rand}`

  try {
    // normal Prisma update (will work once DB types are correct)
    await prisma.userProfile.update({
      where: { userId: session.user.id },
      data: { avatarSeed: newSeed },
    })
  } catch (err) {
    // If Prisma fails due to bad column conversion, fallback to raw SQL update
    // so the UI doesn't crash while we repair the DB.
    console.error('prisma update failed — attempting raw SQL fallback', err)
    try {
      await prisma.$executeRaw`UPDATE "UserProfile" SET "avatarSeed" = ${newSeed} WHERE "userId" = ${session.user.id}`
    } catch (err2) {
      console.error('raw update failed', err2)
      // swallow error to avoid showing 500 to the user
    }
  }

  revalidatePath('/profile')
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  // select only what's needed
  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      displayName: true,
      avatarSeed: true,
      streakCurrent: true,
      streakLongest: true,
    },
  })

  const displayName = profile?.displayName || 'Learner'
  const seed = profile?.avatarSeed || displayName

  // Prepare last 7 days keys (oldest -> newest)
  const toDateKey = (d: Date) => d.toISOString().slice(0, 10)
  const now = new Date()
  const last7Keys: string[] = []
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(now)
    dd.setDate(now.getDate() - i)
    // normalize to UTC date-key
    const utc = new Date(Date.UTC(dd.getFullYear(), dd.getMonth(), dd.getDate()))
    last7Keys.push(toDateKey(utc))
  }

  const days = await prisma.practiceDay.findMany({
    where: { dateKey: { in: last7Keys }, userId: session.user.id },
    select: { dateKey: true, reviews: true },
  })
  const map = new Map(days.map((d) => [d.dateKey, d.reviews ?? 0]))
  const last7Days = last7Keys.map((k) => map.get(k) ?? 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex items-center gap-4">
        <Image
          src={avatarUrl(seed)}
          alt="avatar"
          width={56}
          height={56}
          className="rounded"
          unoptimized
        />
        <div>
          <div className="text-lg font-semibold">{displayName}</div>
          <div className="text-sm text-gray-600">
            🔥 Streak: {profile?.streakCurrent ?? 0} (best {profile?.streakLongest ?? 0})
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="card">
        <h2 className="font-semibold mb-3">Profile</h2>
        <form action={updateProfile} className="space-y-3">
          <div>
            <label className="label" htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              className="input w-full"
              defaultValue={profile?.displayName ?? ''}
              placeholder="How others see you"
            />
            <p className="text-xs text-gray-500 mt-1">
              Your avatar updates with your display name.
            </p>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              Save
            </button>
            <button
              type="submit"
              formAction={shuffleAvatar}
              formNoValidate
              className="btn"
            >
              Shuffle avatar
            </button>
          </div>
        </form>
      </div>

      {/* Lightweight streak + 7-day activity (replaces heavy calendar) */}
      <div className="card">
        <h2 className="font-semibold mb-3">Practice activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <StreakCounter currentStreak={profile?.streakCurrent ?? 0} bestStreak={profile?.streakLongest ?? 0} />
          </div>
          <div className="md:col-span-2">
            <WeeklyActivity last7Days={last7Days} />
          </div>
        </div>
      </div>
    </div>
  )
}
