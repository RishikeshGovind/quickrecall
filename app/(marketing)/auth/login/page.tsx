'use client'

import type { FormEvent } from 'react'
import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

function LoginInner() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const params = useSearchParams()

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (res?.error) {
      setError('Invalid email or password')
    } else {
      // Go to decks after successful login
      window.location.href = '/decks'
    }
  }

  const message = params.get('m')

  return (
    <div className="card">
      <h1 className="text-xl font-semibold mb-4">Log in</h1>

      {/* Messages based on ?m=... */}
      {message === 'signedup' && (
        <p className="mb-3 text-green-700">Account created. You can log in now.</p>
      )}
      {message === 'reset' && (
        <p className="mb-3 text-green-700">Password updated. Please log in.</p>
      )}

      {/* Error */}
      {error && <p className="mb-3 text-red-700">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" required />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input className="input" id="password" name="password" type="password" required />
        </div>

        <button disabled={loading} className="btn btn-primary w-full" type="submit">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        {/* Forgot password link */}
        <p className="text-sm text-center mt-3">
          <a className="underline text-blue-600" href="/auth/reset/request">
            Forgot password?
          </a>
        </p>
      </form>
    </div>
  )
}

export default function LoginPage() {
  // ✅ Wrap the component that uses useSearchParams in Suspense
  return (
    <Suspense fallback={<div className="card">Loading…</div>}>
      <LoginInner />
    </Suspense>
  )
}
