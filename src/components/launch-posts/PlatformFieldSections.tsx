'use client'
/* eslint-disable max-lines -- large page component with extracted sub-components */

import { LaunchPlatform, LAUNCH_PLATFORM_INFO } from '@/lib/launchPosts'
import { cn } from '@/lib/utils'

interface PlatformFieldProps {
  platform: LaunchPlatform
  getPlatformFieldString: (key: string) => string
  updatePlatformField: (key: string, value: string) => void
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export function ProductHuntFields({
  platform,
  getPlatformFieldString,
  updatePlatformField,
}: PlatformFieldProps) {
  const platformInfo = LAUNCH_PLATFORM_INFO[platform]

  return (
    <div className="bg-card border-[3px] border-border rounded-md shadow-sticker p-4 md:p-6 space-y-4">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <span
          className={cn(
            'w-5 h-5 rounded flex items-center justify-center text-xs font-bold',
            platformInfo.bgColor,
            platformInfo.color
          )}
        >
          P
        </span>
        Product Hunt Fields
      </h3>

      {/* Tagline */}
      <div>
        <label htmlFor="tagline" className="block text-sm font-bold mb-2">
          Tagline
          <span
            className={cn(
              'ml-2 text-xs font-medium',
              getPlatformFieldString('tagline').length > 60
                ? 'text-destructive'
                : 'text-muted-foreground'
            )}
          >
            {getPlatformFieldString('tagline').length}/60
          </span>
        </label>
        <input
          id="tagline"
          type="text"
          value={getPlatformFieldString('tagline')}
          onChange={(e) => updatePlatformField('tagline', e.target.value)}
          placeholder="A short, catchy description (60 chars max)"
          maxLength={60}
          className={cn(
            'w-full px-4 py-3 rounded-md',
            'bg-card text-foreground placeholder-muted-foreground',
            'border-[3px] border-border',
            'shadow-sticker-sm',
            'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
            'transition-all'
          )}
        />
      </div>

      {/* Pricing */}
      <div>
        <label htmlFor="pricing" className="block text-sm font-bold mb-2">
          Pricing Model
        </label>
        <select
          id="pricing"
          value={getPlatformFieldString('pricing') || 'free'}
          onChange={(e) => updatePlatformField('pricing', e.target.value)}
          className="w-full px-4 py-3 rounded-md bg-card border-[3px] border-border shadow-sticker-sm text-sm font-medium"
        >
          <option value="free">Free</option>
          <option value="freemium">Freemium</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* First Comment */}
      <div>
        <label htmlFor="firstComment" className="block text-sm font-bold mb-2">
          First Comment (Maker&apos;s Introduction)
        </label>
        <textarea
          id="firstComment"
          value={getPlatformFieldString('firstComment')}
          onChange={(e) => updatePlatformField('firstComment', e.target.value)}
          placeholder="Introduce yourself and share the story behind your product..."
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
        <p className="text-xs text-muted-foreground mt-1.5 font-medium">
          This is the critical first comment you&apos;ll post as the maker
        </p>
      </div>
    </div>
  )
}

export function AskHNFields({
  platform,
  getPlatformFieldString,
  updatePlatformField,
}: PlatformFieldProps) {
  const platformInfo = LAUNCH_PLATFORM_INFO[platform]

  return (
    <div className="bg-card border-[3px] border-border rounded-md shadow-sticker p-4 md:p-6 space-y-4">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <span
          className={cn(
            'w-5 h-5 rounded flex items-center justify-center text-xs font-bold',
            platformInfo.bgColor,
            platformInfo.color
          )}
        >
          Y
        </span>
        Ask HN Fields
      </h3>

      {/* Question Body */}
      <div>
        <label htmlFor="text" className="block text-sm font-bold mb-2">
          Question Body
        </label>
        <textarea
          id="text"
          value={getPlatformFieldString('text')}
          onChange={(e) => updatePlatformField('text', e.target.value)}
          placeholder="Provide more context for your question..."
          rows={6}
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
  )
}

// eslint-disable-next-line max-lines-per-function -- near-borderline, extraction would hurt readability
export function BetaListFieldsSection({
  platform,
  getPlatformFieldString,
  updatePlatformField,
}: PlatformFieldProps) {
  const platformInfo = LAUNCH_PLATFORM_INFO[platform]

  return (
    <div className="bg-card border-[3px] border-border rounded-md shadow-sticker p-4 md:p-6 space-y-4">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <span
          className={cn(
            'w-5 h-5 rounded flex items-center justify-center text-xs font-bold',
            platformInfo.bgColor,
            platformInfo.color
          )}
        >
          B
        </span>
        BetaList Fields
      </h3>

      {/* One Sentence Pitch */}
      <div>
        <label htmlFor="pitch" className="block text-sm font-bold mb-2">
          One-Sentence Pitch
          <span
            className={cn(
              'ml-2 text-xs font-medium',
              getPlatformFieldString('oneSentencePitch').length > 140
                ? 'text-destructive'
                : 'text-muted-foreground'
            )}
          >
            {getPlatformFieldString('oneSentencePitch').length}/140
          </span>
        </label>
        <input
          id="pitch"
          type="text"
          value={getPlatformFieldString('oneSentencePitch')}
          onChange={(e) => updatePlatformField('oneSentencePitch', e.target.value)}
          placeholder="One sentence that explains what your product does..."
          maxLength={140}
          className={cn(
            'w-full px-4 py-3 rounded-md',
            'bg-card text-foreground placeholder-muted-foreground',
            'border-[3px] border-border',
            'shadow-sticker-sm',
            'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
            'transition-all'
          )}
        />
        <p className="text-xs text-muted-foreground mt-1.5 font-medium">
          This is used when sharing on Twitter
        </p>
      </div>
    </div>
  )
}

// eslint-disable-next-line max-lines-per-function -- near-borderline, extraction would hurt readability
export function IndieHackersFieldsSection({
  platform,
  getPlatformFieldString,
  updatePlatformField,
}: PlatformFieldProps) {
  const platformInfo = LAUNCH_PLATFORM_INFO[platform]

  return (
    <div className="bg-card border-[3px] border-border rounded-md shadow-sticker p-4 md:p-6 space-y-4">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <span
          className={cn(
            'w-5 h-5 rounded flex items-center justify-center text-xs font-bold',
            platformInfo.bgColor,
            platformInfo.color
          )}
        >
          IH
        </span>
        Indie Hackers Fields
      </h3>

      {/* Short Description */}
      <div>
        <label htmlFor="shortDesc" className="block text-sm font-bold mb-2">
          Short Description
        </label>
        <input
          id="shortDesc"
          type="text"
          value={getPlatformFieldString('shortDescription')}
          onChange={(e) => updatePlatformField('shortDescription', e.target.value)}
          placeholder="Brief product description..."
          className={cn(
            'w-full px-4 py-3 rounded-md',
            'bg-card text-foreground placeholder-muted-foreground',
            'border-[3px] border-border',
            'shadow-sticker-sm',
            'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
            'transition-all'
          )}
        />
      </div>

      {/* Revenue */}
      <div>
        <label htmlFor="revenue" className="block text-sm font-bold mb-2">
          Monthly Revenue (optional)
        </label>
        <input
          id="revenue"
          type="text"
          value={getPlatformFieldString('revenue')}
          onChange={(e) => updatePlatformField('revenue', e.target.value)}
          placeholder="e.g., $1,000/mo"
          className={cn(
            'w-full px-4 py-3 rounded-md',
            'bg-card text-foreground placeholder-muted-foreground',
            'border-[3px] border-border',
            'shadow-sticker-sm',
            'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
            'transition-all'
          )}
        />
      </div>
    </div>
  )
}

// eslint-disable-next-line max-lines-per-function -- near-borderline, extraction would hurt readability
export function DevHuntFieldsSection({
  platform,
  getPlatformFieldString,
  updatePlatformField,
}: PlatformFieldProps) {
  const platformInfo = LAUNCH_PLATFORM_INFO[platform]

  return (
    <div className="bg-card border-[3px] border-border rounded-md shadow-sticker p-4 md:p-6 space-y-4">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <span
          className={cn(
            'w-5 h-5 rounded flex items-center justify-center text-xs font-bold',
            platformInfo.bgColor,
            platformInfo.color
          )}
        >
          D
        </span>
        Dev Hunt Fields
      </h3>

      {/* GitHub URL */}
      <div>
        <label htmlFor="github" className="block text-sm font-bold mb-2">
          GitHub URL
        </label>
        <input
          id="github"
          type="url"
          value={getPlatformFieldString('githubUrl')}
          onChange={(e) => updatePlatformField('githubUrl', e.target.value)}
          placeholder="https://github.com/username/repo"
          className={cn(
            'w-full px-4 py-3 rounded-md',
            'bg-card text-foreground placeholder-muted-foreground',
            'border-[3px] border-border',
            'shadow-sticker-sm',
            'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
            'transition-all'
          )}
        />
      </div>

      {/* Founder Story */}
      <div>
        <label htmlFor="founderStory" className="block text-sm font-bold mb-2">
          Founder Story
        </label>
        <textarea
          id="founderStory"
          value={getPlatformFieldString('founderStory')}
          onChange={(e) => updatePlatformField('founderStory', e.target.value)}
          placeholder="Share the story behind building this tool..."
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
  )
}
