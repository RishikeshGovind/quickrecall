// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const g = globalThis as unknown as {
  prisma?: PrismaClient
  __hasPrismaQueryLogger?: boolean
}

const isProd = process.env.NODE_ENV === 'production'

export const prisma =
  g.prisma ??
  new PrismaClient({
    // In development, log all queries so you can see timings.
    // In production, keep logging minimal for better performance.
    log: isProd ? ['warn', 'error'] : [{ emit: 'event', level: 'query' }, 'warn', 'error'],
  })

// Only attach the verbose query logger in development, and only once.
if (!isProd && !g.__hasPrismaQueryLogger) {
  // 👇 cast to any to avoid the 'never' error
  ;(prisma as any).$on('query', (e: any) => {
    console.log('prisma', `${e.duration}ms`, String(e.query || '').split('\n')[0])
  })
  g.__hasPrismaQueryLogger = true
}

if (!isProd) {
  g.prisma = prisma
}
