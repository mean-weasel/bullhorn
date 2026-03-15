'use client'
/* eslint-disable max-lines -- large page component with extracted sub-components */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Rocket, ExternalLink, AlertCircle } from 'lucide-react'
import {
  LaunchPost,
  LaunchPlatform,
  LaunchPostStatus,
  PlatformFields,
  LAUNCH_PLATFORM_INFO,
  LAUNCH_PLATFORM_URLS,
  LAUNCH_CHAR_LIMITS,
  getDefaultPlatformFields,
  useLaunchPostsStore,
} from '@/lib/launchPosts'
import { cn } from '@/lib/utils'
import {
  ProductHuntFields,
  AskHNFields,
  BetaListFieldsSection,
  IndieHackersFieldsSection,
  DevHuntFieldsSection,
} from './PlatformFieldSections'

interface LaunchPostFormProps {
  post?: LaunchPost // If provided, we're editing
  campaignId?: string // If provided, associate with campaign
}

// eslint-disable-next-line max-lines-per-function
export function LaunchPostForm({ post, campaignId }: LaunchPostFormProps) {
  const router = useRouter()
  const { addLaunchPost, updateLaunchPost } = useLaunchPostsStore()
  const titleRef = useRef<HTMLInputElement>(null)

  const isEditing = !!post

  // Form state
  const [platform, setPlatform] = useState<LaunchPlatform>(post?.platform || 'hacker_news_show')
  const [status, setStatus] = useState<LaunchPostStatus>(post?.status || 'draft')
  const [title, setTitle] = useState(post?.title || '')
  const [url, setUrl] = useState(post?.url || '')
  const [description, setDescription] = useState(post?.description || '')
  const [platformFields, setPlatformFields] = useState<PlatformFields>(
    post?.platformFields || getDefaultPlatformFields(platform)
  )
  const [scheduledAt, setScheduledAt] = useState(post?.scheduledAt || '')
  const [notes, setNotes] = useState(post?.notes || '')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Focus title on mount
  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 100)
  }, [])

  // Reset platform fields when platform changes (only if not editing)
  useEffect(() => {
    if (!isEditing) {
      setPlatformFields(getDefaultPlatformFields(platform))
    }
  }, [platform, isEditing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      if (isEditing && post) {
        await updateLaunchPost(post.id, {
          platform,
          status,
          title: title.trim(),
          url: url.trim() || null,
          description: description.trim() || null,
          platformFields,
          scheduledAt: scheduledAt || null,
          notes: notes.trim() || null,
        })
      } else {
        await addLaunchPost({
          platform,
          title: title.trim(),
          url: url.trim() || undefined,
          description: description.trim() || undefined,
          platformFields,
          campaignId: campaignId,
          scheduledAt: scheduledAt || undefined,
          notes: notes.trim() || undefined,
        })
      }
      router.push('/launch-posts')
    } catch (err) {
      setError((err as Error).message || 'Failed to save launch post')
    } finally {
      setIsSubmitting(false)
    }
  }

  const charLimits = LAUNCH_CHAR_LIMITS[platform] || {}
  const platformInfo = LAUNCH_PLATFORM_INFO[platform]
  const platformUrl = LAUNCH_PLATFORM_URLS[platform]

  // Check if platform requires URL
  const platformRequiresUrl = platform !== 'hacker_news_ask'

  // Platform-specific field helpers - use Record type for flexibility
  const updatePlatformField = (key: string, value: string) => {
    setPlatformFields((prev) => ({ ...prev, [key]: value }))
  }

  // Type-safe getters for platform fields
  const getPlatformFieldString = (key: string): string => {
    return (platformFields as Record<string, string>)[key] || ''
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent border-2 border-transparent hover:border-border transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {isEditing ? '📝 Edit Launch Post' : '🚀 New Launch Post'}
          </h1>
          <div className="h-1 w-12 gradient-bar mt-1 rounded-full" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Platform Selection */}
        <div className="bg-card border-[3px] border-border rounded-md shadow-sticker p-4 md:p-6">
          <label className="block text-sm font-bold mb-3">
            Platform <span className="text-destructive">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {(Object.entries(LAUNCH_PLATFORM_INFO) as [LaunchPlatform, typeof platformInfo][]).map(
              ([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPlatform(key)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-md text-sm transition-all',
                    'border-[3px] border-border font-medium',
                    platform === key
                      ? 'bg-primary/10 text-foreground shadow-[3px_3px_0_hsl(var(--primary)/0.3)]'
                      : 'bg-card shadow-sticker-hover hover:-translate-y-px hover:shadow-sticker-sm'
                  )}
                >
                  <span
                    className={cn(
                      'w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0',
                      info.bgColor,
                      info.color
                    )}
                  >
                    {info.icon}
                  </span>
                  <span className="truncate">{info.label}</span>
                </button>
              )
            )}
          </div>

          {/* Platform link */}
          <a
            href={platformUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ExternalLink className="w-3 h-3" />
            Open {platformInfo.name} submission page
          </a>
        </div>

        {/* Main Fields */}
        <div className="bg-card border-[3px] border-border rounded-md shadow-sticker p-4 md:p-6 space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-bold mb-2">
              Title <span className="text-destructive">*</span>
              {charLimits.title && (
                <span
                  className={cn(
                    'ml-2 text-xs font-medium',
                    title.length > charLimits.title ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {title.length}/{charLimits.title}
                </span>
              )}
            </label>
            <input
              ref={titleRef}
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                platform === 'hacker_news_show'
                  ? 'Show HN: Your product name - brief description'
                  : platform === 'hacker_news_ask'
                    ? 'Ask HN: Your question here?'
                    : 'Enter post title...'
              }
              className={cn(
                'w-full px-4 py-3 rounded-md',
                'bg-card text-foreground placeholder-muted-foreground',
                'border-[3px] border-border',
                'shadow-sticker-sm',
                'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
                'transition-all'
              )}
              required
            />
            {platform.startsWith('hacker_news') && (
              <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                {platform === 'hacker_news_show' &&
                  'Start with "Show HN:" followed by your product name'}
                {platform === 'hacker_news_ask' && 'Start with "Ask HN:" followed by your question'}
                {platform === 'hacker_news_link' && 'Keep the title factual and avoid clickbait'}
              </p>
            )}
          </div>

          {/* URL */}
          <div>
            <label htmlFor="url" className="block text-sm font-bold mb-2">
              URL {platformRequiresUrl && <span className="text-destructive">*</span>}
              {!platformRequiresUrl && (
                <span className="text-xs text-muted-foreground ml-2 font-medium">
                  (optional for Ask HN)
                </span>
              )}
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-product.com"
              className={cn(
                'w-full px-4 py-3 rounded-md',
                'bg-card text-foreground placeholder-muted-foreground',
                'border-[3px] border-border',
                'shadow-sticker-sm',
                'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
                'transition-all'
              )}
              required={platformRequiresUrl}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-bold mb-2">
              Description
              {charLimits.description && (
                <span
                  className={cn(
                    'ml-2 text-xs font-medium',
                    description.length > charLimits.description
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  )}
                >
                  {description.length}/{charLimits.description}
                </span>
              )}
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your product or what makes it unique..."
              rows={4}
              className={cn(
                'w-full px-4 py-3 rounded-md',
                'bg-card text-foreground placeholder-muted-foreground',
                'border-[3px] border-border',
                'shadow-sticker-sm',
                'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
                'resize-none transition-all'
              )}
            />
          </div>
        </div>

        {/* Platform-Specific Fields */}
        {platform === 'product_hunt' && (
          <ProductHuntFields
            platform={platform}
            getPlatformFieldString={getPlatformFieldString}
            updatePlatformField={updatePlatformField}
          />
        )}

        {platform === 'hacker_news_ask' && (
          <AskHNFields
            platform={platform}
            getPlatformFieldString={getPlatformFieldString}
            updatePlatformField={updatePlatformField}
          />
        )}

        {platform === 'beta_list' && (
          <BetaListFieldsSection
            platform={platform}
            getPlatformFieldString={getPlatformFieldString}
            updatePlatformField={updatePlatformField}
          />
        )}

        {platform === 'indie_hackers' && (
          <IndieHackersFieldsSection
            platform={platform}
            getPlatformFieldString={getPlatformFieldString}
            updatePlatformField={updatePlatformField}
          />
        )}

        {platform === 'dev_hunt' && (
          <DevHuntFieldsSection
            platform={platform}
            getPlatformFieldString={getPlatformFieldString}
            updatePlatformField={updatePlatformField}
          />
        )}

        {/* Status & Scheduling */}
        <div className="bg-card border-[3px] border-border rounded-md shadow-sticker p-4 md:p-6 space-y-4">
          <h3 className="font-bold text-sm">📅 Status & Scheduling</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-bold mb-2">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as LaunchPostStatus)}
                className="w-full px-4 py-3 rounded-md bg-card border-[3px] border-border shadow-sticker-sm text-sm font-medium"
              >
                <option value="draft">📝 Draft</option>
                <option value="scheduled">📅 Scheduled</option>
                <option value="posted">✅ Posted</option>
              </select>
            </div>

            {/* Scheduled Date */}
            <div>
              <label htmlFor="scheduledAt" className="block text-sm font-bold mb-2">
                Scheduled Date
              </label>
              <input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt ? scheduledAt.slice(0, 16) : ''}
                onChange={(e) =>
                  setScheduledAt(e.target.value ? new Date(e.target.value).toISOString() : '')
                }
                className="w-full px-4 py-3 rounded-md bg-card border-[3px] border-border shadow-sticker-sm text-sm"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-card border-[3px] border-border rounded-md shadow-sticker p-4 md:p-6">
          <label htmlFor="notes" className="block text-sm font-bold mb-2">
            📝 Internal Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any internal notes or reminders..."
            rows={3}
            className={cn(
              'w-full px-4 py-3 rounded-md',
              'bg-card text-foreground placeholder-muted-foreground',
              'border-[3px] border-border',
              'shadow-sticker-sm',
              'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
              'resize-none transition-all'
            )}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-md bg-destructive/10 text-destructive border-2 border-destructive/30 font-medium">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className={cn(
              'px-4 py-2.5 rounded-md',
              'bg-secondary text-secondary-foreground font-bold text-sm',
              'border-[3px] border-border',
              'shadow-sticker-sm',
              'hover:-translate-y-px hover:shadow-sticker',
              'transition-all'
            )}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className={cn(
              'flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-md',
              'bg-sticker-green text-white font-bold text-sm',
              'border-[3px] border-border',
              'shadow-sticker-sm',
              'hover:-translate-y-px hover:shadow-sticker',
              'active:translate-y-px active:shadow-sticker-hover',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
              'transition-all'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                {isEditing ? 'Save Changes' : 'Create Launch Post'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
