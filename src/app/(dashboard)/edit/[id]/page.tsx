'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Calendar,
  Image,
  Send,
  Save,
  Check,
  Trash2,
  X,
  Plus,
  Copy,
  CheckCircle,
  Archive,
  RotateCcw,
  StickyNote,
  ChevronDown,
  ChevronUp,
  Link,
  FolderOpen,
} from 'lucide-react'
import { usePostsStore } from '@/lib/storage'
import { useCampaignsStore } from '@/lib/campaigns'
import {
  Post,
  Platform,
  createPost,
  CHAR_LIMITS,
  PLATFORM_INFO,
  LinkedInContent,
  RedditContent,
  isTwitterContent,
  isLinkedInContent,
  isRedditContent,
} from '@/lib/posts'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AutoSaveIndicator } from '@/components/ui/AutoSaveIndicator'
import { MediaUpload } from '@/components/ui/MediaUpload'
import { IOSDateTimePicker } from '@/components/ui/IOSDateTimePicker'
import { getMediaUrl } from '@/lib/media'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

// Platform icons
const PlatformIcon = ({ platform }: { platform: Platform }) => {
  if (platform === 'twitter') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  }
  if (platform === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249z" />
    </svg>
  )
}

export default function EditorPage() {
  const params = useParams()
  const id = params.id as string | undefined
  const searchParams = useSearchParams()
  const router = useRouter()
  const { addPost, updatePost, deletePost, archivePost, restorePost, getPost, fetchPosts, initialized: postsInitialized } = usePostsStore()
  const { campaigns, fetchCampaigns, initialized: campaignsInitialized } = useCampaignsStore()

  const isNew = !id
  const existingPost = id ? getPost(id) : undefined
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showPlatformSwitchConfirm, setShowPlatformSwitchConfirm] = useState(false)
  const [pendingPlatform, setPendingPlatform] = useState<Platform | null>(null)
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false)

  // Fetch posts on mount if not initialized (needed for direct navigation to /edit/:id)
  useEffect(() => {
    if (!postsInitialized) {
      fetchPosts()
    }
  }, [postsInitialized, fetchPosts])

  // Fetch campaigns on mount
  useEffect(() => {
    if (!campaignsInitialized) {
      fetchCampaigns()
    }
  }, [campaignsInitialized, fetchCampaigns])

  // Form state
  const [post, setPost] = useState<Post>(() => {
    if (existingPost) return existingPost
    const newPost = createPost()
    const dateParam = searchParams.get('date')
    if (dateParam) {
      newPost.scheduledAt = `${dateParam}T12:00:00.000Z`
    }
    // Handle campaign from URL param
    const campaignParam = searchParams.get('campaign')
    if (campaignParam) {
      newPost.campaignId = campaignParam
    }
    return newPost
  })
  const [content, setContent] = useState('')
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [linkedInMediaUrl, setLinkedInMediaUrl] = useState('')
  const [redditUrl, setRedditUrl] = useState('')
  const [showMediaInput, setShowMediaInput] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showPublishedLinks, setShowPublishedLinks] = useState(false)
  const [newSubreddit, setNewSubreddit] = useState('')
  const [subredditsInput, setSubredditsInput] = useState<string[]>([])  // Multi-subreddit UI input
  const [subredditSchedules, setSubredditSchedules] = useState<Record<string, string>>({})  // Per-subreddit scheduledAt ISO strings
  const [subredditTitles, setSubredditTitles] = useState<Record<string, string>>({})  // Per-subreddit titles
  const [expandedSubreddits, setExpandedSubreddits] = useState<Record<string, boolean>>({})  // Track which cards are expanded

  // Helper functions for subreddit card management
  const toggleSubredditExpanded = (subreddit: string) => {
    setExpandedSubreddits(prev => ({
      ...prev,
      [subreddit]: !prev[subreddit]
    }))
  }

  const updateSubredditTitle = (subreddit: string, title: string) => {
    setSubredditTitles(prev => ({ ...prev, [subreddit]: title }))
  }

  const updateSubredditSchedule = (subreddit: string, isoString: string | null) => {
    if (isoString === null) {
      setSubredditSchedules(prev => {
        const next = { ...prev }
        delete next[subreddit]
        return next
      })
    } else {
      setSubredditSchedules(prev => ({ ...prev, [subreddit]: isoString }))
    }
  }

  const removeSubreddit = (subreddit: string) => {
    setSubredditsInput(prev => prev.filter(s => s !== subreddit))
    setSubredditTitles(prev => {
      const next = { ...prev }
      delete next[subreddit]
      return next
    })
    setSubredditSchedules(prev => {
      const next = { ...prev }
      delete next[subreddit]
      return next
    })
    setExpandedSubreddits(prev => {
      const next = { ...prev }
      delete next[subreddit]
      return next
    })
  }

  // Track if form has unsaved changes
  const initialContentRef = useRef('')
  const [isDirty, setIsDirty] = useState(false)

  // Update dirty state when content changes
  useEffect(() => {
    const currentContent = JSON.stringify({ content, mediaUrls, linkedInMediaUrl, redditUrl, platform: post.platform, notes: post.notes })
    if (initialContentRef.current && currentContent !== initialContentRef.current) {
      setIsDirty(true)
    }
  }, [content, mediaUrls, linkedInMediaUrl, redditUrl, post.platform, post.notes])

  // Warn about unsaved changes on browser close/refresh
  useUnsavedChanges({ isDirty })

  // Auto-save (only for drafts or new posts)
  // Disable auto-save for new posts with multiple subreddits (those need explicit save to create multiple posts)
  const hasMultipleSubreddits = post.platform === 'reddit' && subredditsInput.length > 1

  // Check if scheduling is valid (used to disable Schedule button)
  // For Reddit with multiple subreddits: each subreddit must have a schedule OR a fallback main schedule
  const canSchedule = hasMultipleSubreddits
    ? subredditsInput.every(sub => subredditSchedules[sub]) || !!post.scheduledAt
    : !!post.scheduledAt
  const { status: autoSaveStatus } = useAutoSave({
    data: { post, content, mediaUrls, linkedInMediaUrl, redditUrl },
    onSave: async () => {
      // Silently save without navigating
      const toSave = { ...post, status: 'draft' as const }
      try {
        if (isNew) {
          const created = await addPost(toSave)
          // Navigate to edit URL so subsequent auto-saves update instead of create
          router.replace(`/edit/${created.id}`)
        } else {
          await updatePost(toSave.id, toSave)
        }
        setIsDirty(false) // Reset dirty after auto-save
      } catch (error) {
        // Silently fail auto-save - user can still manually save
        console.error('Auto-save failed:', error)
      }
    },
    delay: 2000,
    enabled: (post.status === 'draft' || isNew) && !(isNew && hasMultipleSubreddits),
    skipInitialChange: !isNew, // Skip first change for existing posts (async data loading)
  })

  // Load existing post data into form
  useEffect(() => {
    if (existingPost) {
      setPost(existingPost)
      // Set content based on platform type
      let text = ''
      if (isTwitterContent(existingPost.content)) {
        text = existingPost.content.text
        setMediaUrls(existingPost.content.mediaUrls || [])
      } else if (isLinkedInContent(existingPost.content)) {
        text = existingPost.content.text
        setLinkedInMediaUrl(existingPost.content.mediaUrl || '')
      } else if (isRedditContent(existingPost.content)) {
        text = existingPost.content.body || ''
        setRedditUrl(existingPost.content.url || '')
        // Load subreddits and titles (singular in data model)
        const subreddit = existingPost.content.subreddit
        setSubredditsInput([subreddit])
        // Initialize title for this subreddit
        if (existingPost.content.title) {
          setSubredditTitles({ [subreddit]: existingPost.content.title })
        }
        // Initialize schedule for this subreddit from post.scheduledAt
        if (existingPost.scheduledAt) {
          setSubredditSchedules({ [subreddit]: existingPost.scheduledAt })
        }
        // Auto-expand the card when editing
        setExpandedSubreddits({ [subreddit]: true })
      }
      setContent(text)
      // Set initial content reference for dirty tracking
      const loadedMediaUrls = isTwitterContent(existingPost.content) ? existingPost.content.mediaUrls || [] : []
      const loadedLinkedInMedia = isLinkedInContent(existingPost.content) ? existingPost.content.mediaUrl || '' : ''
      const loadedRedditUrl = isRedditContent(existingPost.content) ? existingPost.content.url || '' : ''
      initialContentRef.current = JSON.stringify({
        content: text,
        mediaUrls: loadedMediaUrls,
        linkedInMediaUrl: loadedLinkedInMedia,
        redditUrl: loadedRedditUrl,
        platform: existingPost.platform,
        notes: existingPost.notes || '',
      })
      // Expand notes if they exist
      if (existingPost.notes) {
        setShowNotes(true)
      }
      // Expand published links if any exist
      const hasLaunchedUrls =
        (isTwitterContent(existingPost.content) && existingPost.content.launchedUrl) ||
        (isLinkedInContent(existingPost.content) && existingPost.content.launchedUrl) ||
        (isRedditContent(existingPost.content) && existingPost.content.launchedUrl)
      if (hasLaunchedUrls) {
        setShowPublishedLinks(true)
      }
    } else {
      // New post - set initial state
      initialContentRef.current = JSON.stringify({
        content: '',
        mediaUrls: [],
        linkedInMediaUrl: '',
        redditUrl: '',
        platform: 'twitter',
        notes: '',
      })
    }
  }, [existingPost])

  // Handle save
  const handleSave = async (postToSave: Post) => {
    setIsSaving(true)
    setIsDirty(false) // Clear dirty state before navigation
    try {
      // Handle Reddit posts with multiple subreddits (cross-posting)
      if (isNew && postToSave.platform === 'reddit' && subredditsInput.length > 1) {
        // Create multiple posts, one per subreddit, with shared groupId
        const groupId = crypto.randomUUID()
        const redditContent = postToSave.content as { subreddit: string; title: string; body?: string; url?: string; flairText?: string }

        for (const subreddit of subredditsInput) {
          // Use per-subreddit schedule and title if set, otherwise fall back to defaults
          const subredditScheduledAt = subredditSchedules[subreddit] || postToSave.scheduledAt
          const subredditTitle = subredditTitles[subreddit] || ''
          const postForSubreddit: Post = {
            ...postToSave,
            id: crypto.randomUUID(),
            groupId,
            groupType: 'reddit-crosspost',
            scheduledAt: subredditScheduledAt,
            content: {
              ...redditContent,
              subreddit,
              title: subredditTitle,
            },
          }
          await addPost(postForSubreddit)
        }
      } else if (isNew) {
        // Single post
        const finalPost = { ...postToSave }
        if (finalPost.platform === 'reddit' && subredditsInput.length === 1) {
          const subreddit = subredditsInput[0]
          const redditContent = finalPost.content as { subreddit: string; title: string; body?: string; url?: string; flairText?: string }
          finalPost.content = {
            ...redditContent,
            subreddit,
            title: subredditTitles[subreddit] || redditContent.title || '',
          }
        }
        await addPost(finalPost)
      } else {
        // Updating existing post
        const finalPost = { ...postToSave }
        if (finalPost.platform === 'reddit' && subredditsInput.length >= 1) {
          const subreddit = subredditsInput[0]
          const redditContent = finalPost.content as { subreddit: string; title: string; body?: string; url?: string; flairText?: string }
          finalPost.content = {
            ...redditContent,
            subreddit,
            title: subredditTitles[subreddit] || redditContent.title || '',
          }
        }
        await updatePost(finalPost.id, finalPost)
      }
      router.push('/')
    } catch (error) {
      toast.error('Failed to save post')
      setIsDirty(true)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle delete
  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (id) {
      try {
        await deletePost(id)
        toast.success('Post deleted')
        router.push('/')
      } catch (error) {
        toast.error('Failed to delete post')
      }
    }
  }

  // Handle archive
  const handleArchive = () => {
    setShowArchiveConfirm(true)
  }

  const confirmArchive = async () => {
    if (id) {
      try {
        await archivePost(id)
        toast.success('Post archived')
        router.push('/')
      } catch (error) {
        toast.error('Failed to archive post')
      }
    }
  }

  // Handle restore
  const handleRestore = async () => {
    if (id) {
      try {
        await restorePost(id)
        toast.success('Post restored to drafts')
        router.push('/')
      } catch (error) {
        toast.error('Failed to restore post')
      }
    }
  }

  // Set platform (single selection)
  const setPlatform = (platform: Platform) => {
    // Check if there's content that would be lost
    const hasContent = content.trim().length > 0 ||
      mediaUrls.length > 0 ||
      linkedInMediaUrl ||
      redditUrl ||
      subredditsInput.length > 0

    if (hasContent && platform !== post.platform) {
      // Show confirmation dialog
      setPendingPlatform(platform)
      setShowPlatformSwitchConfirm(true)
      return
    }

    // No content to lose, switch immediately
    executePlatformSwitch(platform)
  }

  // Execute the actual platform switch
  const executePlatformSwitch = (platform: Platform) => {
    setPost((prev) => ({
      ...prev,
      platform,
    }))
    // Reset subreddit inputs when switching away from Reddit
    if (platform !== 'reddit') {
      setSubredditsInput([])
      setSubredditTitles({})
      setSubredditSchedules({})
      setExpandedSubreddits({})
    }
    // Reset pending platform
    setPendingPlatform(null)
  }

  // Confirm platform switch (called from dialog)
  const confirmPlatformSwitch = () => {
    if (pendingPlatform) {
      executePlatformSwitch(pendingPlatform)
    }
    setShowPlatformSwitchConfirm(false)
  }

  // Update content for the selected platform
  useEffect(() => {
    setPost((prev) => {
      let newContent = prev.content
      const platform = prev.platform

      if (platform === 'twitter') {
        const existingContent = prev.content as { launchedUrl?: string }
        newContent = {
          text: content,
          ...(mediaUrls.length > 0 && { mediaUrls }),
          ...(existingContent?.launchedUrl && { launchedUrl: existingContent.launchedUrl })
        }
      } else if (platform === 'linkedin') {
        const existingContent = prev.content as { visibility?: 'public' | 'connections'; launchedUrl?: string }
        newContent = {
          text: content,
          visibility: existingContent?.visibility || 'public',
          ...(linkedInMediaUrl && { mediaUrl: linkedInMediaUrl }),
          ...(existingContent?.launchedUrl && { launchedUrl: existingContent.launchedUrl })
        }
      } else if (platform === 'reddit') {
        const existingContent = prev.content as { subreddit?: string; title?: string; launchedUrl?: string }
        newContent = {
          subreddit: existingContent?.subreddit || '',  // Will be set properly at save time
          title: existingContent?.title || '',
          body: content,
          ...(redditUrl && { url: redditUrl }),
          ...(existingContent?.launchedUrl && { launchedUrl: existingContent.launchedUrl })
        }
      }

      return { ...prev, content: newContent }
    })
  }, [content, mediaUrls, linkedInMediaUrl, redditUrl])

  // Save as draft
  const handleSaveDraft = () => {
    const toSave = { ...post, status: 'draft' as const }
    handleSave(toSave)
    toast.success('Draft saved')
  }

  // Schedule
  const handleSchedule = () => {
    // Check if scheduling is valid:
    // - For Reddit with multiple subreddits: each subreddit must have its own schedule
    // - Otherwise: main post.scheduledAt must be set
    const isRedditMulti = post.platform === 'reddit' && subredditsInput.length > 1
    const allSubredditsHaveSchedule = isRedditMulti &&
      subredditsInput.every(sub => subredditSchedules[sub])

    if (!post.scheduledAt && !allSubredditsHaveSchedule) {
      toast.error('Please select a date and time')
      return
    }
    const toSave = { ...post, status: 'scheduled' as const }
    handleSave(toSave)
    toast.success('Post scheduled')
  }

  // Publish Now - schedules for immediate publishing (reminder)
  const handlePublishNow = () => {
    if (!content.trim()) {
      toast.error('Please add some content')
      return
    }
    const toSave = {
      ...post,
      status: 'scheduled' as const,
      scheduledAt: new Date().toISOString(), // Schedule for now (triggers immediate notification)
    }
    handleSave(toSave)
    toast.success('Ready to publish!')
  }

  // Copy content to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Copied to clipboard')
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Copied to clipboard')
    }
  }

  // Mark as posted (published)
  const handleMarkAsPosted = () => {
    const toSave = {
      ...post,
      status: 'published' as const,
      publishResult: {
        success: true,
        publishedAt: new Date().toISOString(),
      },
    }
    handleSave(toSave)
    toast.success('Marked as posted')
  }

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 's',
        ctrl: true,
        handler: handleSaveDraft,
      },
      {
        key: 'Enter',
        ctrl: true,
        handler: handleSchedule,
      },
      {
        key: 'Escape',
        handler: () => {
          if (!isDirty || window.confirm('You have unsaved changes. Leave anyway?')) {
            setIsDirty(false)
            router.push('/')
          }
        },
      },
    ],
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] min-h-[calc(100vh-4rem)]">
      {/* Editor */}
      <div className="p-4 md:p-8 max-w-2xl animate-slide-up">
        <div className="mb-4 md:mb-6">
          <div className="flex items-center gap-3 mb-1 md:mb-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">
              {isNew ? 'Create Post' : 'Edit Post'}
            </h1>
            <AutoSaveIndicator status={autoSaveStatus} />
          </div>
          <p className="text-sm md:text-base text-muted-foreground">
            Compose your message and schedule it across multiple platforms.
          </p>
          <div className="h-1 w-16 bg-gradient-to-r from-[hsl(var(--gold))] to-transparent mt-2 rounded-full" />
        </div>

        {/* Platform selector (single selection) */}
        <div className="flex flex-wrap gap-2 mb-4 md:mb-6">
          {(['twitter', 'linkedin', 'reddit'] as Platform[]).map((platform) => {
            const isActive = post.platform === platform
            const info = PLATFORM_INFO[platform]
            return (
              <button
                key={platform}
                onClick={() => setPlatform(platform)}
                className={cn(
                  'flex items-center gap-2 px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 transition-all',
                  'font-medium text-sm min-h-[44px]', // 44px minimum touch target
                  isActive
                    ? platform === 'twitter'
                      ? 'border-twitter bg-twitter-soft text-twitter'
                      : platform === 'linkedin'
                        ? 'border-linkedin bg-linkedin-soft text-linkedin'
                        : 'border-reddit bg-reddit-soft text-reddit'
                    : 'border-border bg-card text-muted-foreground hover:border-border hover:bg-accent'
                )}
              >
                <PlatformIcon platform={platform} />
                <span className="hidden sm:inline">{info.name.split(' ')[0]}</span>
                {isActive && <Check className="w-4 h-4 sm:ml-1" />}
              </button>
            )
          })}
        </div>

        {/* Campaign selector */}
        <div className="mb-4 md:mb-6 relative">
          <button
            onClick={() => setShowCampaignDropdown(!showCampaignDropdown)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all w-full',
              post.campaignId
                ? 'border-[hsl(var(--gold))]/30 bg-[hsl(var(--gold))]/5'
                : 'border-border bg-card hover:border-[hsl(var(--gold))]/30'
            )}
          >
            <FolderOpen className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
            <span className="text-sm font-medium flex-1 text-left truncate">
              {post.campaignId
                ? campaigns.find((c) => c.id === post.campaignId)?.name || 'Unknown Campaign'
                : 'No Campaign'}
            </span>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', showCampaignDropdown && 'rotate-180')} />
          </button>
          {showCampaignDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowCampaignDropdown(false)} />
              <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-lg py-1 max-h-[200px] overflow-y-auto">
                <button
                  onClick={() => {
                    setPost((prev) => ({ ...prev, campaignId: undefined }))
                    setShowCampaignDropdown(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-left',
                    !post.campaignId && 'bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold-dark))]'
                  )}
                >
                  <X className="w-4 h-4" />
                  No Campaign
                </button>
                {campaigns.filter((c) => c.status !== 'archived').map((campaign) => (
                  <button
                    key={campaign.id}
                    onClick={() => {
                      setPost((prev) => ({ ...prev, campaignId: campaign.id }))
                      setShowCampaignDropdown(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-left',
                      post.campaignId === campaign.id && 'bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold-dark))]'
                    )}
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span className="truncate">{campaign.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Notes section (collapsible) */}
        <div className="mb-4 md:mb-6">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
              showNotes || post.notes
                ? 'border-[hsl(var(--gold))]/30 bg-[hsl(var(--gold))]/5'
                : 'border-border bg-card hover:border-[hsl(var(--gold))]/30'
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <StickyNote className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
              <span>Notes</span>
              {post.notes && !showNotes && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  — {post.notes}
                </span>
              )}
            </div>
            {showNotes ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {showNotes && (
            <div className="mt-2 animate-slide-up">
              <textarea
                value={post.notes || ''}
                onChange={(e) =>
                  setPost((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Add notes about this post (e.g., context, hashtags to use, posting strategy)..."
                className={cn(
                  'w-full min-h-[100px] p-3 md:p-4 rounded-xl',
                  'bg-card border border-[hsl(var(--gold))]/20',
                  'text-sm leading-relaxed',
                  'placeholder:text-muted-foreground',
                  'focus:outline-none focus:border-[hsl(var(--gold))] focus:ring-4 focus:ring-[hsl(var(--gold))]/10',
                  'resize-y transition-all'
                )}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Notes are private and won't be published. Use them to track ideas or instructions.
              </p>
            </div>
          )}
        </div>

        {/* Content textarea */}
        <div className="mb-4 md:mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? Share your thoughts, announce something exciting, or start a conversation..."
            className={cn(
              'w-full min-h-[150px] md:min-h-[200px] p-3 md:p-4 rounded-xl',
              'bg-card border border-border',
              'text-base leading-relaxed',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10',
              'resize-y transition-all'
            )}
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-4">
              {(() => {
                const platform = post.platform
                const limit = CHAR_LIMITS[platform]
                const len = content.length
                const pct = (len / limit) * 100
                return (
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        platform === 'twitter' && 'bg-twitter',
                        platform === 'linkedin' && 'bg-linkedin',
                        platform === 'reddit' && 'bg-reddit'
                      )}
                    />
                    <span
                      className={cn(
                        'font-mono font-medium',
                        pct > 100 ? 'text-destructive' : pct > 90 ? 'text-yellow-500' : 'text-muted-foreground'
                      )}
                    >
                      {len}
                    </span>
                    <span className="text-muted-foreground">/ {limit}</span>
                  </div>
                )
              })()}
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleCopy}
                disabled={!content.trim()}
                className={cn(
                  'p-2 rounded-md transition-colors',
                  copied
                    ? 'bg-green-500/10 text-green-500'
                    : 'hover:bg-accent text-muted-foreground hover:text-foreground',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                title={copied ? 'Copied!' : 'Copy to clipboard'}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowMediaInput(!showMediaInput)}
                className={cn(
                  'flex items-center p-2 rounded-md transition-colors',
                  showMediaInput || mediaUrls.length > 0 || linkedInMediaUrl
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                )}
                title="Add media (images/videos)"
              >
                <Image className="w-4 h-4" />
                {(mediaUrls.length > 0 || linkedInMediaUrl) && (
                  <span className="ml-1 text-xs">{mediaUrls.length + (linkedInMediaUrl ? 1 : 0)}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Media URLs section */}
        {showMediaInput && (post.platform === 'twitter' || post.platform === 'linkedin') && (
          <div className="mb-6 p-4 rounded-xl border border-border bg-accent/30 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-foreground text-xs font-medium">
                <Image className="w-4 h-4" />
                Media Attachments
              </div>
              <button
                onClick={() => setShowMediaInput(false)}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Twitter Media */}
            {post.platform === 'twitter' && (
              <div className="mb-4">
                <div className="flex items-center gap-2 text-twitter text-xs font-medium mb-2">
                  <span className="w-2 h-2 rounded-full bg-twitter" />
                  Twitter (up to 4 images or 1 video)
                </div>
                <MediaUpload
                  platform="twitter"
                  maxFiles={4}
                  existingMedia={mediaUrls}
                  onMediaChange={setMediaUrls}
                />
              </div>
            )}

            {/* LinkedIn Media */}
            {post.platform === 'linkedin' && (
              <div>
                <div className="flex items-center gap-2 text-linkedin text-xs font-medium mb-2">
                  <span className="w-2 h-2 rounded-full bg-linkedin" />
                  LinkedIn (1 image or video)
                </div>
                <MediaUpload
                  platform="linkedin"
                  maxFiles={1}
                  existingMedia={linkedInMediaUrl ? [linkedInMediaUrl] : []}
                  onMediaChange={(media) => setLinkedInMediaUrl(media[0] || '')}
                />
              </div>
            )}
          </div>
        )}

        {/* LinkedIn-specific fields */}
        {post.platform === 'linkedin' && (
          <div className="mb-6 p-4 rounded-xl border border-linkedin/30 bg-linkedin-soft/30 animate-slide-up">
            <div className="flex items-center gap-2 text-linkedin text-xs font-medium mb-3">
              <span className="w-2 h-2 rounded-full bg-linkedin" />
              LinkedIn Settings
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Visibility
              </label>
              <div className="flex gap-2">
                {(['public', 'connections'] as const).map((vis) => (
                  <button
                    key={vis}
                    type="button"
                    onClick={() =>
                      setPost((prev) => ({
                        ...prev,
                        content: {
                          ...(prev.content as LinkedInContent),
                          visibility: vis,
                        },
                      }))
                    }
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all',
                      isLinkedInContent(post.content) && post.content.visibility === vis
                        ? 'border-linkedin bg-linkedin/10 text-linkedin'
                        : 'border-border bg-background text-muted-foreground hover:border-linkedin/50'
                    )}
                  >
                    {vis === 'public' ? 'Public' : 'Connections Only'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reddit-specific fields */}
        {post.platform === 'reddit' && (
          <div className="mb-6 p-4 rounded-xl border border-reddit/30 bg-reddit-soft/30 space-y-4 animate-slide-up">
            <div className="flex items-center gap-2 text-reddit text-xs font-medium mb-1">
              <span className="w-2 h-2 rounded-full bg-reddit" />
              Reddit Settings
            </div>
            {/* Subreddits - multi-select tags */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Subreddits {subredditsInput.length > 0 && (
                  <span className="text-reddit">({subredditsInput.length})</span>
                )}
              </label>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-2.5 rounded-l-lg bg-muted border border-r-0 border-border text-muted-foreground text-sm">
                  r/
                </span>
                <input
                  type="text"
                  value={newSubreddit}
                  onChange={(e) => setNewSubreddit(e.target.value.replace(/^r\//, ''))}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ',') && newSubreddit.trim()) {
                      e.preventDefault()
                      const sub = newSubreddit.trim().replace(/^r\//, '')
                      if (sub && !subredditsInput.includes(sub)) {
                        setSubredditsInput((prev) => [...prev, sub])
                      }
                      setNewSubreddit('')
                    }
                  }}
                  placeholder="Type subreddit, press Enter"
                  className="flex-1 px-4 py-2.5 rounded-r-lg bg-background border border-border focus:outline-none focus:border-reddit"
                />
                <button
                  type="button"
                  onClick={() => {
                    const sub = newSubreddit.trim().replace(/^r\//, '')
                    if (sub && !subredditsInput.includes(sub)) {
                      setSubredditsInput((prev) => [...prev, sub])
                    }
                    setNewSubreddit('')
                  }}
                  disabled={!newSubreddit.trim()}
                  className="p-2.5 rounded-lg bg-reddit text-white hover:bg-reddit/90 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Add subreddits to cross-post. Each gets its own title and schedule.
              </p>
            </div>

            {/* Collapsible cards for each subreddit */}
            {subredditsInput.length > 0 && (
              <div className="space-y-3">
                {subredditsInput.map((sub) => {
                  const isExpanded = !!expandedSubreddits[sub]
                  const title = subredditTitles[sub] || ''
                  const schedule = subredditSchedules[sub]
                  const schedulePreview = schedule
                    ? format(new Date(schedule), 'MMM d, h:mm a')
                    : 'No schedule'

                  return (
                    <div key={sub} data-testid={`subreddit-card-${sub}`}>
                      {/* Card Header */}
                      <div
                        className={cn(
                          'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
                          isExpanded
                            ? 'border-reddit/30 bg-reddit/5'
                            : 'border-border bg-card hover:border-reddit/30'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSubredditExpanded(sub)}
                          className="flex items-center gap-2 text-sm font-medium flex-1 min-w-0 text-left"
                          data-testid={`subreddit-toggle-${sub}`}
                        >
                          <span className="text-reddit font-semibold">r/{sub}</span>
                          {!isExpanded && (
                            <span className="text-xs text-muted-foreground truncate">
                              — {title || 'No title'} • {schedulePreview}
                            </span>
                          )}
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => removeSubreddit(sub)}
                            className="p-1 rounded-full hover:bg-reddit/20 text-muted-foreground hover:text-reddit transition-colors"
                            aria-label="Remove subreddit"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSubredditExpanded(sub)}
                            className="p-1"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Card Body */}
                      {isExpanded && (
                        <div className="mt-2 p-4 rounded-xl border border-reddit/20 bg-background/50 space-y-4 animate-slide-up">
                          {/* Title Input */}
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                              Post Title
                            </label>
                            <input
                              type="text"
                              value={title}
                              onChange={(e) => updateSubredditTitle(sub, e.target.value)}
                              placeholder={`Title for r/${sub}`}
                              data-testid={`subreddit-title-${sub}`}
                              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:outline-none focus:border-reddit"
                            />
                            <p className="text-xs text-muted-foreground mt-1.5">
                              {title.length} / 300 characters
                            </p>
                          </div>

                          {/* Schedule Inputs */}
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                              Schedule (optional)
                            </label>
                            <div className="flex items-center gap-2">
                              <IOSDateTimePicker
                                value={schedule ? new Date(schedule) : null}
                                onChange={(date) => updateSubredditSchedule(sub, date?.toISOString() || null)}
                                mode="date"
                                placeholder="Date"
                                className="flex-1"
                                data-testid={`subreddit-date-${sub}`}
                              />
                              <IOSDateTimePicker
                                value={schedule ? new Date(schedule) : null}
                                onChange={(date) => updateSubredditSchedule(sub, date?.toISOString() || null)}
                                mode="time"
                                placeholder="Time"
                                className="w-[120px]"
                                data-testid={`subreddit-time-${sub}`}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              Leave blank to use the default schedule above.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Flair (optional)
              </label>
              <input
                type="text"
                value={(isRedditContent(post.content) && post.content.flairText) || ''}
                onChange={(e) =>
                  setPost((prev) => ({
                    ...prev,
                    content: {
                      ...(prev.content as RedditContent),
                      flairText: e.target.value,
                    },
                  }))
                }
                placeholder="e.g., Show and Tell"
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:outline-none focus:border-reddit"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Link URL (optional)
              </label>
              <input
                type="url"
                value={redditUrl}
                onChange={(e) => setRedditUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or any URL"
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:outline-none focus:border-reddit"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Add a URL for link posts (YouTube, articles, etc.). Leave empty for text posts.
              </p>
            </div>
          </div>
        )}

        {/* Published Links section (collapsible) */}
        {true /* platform is always set */ && (
          <div className="mb-4 md:mb-6">
            <button
              onClick={() => setShowPublishedLinks(!showPublishedLinks)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
                showPublishedLinks ||
                  (isTwitterContent(post.content) && post.content.launchedUrl) ||
                  (isLinkedInContent(post.content) && post.content.launchedUrl) ||
                  (isRedditContent(post.content) && post.content.launchedUrl)
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-card hover:border-primary/30'
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Link className="w-4 h-4 text-primary" />
                <span>Published Links</span>
                {(() => {
                  const hasLaunchedUrl =
                    (isTwitterContent(post.content) && post.content.launchedUrl) ||
                    (isLinkedInContent(post.content) && post.content.launchedUrl) ||
                    (isRedditContent(post.content) && post.content.launchedUrl)
                  return hasLaunchedUrl ? (
                    <span className="text-xs text-primary">(1)</span>
                  ) : null
                })()}
              </div>
              {showPublishedLinks ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {showPublishedLinks && (
              <div className="mt-2 space-y-3 animate-slide-up">
                {/* Twitter launched URL */}
                {post.platform === 'twitter' && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <span className="w-2 h-2 rounded-full bg-twitter" />
                      <span className="text-sm font-medium text-twitter">Twitter</span>
                    </div>
                    <input
                      type="url"
                      value={(isTwitterContent(post.content) && post.content.launchedUrl) || ''}
                      onChange={(e) =>
                        setPost((prev) => ({
                          ...prev,
                          content: {
                            ...(prev.content as { text: string }),
                            launchedUrl: e.target.value,
                          },
                        }))
                      }
                      placeholder="https://twitter.com/user/status/..."
                      className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-twitter"
                    />
                  </div>
                )}

                {/* LinkedIn launched URL */}
                {post.platform === 'linkedin' && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <span className="w-2 h-2 rounded-full bg-linkedin" />
                      <span className="text-sm font-medium text-linkedin">LinkedIn</span>
                    </div>
                    <input
                      type="url"
                      value={(isLinkedInContent(post.content) && post.content.launchedUrl) || ''}
                      onChange={(e) =>
                        setPost((prev) => ({
                          ...prev,
                          content: {
                            ...(prev.content as LinkedInContent),
                            launchedUrl: e.target.value,
                          },
                        }))
                      }
                      placeholder="https://linkedin.com/posts/..."
                      className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-linkedin"
                    />
                  </div>
                )}

                {/* Reddit launched URL (singular per post now) */}
                {post.platform === 'reddit' &&
                  (!subredditsInput.length ? (
                    <p className="text-sm text-muted-foreground italic p-3 rounded-lg bg-card border border-border">
                      Add subreddits above to track published links.
                    </p>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <span className="w-2 h-2 rounded-full bg-reddit" />
                        <span className="text-sm font-medium text-reddit">
                          {subredditsInput.length === 1
                            ? `r/${subredditsInput[0]}`
                            : `Reddit (${subredditsInput.length})`}
                        </span>
                      </div>
                      <input
                        type="url"
                        value={(isRedditContent(post.content) && post.content.launchedUrl) || ''}
                        onChange={(e) =>
                          setPost((prev) => ({
                            ...prev,
                            content: {
                              ...(prev.content as RedditContent),
                              launchedUrl: e.target.value,
                            },
                          }))
                        }
                        placeholder="https://reddit.com/r/..."
                        className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-reddit"
                      />
                    </div>
                  ))}

                <p className="text-xs text-muted-foreground px-1">
                  Add URLs after publishing to track where your content was posted.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Schedule */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Schedule Date
            </label>
            <IOSDateTimePicker
              value={post.scheduledAt ? new Date(post.scheduledAt) : null}
              onChange={(date) =>
                setPost((prev) => ({
                  ...prev,
                  scheduledAt: date ? date.toISOString() : null,
                }))
              }
              mode="date"
              placeholder="Select date"
              data-testid="main-schedule-date"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Time
            </label>
            <IOSDateTimePicker
              value={post.scheduledAt ? new Date(post.scheduledAt) : null}
              onChange={(date) =>
                setPost((prev) => ({
                  ...prev,
                  scheduledAt: date ? date.toISOString() : null,
                }))
              }
              mode="time"
              placeholder="Select time"
              data-testid="main-schedule-time"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 md:gap-3 pt-4 md:pt-6 border-t border-border overflow-x-auto pb-2 -mb-2 md:overflow-visible md:flex-wrap">
          {/* Archive button for non-archived posts */}
          {!isNew && post.status !== 'archived' && (
            <button
              onClick={handleArchive}
              disabled={isSaving}
              className={cn(
                'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
                'text-muted-foreground hover:bg-accent',
                'font-medium text-sm',
                'transition-colors',
                'disabled:opacity-50',
                'flex-shrink-0'
              )}
            >
              <Archive className="w-4 h-4" />
              <span className="hidden sm:inline">Archive</span>
            </button>
          )}
          {/* Restore and Delete buttons for archived posts */}
          {!isNew && post.status === 'archived' && (
            <>
              <button
                onClick={handleRestore}
                disabled={isSaving}
                className={cn(
                  'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
                  'bg-primary/10 text-primary',
                  'font-medium text-sm',
                  'hover:bg-primary/20 transition-colors',
                  'disabled:opacity-50',
                  'flex-shrink-0'
                )}
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Restore</span>
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className={cn(
                  'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
                  'text-destructive hover:bg-destructive/10',
                  'font-medium text-sm',
                  'transition-colors',
                  'disabled:opacity-50',
                  'flex-shrink-0'
                )}
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </>
          )}
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            title="Save Draft (⌘S)"
            className={cn(
              'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
              'bg-secondary text-secondary-foreground border border-border',
              'font-medium text-sm',
              'hover:bg-accent transition-colors',
              'disabled:opacity-50',
              'flex-shrink-0',
              !isNew && 'sm:ml-auto'
            )}
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Save Draft</span>
            <span className="sm:hidden">Draft</span>
          </button>
          <button
            onClick={handleSchedule}
            disabled={isSaving || !canSchedule}
            title={canSchedule ? "Schedule Post (⌘↵)" : "Select a date and time to schedule"}
            className={cn(
              'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
              'bg-gradient-to-r from-twitter to-[#0d8bd9] text-white',
              'font-medium text-sm',
              'hover:opacity-90 transition-opacity',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex-shrink-0'
            )}
          >
            <Calendar className="w-4 h-4" />
            Schedule
          </button>
          <button
            onClick={handlePublishNow}
            disabled={isSaving || false /* platform is always set */}
            className={cn(
              'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
              'text-muted-foreground',
              'font-medium text-sm',
              'hover:bg-accent hover:text-foreground transition-colors',
              'disabled:opacity-50',
              'flex-shrink-0',
              isNew && 'sm:ml-auto'
            )}
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Publish Now</span>
            <span className="sm:hidden">Publish</span>
          </button>
          {!isNew && post.status !== 'published' && (
            <button
              onClick={handleMarkAsPosted}
              disabled={isSaving || false /* platform is always set */}
              className={cn(
                'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
                'bg-green-500/10 text-green-600 dark:text-green-400',
                'font-medium text-sm',
                'hover:bg-green-500/20 transition-colors',
                'disabled:opacity-50',
                'flex-shrink-0'
              )}
            >
              <CheckCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Mark as Posted</span>
              <span className="sm:hidden">Posted</span>
            </button>
          )}
        </div>
      </div>

      {/* Preview panel - hidden on mobile */}
      <div data-testid="preview-panel" className="hidden lg:block border-l border-border bg-card p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live Preview
          </h3>
        </div>

        <div className="space-y-4">
            {post.platform === 'twitter' && (
              <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
                <div className="flex items-center gap-2 text-twitter text-xs font-medium mb-2">
                  <span className="w-2 h-2 rounded-full bg-twitter" />
                  Twitter / X
                </div>
                <div className="bg-[#15202B] rounded-2xl p-4">
                  <div className="flex gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                    <div>
                      <div className="font-bold text-[15px] text-[#E7E9EA]">Your Name</div>
                      <div className="text-[15px] text-[#71767B]">@yourhandle</div>
                    </div>
                  </div>
                  <div className="text-[15px] leading-[1.4] text-[#E7E9EA] whitespace-pre-wrap">
                    {content || 'Your tweet will appear here...'}
                  </div>
                  {mediaUrls.length > 0 && (
                    <div className={cn(
                      'mt-3 grid gap-1 rounded-xl overflow-hidden',
                      mediaUrls.length === 1 && 'grid-cols-1',
                      mediaUrls.length === 2 && 'grid-cols-2',
                      mediaUrls.length >= 3 && 'grid-cols-2'
                    )}>
                      {mediaUrls.slice(0, 4).map((url, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'relative bg-[#1D2A35] flex items-center justify-center',
                            mediaUrls.length === 1 ? 'h-48' : 'h-24',
                            mediaUrls.length === 3 && idx === 0 && 'row-span-2 h-48'
                          )}
                        >
                          <img
                            src={getMediaUrl(url)}
                            alt={`Media ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-[#71767B] text-xs">
                            <Image className="w-6 h-6 opacity-50" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {post.platform === 'linkedin' && (
              <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                <div className="flex items-center gap-2 text-linkedin text-xs font-medium mb-2">
                  <span className="w-2 h-2 rounded-full bg-linkedin" />
                  LinkedIn
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="flex gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                    <div>
                      <div className="font-semibold text-sm text-black">Your Name</div>
                      <div className="text-xs text-gray-600">Software Engineer at Company</div>
                      <div className="text-xs text-gray-600">Just now</div>
                    </div>
                  </div>
                  <div className="text-sm leading-[1.5] text-black whitespace-pre-wrap">
                    {content || 'Your LinkedIn post will appear here...'}
                  </div>
                  {linkedInMediaUrl && (
                    <div className="mt-3 rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={getMediaUrl(linkedInMediaUrl)}
                        alt="LinkedIn media"
                        className="w-full h-40 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {post.platform === 'reddit' && (
              <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
                <div className="flex items-center gap-2 text-reddit text-xs font-medium mb-2">
                  <span className="w-2 h-2 rounded-full bg-reddit" />
                  Reddit {redditUrl ? '(Link Post)' : '(Text Post)'}
                </div>
                <div className="bg-[#1A1A1B] border border-[#343536] rounded">
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#818384]">
                    <span className="font-bold text-[#D7DADC]">
                      {subredditsInput.length
                        ? subredditsInput.map((s: string) => `r/${s}`).join(', ')
                        : 'r/subreddit'}
                    </span>
                    • Posted by u/yourname
                  </div>
                  <div className="px-3 text-lg font-medium text-[#D7DADC]">
                    {(isRedditContent(post.content) && post.content.title) || 'Your post title'}
                  </div>
                  {redditUrl && (
                    <div className="px-3 py-2 text-xs text-[#4FBCFF] truncate">
                      🔗 {redditUrl}
                    </div>
                  )}
                  <div className="p-3 text-sm text-[#D7DADC] whitespace-pre-wrap">
                    {content || 'Your Reddit post will appear here...'}
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete this post?"
        description="This action cannot be undone. The post will be permanently removed."
        confirmText="Delete"
        cancelText="Keep"
        variant="danger"
      />

      {/* Archive confirmation dialog */}
      <ConfirmDialog
        open={showArchiveConfirm}
        onConfirm={confirmArchive}
        onCancel={() => setShowArchiveConfirm(false)}
        title="Archive this post?"
        description="The post will be moved to your archive. You can restore it later or delete it permanently."
        confirmText="Archive"
        cancelText="Cancel"
      />

      {/* Platform switch confirmation dialog */}
      <ConfirmDialog
        open={showPlatformSwitchConfirm}
        onConfirm={confirmPlatformSwitch}
        onCancel={() => {
          setShowPlatformSwitchConfirm(false)
          setPendingPlatform(null)
        }}
        title="Switch platform?"
        description="Switching platforms will reset some content. Your text will be preserved, but platform-specific settings will be cleared."
        confirmText="Switch"
        cancelText="Cancel"
      />
    </div>
  )
}

