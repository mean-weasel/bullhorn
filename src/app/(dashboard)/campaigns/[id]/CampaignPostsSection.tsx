'use client'

import Link from 'next/link'
import { Plus, FileText, Rocket, X } from 'lucide-react'
import { Post } from '@/lib/posts'
import { LaunchPost } from '@/lib/launchPosts'
import { cn } from '@/lib/utils'
import { LaunchPostCard } from '@/components/launch-posts/LaunchPostCard'
import { CampaignPostCard } from './CampaignPostCard'

interface PostsSectionProps {
  campaignId: string
  posts: Post[]
  availablePostsCount: number
  onShowAddModal: () => void
  onRemovePost: (postId: string) => void
}

export function PostsSection({
  campaignId,
  posts,
  availablePostsCount,
  onShowAddModal,
  onRemovePost,
}: PostsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Posts in Campaign</h2>
        <div className="flex gap-2">
          {availablePostsCount > 0 && (
            <button
              onClick={onShowAddModal}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Existing Post
            </button>
          )}
          <NewPostButton campaignId={campaignId} label="New Post" />
        </div>
      </div>
      {posts.length === 0 ? (
        <EmptyPostsState campaignId={campaignId} />
      ) : (
        <div className="space-y-3">
          {posts.map((post, i) => (
            <CampaignPostCard
              key={post.id}
              post={post}
              index={i}
              onRemove={() => onRemovePost(post.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NewPostButton({ campaignId, label }: { campaignId: string; label: string }) {
  return (
    <Link
      href={`/new?campaign=${campaignId}`}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
        'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
        'border-2 border-[hsl(var(--gold-dark))]',
        'text-primary-foreground hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
      )}
    >
      <Plus className="w-4 h-4" />
      {label}
    </Link>
  )
}

function EmptyPostsState({ campaignId }: { campaignId: string }) {
  return (
    <div className="text-center py-12 bg-card border border-border rounded-xl">
      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[hsl(var(--gold))]/10 flex items-center justify-center">
        <FileText className="w-6 h-6 text-[hsl(var(--gold-dark))]" />
      </div>
      <h3 className="font-semibold mb-1">No posts yet</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Add posts to this campaign to track them together.
      </p>
      <Link
        href={`/new?campaign=${campaignId}`}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
          'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
          'border-2 border-[hsl(var(--gold-dark))]',
          'text-primary-foreground hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
        )}
      >
        <Plus className="w-4 h-4" />
        Create First Post
      </Link>
    </div>
  )
}

interface LaunchPostsSectionProps {
  campaignId: string
  launchPosts: LaunchPost[]
  availableLaunchPostsCount: number
  onShowAddModal: () => void
  onRemoveLaunchPost: (id: string) => void
  onDeleteLaunchPost: (id: string) => void
  onEditLaunchPost: (id: string) => void
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export function LaunchPostsSection({
  campaignId,
  launchPosts,
  availableLaunchPostsCount,
  onShowAddModal,
  onRemoveLaunchPost,
  onDeleteLaunchPost,
  onEditLaunchPost,
}: LaunchPostsSectionProps) {
  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Rocket className="w-5 h-5 text-[hsl(var(--gold-dark))]" />
          Launch Posts
        </h2>
        <div className="flex gap-2">
          {availableLaunchPostsCount > 0 && (
            <button
              onClick={onShowAddModal}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Existing
            </button>
          )}
          <Link
            href={`/launch-posts/new?campaignId=${campaignId}`}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
              'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
              'border-2 border-[hsl(var(--gold-dark))]',
              'text-primary-foreground hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
            )}
          >
            <Plus className="w-4 h-4" />
            New Launch Post
          </Link>
        </div>
      </div>
      {launchPosts.length === 0 ? (
        <EmptyLaunchPostsState campaignId={campaignId} />
      ) : (
        <div className="space-y-3">
          {launchPosts.map((lp, i) => (
            <div key={lp.id} className="relative group">
              <LaunchPostCard
                post={lp}
                index={i}
                onEdit={() => onEditLaunchPost(lp.id)}
                onDelete={() => onDeleteLaunchPost(lp.id)}
              />
              <button
                onClick={() => onRemoveLaunchPost(lp.id)}
                className="absolute top-3 right-14 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove from campaign"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyLaunchPostsState({ campaignId }: { campaignId: string }) {
  return (
    <div className="text-center py-8 bg-card border border-border rounded-xl">
      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[hsl(var(--gold))]/10 flex items-center justify-center">
        <Rocket className="w-6 h-6 text-[hsl(var(--gold-dark))]" />
      </div>
      <h3 className="font-semibold mb-1">No launch posts yet</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Add launch posts to coordinate your product launch across platforms.
      </p>
      <Link
        href={`/launch-posts/new?campaignId=${campaignId}`}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
          'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
          'border-2 border-[hsl(var(--gold-dark))]',
          'text-primary-foreground hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
        )}
      >
        <Plus className="w-4 h-4" />
        Create Launch Post
      </Link>
    </div>
  )
}
