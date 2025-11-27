export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

async function getEmail(req: Request): Promise<string | null> {
  const url = new URL(req.url)
  const q = url.searchParams.get('email') || url.searchParams.get('username')
  if (q && q.trim()) return q.trim().toLowerCase()

  const ct = (req.headers.get('content-type') || '').toLowerCase()

  if (ct.includes('application/json')) {
    const j = await req.json().catch(() => ({} as any))
    const v = (j?.email ?? j?.username)
    if (typeof v === 'string' && v.trim()) return v.trim().toLowerCase()
  }

  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    const fd = await req.formData().catch(() => null)
    const v = fd?.get('email') ?? fd?.get('username')
    if (typeof v === 'string' && v.trim()) return v.trim().toLowerCase()
  }

  const raw = await req.text().catch(() => '')
  if (raw && raw.trim()) return raw.trim().toLowerCase()

  return null
}

async function handle(req: Request) {
  try {
    const email = await getEmail(req)
    if (!email) {
      return NextResponse.json(
        { error: 'Email required', detail: 'No email found in query/header/body.' },
        { status: 400 }
      )
    }

    // Privacy: don’t reveal if the email exists
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return NextResponse.json({ ok: true })

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    console.log('[Password reset link]', `${baseUrl}/auth/reset/${token}`)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[password/reset/request] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err?.message || err) }, { status: 500 })
  }
}

export async function POST(req: Request) { return handle(req) }
export async function GET(req: Request)  { return handle(req) }
