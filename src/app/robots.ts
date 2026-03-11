import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/signup', '/docs/mcp'],
        disallow: [
          '/dashboard',
          '/posts',
          '/new',
          '/edit',
          '/campaigns',
          '/projects',
          '/launch-posts',
          '/blog',
          '/settings',
          '/profile',
          '/api',
        ],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL || 'https://bullhorn.to'}/sitemap.xml`,
  }
}
