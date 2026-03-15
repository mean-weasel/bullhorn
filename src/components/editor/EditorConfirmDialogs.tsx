'use client'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface EditorConfirmDialogsProps {
  showDeleteConfirm: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
  showArchiveConfirm: boolean
  onConfirmArchive: () => void
  onCancelArchive: () => void
  showPlatformSwitchConfirm: boolean
  onConfirmPlatformSwitch: () => void
  onCancelPlatformSwitch: () => void
  showLeaveConfirm: boolean
  onConfirmLeave: () => void
  onCancelLeave: () => void
}

export function EditorConfirmDialogs(props: EditorConfirmDialogsProps) {
  return (
    <>
      <ConfirmDialog
        open={props.showDeleteConfirm}
        onConfirm={props.onConfirmDelete}
        onCancel={props.onCancelDelete}
        title="Delete this post?"
        description="This action cannot be undone. The post will be permanently removed."
        confirmText="Delete"
        cancelText="Keep"
        variant="danger"
      />
      <ConfirmDialog
        open={props.showArchiveConfirm}
        onConfirm={props.onConfirmArchive}
        onCancel={props.onCancelArchive}
        title="Archive this post?"
        description="The post will be moved to your archive. You can restore it later or delete it permanently."
        confirmText="Archive"
        cancelText="Cancel"
      />
      <ConfirmDialog
        open={props.showPlatformSwitchConfirm}
        onConfirm={props.onConfirmPlatformSwitch}
        onCancel={props.onCancelPlatformSwitch}
        title="Switch platform?"
        description="Switching platforms will reset some content. Your text will be preserved, but platform-specific settings will be cleared."
        confirmText="Switch"
        cancelText="Cancel"
      />
      <ConfirmDialog
        open={props.showLeaveConfirm}
        onConfirm={props.onConfirmLeave}
        onCancel={props.onCancelLeave}
        title="Leave without saving?"
        description="You have unsaved changes that will be lost."
        confirmText="Leave"
        cancelText="Stay"
        variant="danger"
      />
    </>
  )
}
