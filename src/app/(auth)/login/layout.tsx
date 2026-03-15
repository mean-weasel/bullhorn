import type { Metadata } from 'next'

// eslint-disable-next-line react-refresh/only-export-components -- Next.js metadata export
export const metadata: Metadata = {
  title: 'Log in',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
