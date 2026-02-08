'use client'

import { useParams } from 'next/navigation'
import { BlogEditorForm } from '../BlogEditorForm'

export default function BlogEditorPage() {
  const { id } = useParams<{ id: string }>()

  return <BlogEditorForm draftId={id} newDraftRedirectPrefix="/blog/" />
}
