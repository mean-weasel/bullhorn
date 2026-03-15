'use client'

import Link from 'next/link'
import { Link2, BarChart3 } from 'lucide-react'
import { Project } from '@/lib/posts'
import { AnalyticsConnection } from '@/lib/analytics.types'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'
import { AccountPicker } from '@/components/projects/AccountPicker'
import { cn } from '@/lib/utils'

interface ProjectSettingsTabProps {
  project: Project
  editName: string
  setEditName: (v: string) => void
  editDescription: string
  setEditDescription: (v: string) => void
  editHashtags: string
  setEditHashtags: (v: string) => void
  editPrimaryColor: string
  setEditPrimaryColor: (v: string) => void
  editSecondaryColor: string
  setEditSecondaryColor: (v: string) => void
  editAccentColor: string
  setEditAccentColor: (v: string) => void
  analyticsConnections: AnalyticsConnection[]
  onSave: () => void
  onDelete: () => void
}

// eslint-disable-next-line max-lines-per-function
export function ProjectSettingsTab({
  project,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  editHashtags,
  setEditHashtags,
  editPrimaryColor,
  setEditPrimaryColor,
  editSecondaryColor,
  setEditSecondaryColor,
  editAccentColor,
  setEditAccentColor,
  analyticsConnections,
  onSave,
  onDelete,
}: ProjectSettingsTabProps) {
  return (
    <div className="space-y-6">
      {/* Project info */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        <h3 className="font-semibold mb-4">Project Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={200}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg',
                'bg-background border border-border',
                'focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--gold))]/50 focus:border-[hsl(var(--gold))]'
              )}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Describe this project..."
              rows={3}
              maxLength={2000}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg resize-none',
                'bg-background border border-border',
                'focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--gold))]/50 focus:border-[hsl(var(--gold))]'
              )}
            />
          </div>
        </div>
      </div>

      {/* Brand Kit */}
      <BrandKitSection
        editHashtags={editHashtags}
        setEditHashtags={setEditHashtags}
        editPrimaryColor={editPrimaryColor}
        setEditPrimaryColor={setEditPrimaryColor}
        editSecondaryColor={editSecondaryColor}
        setEditSecondaryColor={setEditSecondaryColor}
        editAccentColor={editAccentColor}
        setEditAccentColor={setEditAccentColor}
      />

      {/* Connected Accounts */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-5 h-5 text-[hsl(var(--gold-dark))]" />
          <h3 className="font-semibold">Connected Accounts</h3>
        </div>
        <AccountPicker
          projectId={project.id}
          selectedAccountIds={[]}
          onSelectionChange={() => {}}
          accounts={[]}
          loading={false}
        />
      </div>

      {/* Analytics */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold">Website Analytics</h3>
        </div>
        {analyticsConnections.length > 0 ? (
          <div className="space-y-4">
            {analyticsConnections.map((connection) => (
              <AnalyticsDashboard key={connection.id} connectionId={connection.id} compact />
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-500" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              No analytics connected to this project.
            </p>
            <Link
              href="/settings"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                'bg-blue-500 text-white hover:bg-blue-600 transition-colors'
              )}
            >
              <BarChart3 className="w-4 h-4" />
              Connect Analytics
            </Link>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex gap-3">
        <button
          onClick={onSave}
          className={cn(
            'px-6 py-2.5 rounded-lg text-sm font-medium',
            'bg-linear-to-r from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
            'border-2 border-[hsl(var(--gold-dark))]',
            'text-primary-foreground hover:opacity-90 transition-opacity'
          )}
        >
          Save Changes
        </button>
      </div>

      {/* Danger zone */}
      <div className="bg-card border border-destructive/30 rounded-xl p-4 md:p-6">
        <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Deleting this project will unassign all campaigns. The campaigns and their posts will not
          be deleted.
        </p>
        <button
          onClick={onDelete}
          className="px-4 py-2 rounded-lg border border-destructive text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
        >
          Delete Project
        </button>
      </div>
    </div>
  )
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
function BrandKitSection({
  editHashtags,
  setEditHashtags,
  editPrimaryColor,
  setEditPrimaryColor,
  editSecondaryColor,
  setEditSecondaryColor,
  editAccentColor,
  setEditAccentColor,
}: {
  editHashtags: string
  setEditHashtags: (v: string) => void
  editPrimaryColor: string
  setEditPrimaryColor: (v: string) => void
  editSecondaryColor: string
  setEditSecondaryColor: (v: string) => void
  editAccentColor: string
  setEditAccentColor: (v: string) => void
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-6">
      <h3 className="font-semibold mb-4">Brand Kit</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Hashtags <span className="text-muted-foreground font-normal">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={editHashtags}
            onChange={(e) => setEditHashtags(e.target.value)}
            placeholder="product, launch, marketing"
            maxLength={500}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg',
              'bg-background border border-border',
              'focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--gold))]/50 focus:border-[hsl(var(--gold))]'
            )}
          />
          {editHashtags && (
            <div className="flex flex-wrap gap-2 mt-2">
              {editHashtags.split(',').map((tag, i) => {
                const trimmed = tag.trim().replace(/^#/, '')
                if (!trimmed) return null
                return (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold-dark))] rounded-full"
                  >
                    #{trimmed}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Brand Colors</label>
          <div className="grid grid-cols-3 gap-4">
            <ColorInput label="Primary" value={editPrimaryColor} onChange={setEditPrimaryColor} />
            <ColorInput
              label="Secondary"
              value={editSecondaryColor}
              onChange={setEditSecondaryColor}
            />
            <ColorInput label="Accent" value={editAccentColor} onChange={setEditAccentColor} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className={cn(
            'flex-1 px-2 py-1 text-sm rounded-lg',
            'bg-background border border-border',
            'focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--gold))]/50'
          )}
        />
      </div>
    </div>
  )
}
