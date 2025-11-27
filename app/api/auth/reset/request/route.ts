export const runtime = 'nodejs' // ensure Node runtime (Prisma + crypto)

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

async function getEmailFromRequest(req: Request): Promise<string | null> {
  // 1) Query string
  const url = new URL(req.url)
  const q = url.searchParams.get('email') || url.searchParams.get('username')
  if (typeof q === 'string' && q.trim()) return q.trim().toLowerCase()

  // 2) Header (fallback)
  const hdr = req.headers.get('x-email')
  if (hdr && hdr.trim()) return hdr.trim().toLowerCase()

  // 3) Content-type aware body parsing
  const ct = (req.headers.get('content-type') || '').toLowerCase()

  if (ct.includes('application/json')) {
    const j = await req.json().catch(() => ({} as any))
    const val = (j?.email ?? j?.username) as unknown
    if (typeof val === 'string' && val.trim()) return val.trim().toLowerCase()
    return null
  }

  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    const fd = await req.formData().catch(() => null)
    const v = fd?.get('email') ?? fd?.get('username')
    if (typeof v === 'string' && v.trim()) return v.trim().toLowerCase()
    return null
  }

  // 4) Last resort: raw text or JSON parse
  const raw = await req.text().catch(() => '')
  if (raw && raw.trim()) {
    try {
      const j = JSON.parse(raw)
      const val = (j?.email ?? j?.username) as unknown
      if (typeof val === 'string' && val.trim()) return val.trim().toLowerCase()
    } catch {
      // not JSON: treat raw text as the email field
      return raw.trim().toLowerCase()
    }
  }

  return null
}

async function handle(req: Request) {
  try {
    const email = await getEmailFromRequest(req)
    if (!email) {
      return NextResponse.json(
        { error: 'Email required', detail: 'No email found in query/header/body.' },
        { status: 400 }
      )
    }

    // Privacy: never reveal whether the email exists
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      // Return 200 even if there is no such user
      return NextResponse.json({ ok: true })
    }

    // Delete previous tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

    // Create a new token (1 hour expiry)
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/auth/reset/${token}`
    console.log('[Password reset link]', resetUrl)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    const msg = String(err?.message || err)
    console.error('[reset/request] error:', err)
    return NextResponse.json({ error: 'server_error', detail: msg }, { status: 500 })
  }
}

// ✅ Accept both POST and GET to eliminate method mismatches
export async function POST(req: Request) {
  return handle(req)
}
export async function GET(req: Request) {
  return handle(req)
}
