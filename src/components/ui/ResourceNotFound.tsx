'use client'

import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

interface ResourceNotFoundProps {
  type: string
  listUrl: string
  listLabel: string
}

export function ResourceNotFound({ type, listUrl, listLabel }: ResourceNotFoundProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <FileQuestion className="w-16 h-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-bold mb-2">{type} not found</h2>
      <p className="text-muted-foreground mb-6">
        This {type.toLowerCase()} doesn&apos;t exist or was deleted.
      </p>
      <Link
        href={listUrl}
        className="sticker-button px-6 py-2.5 bg-primary text-primary-foreground font-bold"
      >
        Go to {listLabel}
      </Link>
    </div>
  )
}
