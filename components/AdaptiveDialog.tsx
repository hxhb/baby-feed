'use client'

import { forwardRef, type ReactNode } from 'react'

interface AdaptiveDialogProps {
  children: ReactNode
  labelledBy: string
  describedBy?: string
  onDismiss: () => void
  overlay?: ReactNode
  maxWidthClassName?: string
  panelClassName?: string
  zIndexClassName?: string
}

const AdaptiveDialog = forwardRef<HTMLDivElement, AdaptiveDialogProps>(function AdaptiveDialog({
  children,
  labelledBy,
  describedBy,
  onDismiss,
  overlay,
  maxWidthClassName = 'sm:max-w-[760px]',
  panelClassName = '',
  zIndexClassName = 'z-[80]',
}, ref) {
  return (
    <div
      className={`fixed inset-0 ${zIndexClassName} flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-6`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] animate-[composer-enter_200ms_ease-out] sm:max-h-[80dvh] sm:rounded-xl ${maxWidthClassName} ${panelClassName}`}
      >
        {children}
      </div>
      {overlay}
    </div>
  )
})

export default AdaptiveDialog
