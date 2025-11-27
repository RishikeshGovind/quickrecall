export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

async function handle(req: Request) {
  try {
    const { token, newPassword } = await req.json().catch(() => ({} as any))
    if (!token || !newPassword) {
      return NextResponse.json({ error: 'token and newPassword required' }, { status: 400 })
    }
    if (String(newPassword).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const prt = await prisma.passwordResetToken.findUnique({ where: { token } })
    if (!prt || prt.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: prt.userId }, data: { passwordHash: hash } })
    await prisma.passwordResetToken.deleteMany({ where: { userId: prt.userId } })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[password/reset/confirm] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err?.message || err) }, { status: 500 })
  }
}

export async function POST(req: Request) { return handle(req) }
