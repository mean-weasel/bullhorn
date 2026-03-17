import type { ReactElement } from 'react'

export interface Article {
  slug: string
  title: string
  description: string
  publishedAt: string
  updatedAt?: string
  keywords: string[]
}

export interface ArticleWithContent extends Article {
  content: () => ReactElement
}

import { article as scheduleLinkedin } from './schedule-linkedin-posts'
import { article as schedulingTools } from './social-media-scheduling-tools'
import { article as schedulingDevs } from './social-media-scheduling-for-developers'
import { article as bullhornVsBuffer } from './bullhorn-vs-buffer'
import { article as launchChecklist } from './product-launch-social-media-checklist'
import { article as aiScheduling } from './ai-social-media-scheduling'

const articles: ArticleWithContent[] = [
  scheduleLinkedin,
  schedulingTools,
  schedulingDevs,
  bullhornVsBuffer,
  launchChecklist,
  aiScheduling,
]

export function getAllArticles(): Article[] {
  return articles
    .map(({ content: _, ...metadata }) => metadata)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}

export function getArticleBySlug(slug: string): ArticleWithContent | undefined {
  return articles.find((a) => a.slug === slug)
}
