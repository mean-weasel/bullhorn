'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { LaunchPostForm } from '@/components/launch-posts/LaunchPostForm'
import { LaunchPost } from '@/lib/launchPosts'

export default function EditLaunchPostPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [post, setPost] = useState<LaunchPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPost() {
      try {
        const res = await fetch(`/api/launch-posts/${id}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('Launch post not found')
          } else {
            throw new Error('Failed to fetch launch post')
          }
          return
        }
        const data = await res.json()
        setPost(data.launchPost)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="text-center py-12 bg-card border border-destructive/30 rounded-xl">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="font-semibold mb-2 text-destructive">
            {error || 'Launch post not found'}
          </h3>
          <button
            onClick={() => router.push('/launch-posts')}
            className="mt-4 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            Back to Launch Posts
          </button>
        </div>
      </div>
    )
  }

  return <LaunchPostForm post={post} />
}
