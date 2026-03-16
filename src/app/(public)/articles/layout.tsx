import { ArticlesHeader } from './components/ArticlesHeader'
import { ArticlesFooter } from './components/ArticlesFooter'

export default function ArticlesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ArticlesHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>
      <ArticlesFooter />
    </div>
  )
}
