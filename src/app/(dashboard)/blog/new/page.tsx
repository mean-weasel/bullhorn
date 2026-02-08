'use client'

import { BlogEditorForm } from '../BlogEditorForm'

export default function NewBlogEditorPage() {
  return <BlogEditorForm newDraftRedirectPrefix="/blog/" />
}
