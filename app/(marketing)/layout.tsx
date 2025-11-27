// app/(marketing)/layout.tsx
import '../globals.css'

export const metadata = {
  title: 'QuickRecall',
  description: 'Study smarter',
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
}
