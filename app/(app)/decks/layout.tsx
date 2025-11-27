// app/(app)/decks/layout.tsx
export const metadata = {
  title: 'Decks • QuickRecall',
  description: 'Manage your decks',
}

// No <html> or <body> here, and only ONE default export.
export default function DecksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
