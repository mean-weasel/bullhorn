import type { Metadata } from 'next'
import { getAllArticles } from './content'
import { ArticleCard } from './components/ArticleCard'

export const metadata: Metadata = {
  title: 'Articles',
  description:
    'Guides and tips on social media scheduling, content planning, and product launches for developers and indie hackers.',
}

export default function ArticlesPage() {
  const articles = getAllArticles()

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Articles</h1>
      <p className="mt-2 text-muted-foreground">
        Guides on social media scheduling, product launches, and building in public.
      </p>
      <div className="mt-8 space-y-6">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </div>
  )
}
