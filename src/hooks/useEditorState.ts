'use client'
/* eslint-disable max-lines -- large page component with extracted sub-components */

import { useState, useEffect, useRef } from 'react'
import { usePostsStore } from '@/lib/storage'
import { useCampaignsStore } from '@/lib/campaigns'
import { useSocialAccountsStore } from '@/lib/socialAccounts'
import {
  Post,
  Platform,
  createPost,
  isTwitterContent,
  isLinkedInContent,
  isRedditContent,
} from '@/lib/posts'

export interface PostDraftData {
  content: string
  platform: string
  notes: string
  mediaUrls: string[]
  linkedInMediaUrl: string
  redditUrl: string
  subredditsInput: string[]
  subredditTitles: Record<string, string>
  subredditSchedules: Record<string, string>
  campaignId?: string
  scheduledAt?: string
}

interface UseEditorStateOptions {
  id?: string
  dateParam?: string | null
  campaignParam?: string | null
  initialContent?: string
}

// eslint-disable-next-line max-lines-per-function -- API handler requires auth+db in single try/catch
export function useEditorFormState(options: UseEditorStateOptions) {
  const { id, dateParam, campaignParam, initialContent = '' } = options
  const { getPost, fetchPosts, initialized: postsInitialized } = usePostsStore()
  const { campaigns, fetchCampaigns, initialized: campaignsInitialized } = useCampaignsStore()
  const {
    getAccountsByProvider,
    fetchAccounts,
    getActiveAccount,
    initialized: accountsInitialized,
  } = useSocialAccountsStore()

  const isNew = !id
  const existingPost = id ? getPost(id) : undefined

  useEffect(() => {
    if (!postsInitialized) fetchPosts()
    if (!campaignsInitialized) fetchCampaigns()
    if (!accountsInitialized) fetchAccounts()
  }, [
    postsInitialized,
    fetchPosts,
    campaignsInitialized,
    fetchCampaigns,
    accountsInitialized,
    fetchAccounts,
  ])

  const [post, setPost] = useState<Post>(() => {
    if (existingPost) return existingPost
    const newPost = createPost()
    if (dateParam) newPost.scheduledAt = `${dateParam}T12:00:00.000Z`
    if (campaignParam) newPost.campaignId = campaignParam
    return newPost
  })

  const [content, setContent] = useState(initialContent)
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [linkedInMediaUrl, setLinkedInMediaUrl] = useState('')
  const [redditUrl, setRedditUrl] = useState('')
  const [showMediaInput, setShowMediaInput] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showPublishedLinks, setShowPublishedLinks] = useState(false)
  const [newSubreddit, setNewSubreddit] = useState('')
  const [subredditsInput, setSubredditsInput] = useState<string[]>([])
  const [subredditSchedules, setSubredditSchedules] = useState<Record<string, string>>({})
  const [subredditTitles, setSubredditTitles] = useState<Record<string, string>>({})
  const [expandedSubreddits, setExpandedSubreddits] = useState<Record<string, boolean>>({})

  return {
    isNew,
    existingPost,
    postsInitialized,
    campaigns,
    post,
    setPost,
    content,
    setContent,
    mediaUrls,
    setMediaUrls,
    linkedInMediaUrl,
    setLinkedInMediaUrl,
    redditUrl,
    setRedditUrl,
    showMediaInput,
    setShowMediaInput,
    showNotes,
    setShowNotes,
    showPublishedLinks,
    setShowPublishedLinks,
    newSubreddit,
    setNewSubreddit,
    subredditsInput,
    setSubredditsInput,
    subredditSchedules,
    setSubredditSchedules,
    subredditTitles,
    setSubredditTitles,
    expandedSubreddits,
    setExpandedSubreddits,
    getAccountsByProvider,
    getActiveAccount,
    fetchPosts,
  }
}

export function useSubredditManagement(
  setSubredditsInput: React.Dispatch<React.SetStateAction<string[]>>,
  setSubredditTitles: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  setSubredditSchedules: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  setExpandedSubreddits: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
) {
  const toggleSubredditExpanded = (subreddit: string) => {
    setExpandedSubreddits((prev) => ({ ...prev, [subreddit]: !prev[subreddit] }))
  }
  const updateSubredditTitle = (subreddit: string, title: string) => {
    setSubredditTitles((prev) => ({ ...prev, [subreddit]: title }))
  }
  const updateSubredditSchedule = (subreddit: string, isoString: string | null) => {
    if (isoString === null) {
      setSubredditSchedules((prev) => {
        const next = { ...prev }
        delete next[subreddit]
        return next
      })
    } else {
      setSubredditSchedules((prev) => ({ ...prev, [subreddit]: isoString }))
    }
  }
  const removeSubreddit = (subreddit: string) => {
    setSubredditsInput((prev) => prev.filter((s) => s !== subreddit))
    setSubredditTitles((prev) => {
      const next = { ...prev }
      delete next[subreddit]
      return next
    })
    setSubredditSchedules((prev) => {
      const next = { ...prev }
      delete next[subreddit]
      return next
    })
    setExpandedSubreddits((prev) => {
      const next = { ...prev }
      delete next[subreddit]
      return next
    })
  }
  return {
    toggleSubredditExpanded,
    updateSubredditTitle,
    updateSubredditSchedule,
    removeSubreddit,
  }
}

export function useDirtyTracking(deps: {
  content: string
  mediaUrls: string[]
  linkedInMediaUrl: string
  redditUrl: string
  platform: Platform
  notes: string | undefined
}) {
  const initialContentRef = useRef('')
  const [isDirty, setIsDirty] = useState(false)
  useEffect(() => {
    const currentContent = JSON.stringify({
      content: deps.content,
      mediaUrls: deps.mediaUrls,
      linkedInMediaUrl: deps.linkedInMediaUrl,
      redditUrl: deps.redditUrl,
      platform: deps.platform,
      notes: deps.notes,
    })
    /* eslint-disable react-hooks/set-state-in-effect */
    if (initialContentRef.current && currentContent !== initialContentRef.current) {
      setIsDirty(true)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    deps.content,
    deps.mediaUrls,
    deps.linkedInMediaUrl,
    deps.redditUrl,
    deps.platform,
    deps.notes,
  ])
  return { isDirty, setIsDirty, initialContentRef }
}

export function useLoadExistingPost(
  existingPost: Post | undefined,
  setters: {
    setPost: React.Dispatch<React.SetStateAction<Post>>
    setContent: React.Dispatch<React.SetStateAction<string>>
    setMediaUrls: React.Dispatch<React.SetStateAction<string[]>>
    setLinkedInMediaUrl: React.Dispatch<React.SetStateAction<string>>
    setRedditUrl: React.Dispatch<React.SetStateAction<string>>
    setSubredditsInput: React.Dispatch<React.SetStateAction<string[]>>
    setSubredditTitles: React.Dispatch<React.SetStateAction<Record<string, string>>>
    setSubredditSchedules: React.Dispatch<React.SetStateAction<Record<string, string>>>
    setExpandedSubreddits: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    setShowNotes: React.Dispatch<React.SetStateAction<boolean>>
    setShowPublishedLinks: React.Dispatch<React.SetStateAction<boolean>>
    initialContentRef: React.MutableRefObject<string>
  }
) {
  /* eslint-disable react-hooks/immutability */
  useEffect(() => {
    if (existingPost) {
      loadExistingPostData(existingPost, setters)
    } else {
      setters.initialContentRef.current = JSON.stringify({
        content: '',
        mediaUrls: [],
        linkedInMediaUrl: '',
        redditUrl: '',
        platform: 'twitter',
        notes: '',
      })
    }
  }, [existingPost]) // eslint-disable-line react-hooks/exhaustive-deps
}

function loadExistingPostData(
  existingPost: Post,
  setters: {
    setPost: React.Dispatch<React.SetStateAction<Post>>
    setContent: React.Dispatch<React.SetStateAction<string>>
    setMediaUrls: React.Dispatch<React.SetStateAction<string[]>>
    setLinkedInMediaUrl: React.Dispatch<React.SetStateAction<string>>
    setRedditUrl: React.Dispatch<React.SetStateAction<string>>
    setSubredditsInput: React.Dispatch<React.SetStateAction<string[]>>
    setSubredditTitles: React.Dispatch<React.SetStateAction<Record<string, string>>>
    setSubredditSchedules: React.Dispatch<React.SetStateAction<Record<string, string>>>
    setExpandedSubreddits: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    setShowNotes: React.Dispatch<React.SetStateAction<boolean>>
    setShowPublishedLinks: React.Dispatch<React.SetStateAction<boolean>>
    initialContentRef: React.MutableRefObject<string>
  }
) {
  setters.setPost(existingPost)
  const { text, loadedMediaUrls, loadedLinkedInMedia, loadedRedditUrl } = extractContentFields(
    existingPost,
    setters
  )
  setters.setContent(text)
  setters.initialContentRef.current = JSON.stringify({
    content: text,
    mediaUrls: loadedMediaUrls,
    linkedInMediaUrl: loadedLinkedInMedia,
    redditUrl: loadedRedditUrl,
    platform: existingPost.platform,
    notes: existingPost.notes || '',
  })
  if (existingPost.notes) setters.setShowNotes(true)
  const hasLaunchedUrls =
    (isTwitterContent(existingPost.content) && existingPost.content.launchedUrl) ||
    (isLinkedInContent(existingPost.content) && existingPost.content.launchedUrl) ||
    (isRedditContent(existingPost.content) && existingPost.content.launchedUrl)
  if (hasLaunchedUrls) setters.setShowPublishedLinks(true)
}

function extractContentFields(
  existingPost: Post,
  setters: {
    setMediaUrls: React.Dispatch<React.SetStateAction<string[]>>
    setLinkedInMediaUrl: React.Dispatch<React.SetStateAction<string>>
    setRedditUrl: React.Dispatch<React.SetStateAction<string>>
    setSubredditsInput: React.Dispatch<React.SetStateAction<string[]>>
    setSubredditTitles: React.Dispatch<React.SetStateAction<Record<string, string>>>
    setSubredditSchedules: React.Dispatch<React.SetStateAction<Record<string, string>>>
    setExpandedSubreddits: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  }
) {
  let text = ''
  if (isTwitterContent(existingPost.content)) {
    text = existingPost.content.text
    setters.setMediaUrls(existingPost.content.mediaUrls || [])
  } else if (isLinkedInContent(existingPost.content)) {
    text = existingPost.content.text
    setters.setLinkedInMediaUrl(existingPost.content.mediaUrl || '')
  } else if (isRedditContent(existingPost.content)) {
    text = existingPost.content.body || ''
    setters.setRedditUrl(existingPost.content.url || '')
    const subreddit = existingPost.content.subreddit
    setters.setSubredditsInput([subreddit])
    if (existingPost.content.title) {
      setters.setSubredditTitles({ [subreddit]: existingPost.content.title })
    }
    if (existingPost.scheduledAt) {
      setters.setSubredditSchedules({ [subreddit]: existingPost.scheduledAt })
    }
    setters.setExpandedSubreddits({ [subreddit]: true })
  }
  const loadedMediaUrls = isTwitterContent(existingPost.content)
    ? existingPost.content.mediaUrls || []
    : []
  const loadedLinkedInMedia = isLinkedInContent(existingPost.content)
    ? existingPost.content.mediaUrl || ''
    : ''
  const loadedRedditUrl = isRedditContent(existingPost.content)
    ? existingPost.content.url || ''
    : ''
  return { text, loadedMediaUrls, loadedLinkedInMedia, loadedRedditUrl }
}

export function usePlatformContentSync(
  content: string,
  mediaUrls: string[],
  linkedInMediaUrl: string,
  redditUrl: string,
  setPost: React.Dispatch<React.SetStateAction<Post>>
) {
  useEffect(() => {
    setPost((prev) => {
      const newContent = buildPlatformContent(prev, content, mediaUrls, linkedInMediaUrl, redditUrl)
      return { ...prev, content: newContent }
    })
  }, [content, mediaUrls, linkedInMediaUrl, redditUrl, setPost])
}

function buildPlatformContent(
  prev: Post,
  content: string,
  mediaUrls: string[],
  linkedInMediaUrl: string,
  redditUrl: string
) {
  const platform = prev.platform
  if (platform === 'twitter') {
    const existing = prev.content as { launchedUrl?: string }
    return {
      text: content,
      ...(mediaUrls.length > 0 && { mediaUrls }),
      ...(existing?.launchedUrl && { launchedUrl: existing.launchedUrl }),
    }
  }
  if (platform === 'linkedin') {
    const existing = prev.content as {
      visibility?: 'public' | 'connections'
      launchedUrl?: string
    }
    return {
      text: content,
      visibility: existing?.visibility || 'public',
      ...(linkedInMediaUrl && { mediaUrl: linkedInMediaUrl }),
      ...(existing?.launchedUrl && { launchedUrl: existing.launchedUrl }),
    }
  }
  if (platform === 'reddit') {
    const existing = prev.content as {
      subreddit?: string
      title?: string
      launchedUrl?: string
    }
    return {
      subreddit: existing?.subreddit || '',
      title: existing?.title || '',
      body: content,
      ...(redditUrl && { url: redditUrl }),
      ...(existing?.launchedUrl && { launchedUrl: existing.launchedUrl }),
    }
  }
  return prev.content
}
