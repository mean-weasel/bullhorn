'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, FileText, FolderOpen, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export function WelcomeModal() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    if (process.env.NEXT_PUBLIC_E2E_TEST_MODE === 'true') return false
    return !localStorage.getItem('onboarding_complete')
  })

  const handleDismiss = () => {
    localStorage.setItem('onboarding_complete', 'true')
    setVisible(false)
  }

  if (!visible) return null

  const steps = [
    {
      icon: FileText,
      title: 'Draft your posts',
      description:
        'Write content for Twitter, LinkedIn, and Reddit with platform-specific formatting.',
    },
    {
      icon: FolderOpen,
      title: 'Organize with campaigns',
      description: 'Group related posts into campaigns and projects for easy management.',
    },
    {
      icon: Calendar,
      title: 'Schedule & track',
      description: 'Set publish dates and track your content pipeline from draft to published.',
    },
  ]

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div
        className={cn(
          'w-full max-w-md',
          'bg-card rounded-lg',
          'border-[3px] border-border',
          'shadow-[6px_6px_0_hsl(var(--border))]',
          'p-6 relative'
        )}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 rounded hover:bg-secondary transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📢</div>
          <h2 className="text-xl font-extrabold">Welcome to Bullhorn</h2>
          <p className="text-sm text-muted-foreground mt-1">Your social media command center</p>
        </div>

        <div className="space-y-4 mb-6">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className={cn(
                  'w-8 h-8 rounded-md shrink-0',
                  'bg-primary/10 flex items-center justify-center',
                  'border-2 border-primary/30'
                )}
              >
                <step.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/new"
          onClick={handleDismiss}
          className={cn(
            'block w-full text-center px-4 py-3 rounded-md',
            'bg-primary text-primary-foreground font-bold',
            'border-[3px] border-border',
            'shadow-sticker-sm',
            'hover:-translate-y-px hover:shadow-sticker',
            'transition-all'
          )}
        >
          Create Your First Post
        </Link>

        <button
          onClick={handleDismiss}
          className="w-full text-center text-sm text-muted-foreground font-medium mt-3 hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
