'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { FolderKanban, Edit2, Trash2, MoreVertical, FolderOpen, Hash, Palette } from 'lucide-react'
import { Project } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { getMediaUrl } from '@/lib/media'

interface ProjectCardProps {
  project: Project
  campaignCount?: number
  index?: number
  variant?: 'list' | 'grid'
  onEdit?: (e: React.MouseEvent) => void
  onDelete?: (e: React.MouseEvent) => void
}

export function ProjectCard({
  project,
  campaignCount = 0,
  index = 0,
  variant = 'list',
  onEdit,
  onDelete,
}: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const hasLogo = !!project.logoUrl
  const hasHashtags = project.hashtags.length > 0
  const hasBrandColors = !!(
    project.brandColors.primary ||
    project.brandColors.secondary ||
    project.brandColors.accent
  )

  if (variant === 'grid') {
    return (
      <Link
        href={`/projects/${project.id}`}
        className={cn(
          'block p-4 bg-card rounded-md',
          'border-[3px] border-border',
          'shadow-sticker-sm',
          'hover:translate-y-[-2px] hover:shadow-[5px_5px_0_hsl(var(--border))]',
          'active:translate-y-px active:shadow-sticker-hover',
          'transition-all',
          'animate-slide-up'
        )}
        style={{ animationDelay: `${index * 30}ms` }}
      >
        {/* Logo or placeholder */}
        <div className="relative aspect-2/1 mb-4 rounded-md overflow-hidden bg-accent/30 flex items-center justify-center border-2 border-border">
          {hasLogo ? (
            <Image
              src={getMediaUrl(project.logoUrl!)}
              alt={`${project.name} logo`}
              fill
              sizes="(max-width: 640px) 100vw, 300px"
              className="object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          ) : (
            <FolderKanban className="w-12 h-12 text-sticker-purple/30" />
          )}

          {/* Brand color indicators */}
          {hasBrandColors && (
            <div className="absolute bottom-2 right-2 flex gap-1">
              {project.brandColors.primary && (
                <div
                  className="w-4 h-4 rounded-full border-2 border-border shadow-xs"
                  style={{ backgroundColor: project.brandColors.primary }}
                  title="Primary color"
                />
              )}
              {project.brandColors.secondary && (
                <div
                  className="w-4 h-4 rounded-full border-2 border-border shadow-xs"
                  style={{ backgroundColor: project.brandColors.secondary }}
                  title="Secondary color"
                />
              )}
              {project.brandColors.accent && (
                <div
                  className="w-4 h-4 rounded-full border-2 border-border shadow-xs"
                  style={{ backgroundColor: project.brandColors.accent }}
                  title="Accent color"
                />
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <h3 className="font-bold mb-1 truncate">{project.name}</h3>
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-sticker-purple/10 text-sticker-purple border border-sticker-purple/30">
            <FolderOpen className="w-3.5 h-3.5" />
            {campaignCount} campaign{campaignCount !== 1 ? 's' : ''}
          </span>
          {hasHashtags && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-sticker-blue/10 text-sticker-blue border border-sticker-blue/30">
              <Hash className="w-3 h-3" />
              {project.hashtags.length}
            </span>
          )}
        </div>

        {/* Actions overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-1">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onEdit(e)
                }}
                className="p-2 rounded-md bg-card/80 backdrop-blur-xs text-muted-foreground hover:text-foreground hover:bg-accent border-2 border-border transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(e)
                }}
                className="p-2 rounded-md bg-card/80 backdrop-blur-xs text-muted-foreground hover:text-destructive hover:bg-accent border-2 border-border transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </Link>
    )
  }

  // List variant (default)
  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        'block p-3 md:p-4 bg-card rounded-md group',
        'border-[3px] border-border',
        'shadow-sticker-sm',
        'hover:translate-y-[-2px] hover:shadow-[5px_5px_0_hsl(var(--border))]',
        'active:translate-y-px active:shadow-sticker-hover',
        'transition-all',
        'animate-slide-up'
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-start gap-3 md:gap-4">
        {/* Logo/Icon */}
        <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-md bg-sticker-purple/10 flex items-center justify-center shrink-0 overflow-hidden border-2 border-sticker-purple/30">
          {hasLogo ? (
            <Image
              src={getMediaUrl(project.logoUrl!)}
              alt={`${project.name} logo`}
              fill
              sizes="48px"
              className="object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                target.nextElementSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <FolderKanban
            className={cn('w-5 h-5 md:w-6 md:h-6 text-sticker-purple', hasLogo && 'hidden')}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold mb-1 truncate">{project.name}</h3>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{project.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs text-muted-foreground font-medium">
            {/* Campaign count */}
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-sticker-purple/10 text-sticker-purple border border-sticker-purple/30">
              <FolderOpen className="w-3.5 h-3.5" />
              {campaignCount} campaign{campaignCount !== 1 ? 's' : ''}
            </span>

            {/* Hashtags indicator */}
            {hasHashtags && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-sticker-blue/10 text-sticker-blue border border-sticker-blue/30">
                <Hash className="w-3.5 h-3.5" />
                {project.hashtags.length} hashtag{project.hashtags.length !== 1 ? 's' : ''}
              </span>
            )}

            {/* Brand colors indicator */}
            {hasBrandColors && (
              <span className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span className="flex gap-0.5">
                  {project.brandColors.primary && (
                    <span
                      className="w-3 h-3 rounded-full border-2 border-border"
                      style={{ backgroundColor: project.brandColors.primary }}
                    />
                  )}
                  {project.brandColors.secondary && (
                    <span
                      className="w-3 h-3 rounded-full border-2 border-border"
                      style={{ backgroundColor: project.brandColors.secondary }}
                    />
                  )}
                  {project.brandColors.accent && (
                    <span
                      className="w-3 h-3 rounded-full border-2 border-border"
                      style={{ backgroundColor: project.brandColors.accent }}
                    />
                  )}
                </span>
              </span>
            )}

            {/* Last updated */}
            <span className="flex items-center gap-1.5 hidden sm:flex">
              Updated {format(new Date(project.updatedAt), 'MMM d')}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent border-2 border-transparent hover:border-border transition-all min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-card border-[3px] border-border rounded-md shadow-sticker py-1 min-w-[140px]">
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Link>
                {onDelete && (
                  <button
                    onClick={(e) => {
                      setShowMenu(false)
                      onDelete(e)
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-destructive hover:bg-accent transition-colors w-full text-left"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
