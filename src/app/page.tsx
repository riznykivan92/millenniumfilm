import { redirect } from 'next/navigation'

export default function Home() {
  // Main landing page is the static HTML for now
  // In future - replace with full Next.js landing page
  redirect('/admin')
}
