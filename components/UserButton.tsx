'use client'
import { signOut } from 'next-auth/react'


export default function UserButton() {
return (
<button className="btn" onClick={() => signOut({ callbackUrl: '/' })}>
Log out
</button>
)
}