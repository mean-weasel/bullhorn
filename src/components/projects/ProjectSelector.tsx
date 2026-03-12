'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { ChevronDown, FolderKanban, Layers, FolderX, Check } from 'lucide-react'
import { useProjectsStore } from '@/lib/projects'
import { Project } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { getMediaUrl } from '@/lib/media'
import { IOSActionSheet, useIsMobile } from '@/components/ui/IOSActionSheet'

type SelectionValue = 'all' | 'unassigned' | string

interface ProjectSelectorProps {
  value: SelectionValue
  onChange: (value: SelectionValue, project: Project | null) => void
  showAllOption?: boolean
  showUnassignedOption?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function ProjectSelector({
  value,
  onChange,
  showAllOption = true,
  showUnassignedOption = true,
  placeholder = 'Select project...',
  className,
  disabled = false,
}: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { projects, fetchProjects, initialized, getProject } = useProjectsStore()
  const isMobile = useIsMobile()

  // Fetch projects on mount
  useEffect(() => {
    if (!initialized) {
      fetchProjects()
    }
  }, [initialized, fetchProjects])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Get display label
  const getDisplayLabel = () => {
    if (value === 'all') return 'All Projects'
    if (value === 'unassigned') return 'Unassigned'
    const project = getProject(value)
    return project?.name || placeholder
  }

  // Get selected project
  const selectedProject = value !== 'all' && value !== 'unassigned' ? getProject(value) : null

  const handleSelect = (newValue: SelectionValue) => {
    const project =
      newValue !== 'all' && newValue !== 'unassigned' ? (getProject(newValue) ?? null) : null
    onChange(newValue, project)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-full',
          'bg-card text-foreground',
          isOpen
            ? 'border-[hsl(var(--gold))] ring-2 ring-[hsl(var(--gold))]/20'
            : 'border-border hover:border-[hsl(var(--gold))]/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* Icon */}
        {selectedProject?.logoUrl ? (
          <Image
            src={getMediaUrl(selectedProject.logoUrl)}
            alt=""
            width={20}
            height={20}
            className="rounded object-contain"
          />
        ) : value === 'all' ? (
          <Layers className="w-4 h-4 text-muted-foreground" />
        ) : value === 'unassigned' ? (
          <FolderX className="w-4 h-4 text-muted-foreground" />
        ) : (
          <FolderKanban className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
        )}

        {/* Label */}
        <span className="flex-1 text-left text-sm truncate">{getDisplayLabel()}</span>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Desktop Dropdown */}
      {isOpen && !isMobile && (
        <div
          className={cn(
            'absolute z-50 w-full mt-1',
            'bg-card border border-border rounded-lg shadow-lg',
            'py-1 max-h-64 overflow-y-auto',
            'animate-in fade-in slide-in-from-top-2 duration-150'
          )}
        >
          {/* All Projects option */}
          {showAllOption && (
            <button
              type="button"
              onClick={() => handleSelect('all')}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm',
                'hover:bg-accent transition-colors text-left',
                value === 'all' && 'bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold-dark))]'
              )}
            >
              <Layers className="w-4 h-4" />
              <span className="flex-1">All Projects</span>
              {value === 'all' && <Check className="w-4 h-4" />}
            </button>
          )}

          {/* Unassigned option */}
          {showUnassignedOption && (
            <button
              type="button"
              onClick={() => handleSelect('unassigned')}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm',
                'hover:bg-accent transition-colors text-left',
                value === 'unassigned' && 'bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold-dark))]'
              )}
            >
              <FolderX className="w-4 h-4" />
              <span className="flex-1">Unassigned</span>
              {value === 'unassigned' && <Check className="w-4 h-4" />}
            </button>
          )}

          {/* Divider */}
          {(showAllOption || showUnassignedOption) && projects.length > 0 && (
            <div className="border-t border-border my-1" />
          )}

          {/* Project list */}
          {projects.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No projects yet
            </div>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => handleSelect(project.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm',
                  'hover:bg-accent transition-colors text-left',
                  value === project.id && 'bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold-dark))]'
                )}
              >
                {/* Logo or icon */}
                {project.logoUrl ? (
                  <Image
                    src={getMediaUrl(project.logoUrl)}
                    alt=""
                    width={20}
                    height={20}
                    className="rounded object-contain"
                  />
                ) : (
                  <FolderKanban className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
                )}

                {/* Name */}
                <span className="flex-1 truncate">{project.name}</span>

                {/* Brand colors preview */}
                {(project.brandColors.primary ||
                  project.brandColors.secondary ||
                  project.brandColors.accent) && (
                  <span className="flex gap-0.5">
                    {project.brandColors.primary && (
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-border"
                        style={{ backgroundColor: project.brandColors.primary }}
                      />
                    )}
                    {project.brandColors.secondary && (
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-border"
                        style={{ backgroundColor: project.brandColors.secondary }}
                      />
                    )}
                    {project.brandColors.accent && (
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-border"
                        style={{ backgroundColor: project.brandColors.accent }}
                      />
                    )}
                  </span>
                )}

                {/* Checkmark */}
                {value === project.id && <Check className="w-4 h-4 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}

      {/* iOS Action Sheet for mobile */}
      <IOSActionSheet
        open={isOpen && isMobile}
        onClose={() => setIsOpen(false)}
        onSelect={handleSelect}
        title="Select Project"
        selectedValue={value}
        options={[
          ...(showAllOption
            ? [
                {
                  value: 'all' as SelectionValue,
                  label: 'All Projects',
                  icon: <Layers className="w-5 h-5" />,
                },
              ]
            : []),
          ...(showUnassignedOption
            ? [
                {
                  value: 'unassigned' as SelectionValue,
                  label: 'Unassigned',
                  icon: <FolderX className="w-5 h-5" />,
                },
              ]
            : []),
          ...projects.map((project) => ({
            value: project.id as SelectionValue,
            label: project.name,
            icon: project.logoUrl ? (
              <Image
                src={getMediaUrl(project.logoUrl)}
                alt=""
                width={20}
                height={20}
                className="rounded object-contain"
              />
            ) : (
              <FolderKanban className="w-5 h-5 text-[hsl(var(--gold-dark))]" />
            ),
          })),
        ]}
      />
    </div>
  )
}
