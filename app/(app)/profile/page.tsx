// app/(app)/profile/page.tsx
export const runtime = 'nodejs'

import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import ProfileCalendar from '@/components/ProfileCalendar'

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

  await prisma.userProfile.update({
    where: { userId: session.user.id },
    data: { displayName: displayName || null, avatarSeed: seed },
  })

  revalidatePath('/profile')
}

// -- Server action: shuffle avatar
async function shuffleAvatar(_formData: FormData) {
  'use server'
  const tAll = Date.now()

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  // ✅ Only need displayName here
  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true },
  })
  const name = profile?.displayName || 'Learner'
  const rand = Math.floor(Math.random() * 10000)

  const tUpd = Date.now()
  await prisma.userProfile.update({
    where: { userId: session.user.id },
    data: { avatarSeed: `${name}-${rand}` },
  })
  console.log('shuffleAvatar update ms', Date.now() - tUpd)

  revalidatePath('/profile')
  console.log('shuffleAvatar total ms', Date.now() - tAll)
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  // ✅ Explicitly select just what this page uses
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

      <div className="card">
        <h2 className="font-semibold mb-3">Practice history</h2>
        <ProfileCalendar year={new Date().getFullYear()} />
      </div>
    </div>
  )
}
