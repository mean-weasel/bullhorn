import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllArticles, getArticleBySlug } from '../content'

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllArticles().map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) return {}

  return {
    title: article.title,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.publishedAt,
    },
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) notFound()

  const Content = article.content
  const otherArticles = getAllArticles()
    .filter((a) => a.slug !== slug)
    .slice(0, 3)

  return (
    <article>
      <Link href="/articles" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; All articles
      </Link>

      <header className="mt-4">
        <time dateTime={article.publishedAt} className="text-sm text-muted-foreground">
          {new Date(article.publishedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">{article.title}</h1>
      </header>

      <div className="prose dark:prose-invert mt-8 max-w-none">
        <Content />
      </div>

      <div className="mt-12 rounded-lg border-3 border-[hsl(var(--gold))] bg-[hsl(var(--gold))/0.05] p-6 text-center">
        <p className="text-lg font-bold">Ready to schedule your posts?</p>
        <p className="mt-1 text-muted-foreground">
          Schedule across Twitter, LinkedIn, and Reddit from one place.
        </p>
        <Link
          href="/signup"
          className="sticker-button mt-4 inline-block bg-[hsl(var(--gold))] px-6 py-3"
        >
          Try Bullhorn Free
        </Link>
      </div>

      {otherArticles.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold">More articles</h2>
          <div className="mt-4 space-y-3">
            {otherArticles.map((other) => (
              <Link
                key={other.slug}
                href={`/articles/${other.slug}`}
                className="block rounded-lg border-2 border-border p-4 transition-colors hover:border-[hsl(var(--gold))]"
              >
                <p className="font-bold">{other.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{other.description}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}
