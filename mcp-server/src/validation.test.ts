import { describe, it, expect } from 'vitest'
import { validatePostContent } from './validation.js'

// eslint-disable-next-line max-lines-per-function
describe('validatePostContent', () => {
  // eslint-disable-next-line max-lines-per-function
  describe('twitter', () => {
    // eslint-disable-next-line max-lines-per-function
    it('accepts valid content with text', () => {
      expect(validatePostContent('twitter', { text: 'hello' })).toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('accepts content with text and mediaUrls', () => {
      expect(
        validatePostContent('twitter', {
          text: 'hello',
          mediaUrls: ['https://example.com/img.png'],
        })
      ).toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('rejects empty object', () => {
      const result = validatePostContent('twitter', {})
      expect(result).toContain('text')
      expect(result).not.toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('rejects empty text', () => {
      const result = validatePostContent('twitter', { text: '' })
      expect(result).toContain('text')
      expect(result).not.toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('rejects whitespace-only text', () => {
      const result = validatePostContent('twitter', { text: '   ' })
      expect(result).toContain('text')
      expect(result).not.toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('rejects content with only mediaUrls', () => {
      const result = validatePostContent('twitter', { mediaUrls: [] })
      expect(result).toContain('text')
      expect(result).not.toBeNull()
    })
  })

  // eslint-disable-next-line max-lines-per-function
  describe('linkedin', () => {
    // eslint-disable-next-line max-lines-per-function
    it('accepts valid content with text and visibility', () => {
      expect(validatePostContent('linkedin', { text: 'hi', visibility: 'public' })).toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('accepts valid content with connections visibility', () => {
      expect(validatePostContent('linkedin', { text: 'hi', visibility: 'connections' })).toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('accepts content without visibility', () => {
      expect(validatePostContent('linkedin', { text: 'hi' })).toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('rejects empty object', () => {
      const result = validatePostContent('linkedin', {})
      expect(result).toContain('text')
      expect(result).not.toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('rejects invalid visibility', () => {
      const result = validatePostContent('linkedin', { text: 'hi', visibility: 'private' })
      expect(result).toContain('visibility')
      expect(result).not.toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('rejects empty text', () => {
      const result = validatePostContent('linkedin', { text: '' })
      expect(result).toContain('text')
      expect(result).not.toBeNull()
    })
  })

  // eslint-disable-next-line max-lines-per-function
  describe('reddit', () => {
    // eslint-disable-next-line max-lines-per-function
    it('accepts valid content with subreddit and title', () => {
      expect(validatePostContent('reddit', { subreddit: 'test', title: 'hi' })).toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('accepts content with optional fields', () => {
      expect(
        validatePostContent('reddit', {
          subreddit: 'test',
          title: 'hi',
          body: 'content',
          url: 'https://example.com',
          flairText: 'Discussion',
        })
      ).toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('rejects missing subreddit', () => {
      const result = validatePostContent('reddit', { title: 'hi' })
      expect(result).toContain('subreddit')
      expect(result).not.toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('rejects missing title', () => {
      const result = validatePostContent('reddit', { subreddit: 'test' })
      expect(result).toContain('title')
      expect(result).not.toBeNull()
    })

    // eslint-disable-next-line max-lines-per-function
    it('rejects empty object', () => {
      const result = validatePostContent('reddit', {})
      expect(result).toContain('subreddit')
      expect(result).toContain('title')
      expect(result).not.toBeNull()
    })
  })

  // eslint-disable-next-line max-lines-per-function
  describe('unknown platform', () => {
    // eslint-disable-next-line max-lines-per-function
    it('returns error for unknown platform', () => {
      const result = validatePostContent('mastodon' as 'twitter', {})
      expect(result).toContain('Unknown platform')
    })
  })
})
