import Link from 'next/link'
import type { Article } from '../content'

interface ArticleCardProps {
  article: Article
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Link href={`/articles/${article.slug}`} className="block">
      <article className="sticker-card-hover p-6 transition-all">
        <time dateTime={article.publishedAt} className="text-sm text-muted-foreground">
          {new Date(article.publishedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <h2 className="mt-2 text-xl font-bold">{article.title}</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">{article.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {article.keywords.slice(0, 3).map((kw) => (
            <span key={kw} className="sticker-badge text-xs">
              {kw}
            </span>
          ))}
        </div>
      </article>
    </Link>
  )
}
