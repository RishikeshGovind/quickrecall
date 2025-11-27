// app/api/auth/signup/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Use bcryptjs (pure JS) to avoid native build issues
import bcrypt from 'bcryptjs'

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function POST(req: Request) {
  try {
    // Accept JSON or form-data
    const ct = (req.headers.get('content-type') || '').toLowerCase()
    let email = ''
    let password = ''

    if (ct.includes('application/json')) {
      const body = await req.json()
      email = String(body.email || '').trim().toLowerCase()
      password = String(body.password || '')
    } else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const fd = await req.formData()
      email = String(fd.get('email') || '').trim().toLowerCase()
      password = String(fd.get('password') || '')
    } else {
      const body = await req.text()
      try {
        const j = JSON.parse(body)
        email = String(j.email || '').trim().toLowerCase()
        password = String(j.password || '')
      } catch {
        // ignore
      }
    }

    if (!email || !password) return bad('Email and password required')

    // Unique check
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return bad('Email already in use', 409)

    const passwordHash = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true },
    })

    // Seed profile with NEW field names (important!)
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        timezone: 'UTC',
        dailyGoalReviews: 10,
        hearts: 5,
        heartsMax: 5,
        streakCurrent: 0,
        streakLongest: 0,
        displayName: user.email.split('@')[0].replace(/[\W_]+/g, ' ').trim() || 'Learner',
        avatarSeed: 'Koala ' + Math.floor(Math.random() * 9999),
      },
    })

    // You can redirect client-side after success
    return NextResponse.json({ ok: true, user })
  } catch (err: any) {
    console.error('[signup] error:', err)
    // P2002 unique, etc.
    if (err?.code === 'P2002') return bad('Email already in use', 409)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
