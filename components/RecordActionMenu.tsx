'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  ariaLabel?: string
  deleteDisabled?: boolean
}

export default function RecordActionMenu({
  open,
  onOpenChange,
  onEdit,
  onDelete,
  ariaLabel = '记录操作',
  deleteDisabled = false,
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [openUpward, setOpenUpward] = useState(false)

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return

    const updatePlacement = () => {
      if (!buttonRef.current || !menuRef.current) return

      const triggerRect = buttonRef.current.getBoundingClientRect()
      const menuHeight = menuRef.current.getBoundingClientRect().height
      const mobileNavigation = document.querySelector<HTMLElement>('[data-mobile-bottom-navigation]')
      const navigationRect = mobileNavigation?.getBoundingClientRect()
      const viewportBottom = window.visualViewport
        ? window.visualViewport.offsetTop + window.visualViewport.height
        : window.innerHeight
      const unobstructedBottom = navigationRect && navigationRect.height > 0
        ? Math.min(viewportBottom, navigationRect.top)
        : viewportBottom
      const spaceBelow = unobstructedBottom - triggerRect.bottom
      const spaceAbove = triggerRect.top - (window.visualViewport?.offsetTop || 0)
      const requiredSpace = menuHeight + 4

      setOpenUpward(spaceBelow < requiredSpace && (spaceAbove >= requiredSpace || spaceAbove > spaceBelow))
    }

    updatePlacement()
    window.addEventListener('resize', updatePlacement)
    window.visualViewport?.addEventListener('resize', updatePlacement)

    return () => {
      window.removeEventListener('resize', updatePlacement)
      window.visualViewport?.removeEventListener('resize', updatePlacement)
    }
  }, [open])

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="mobile-touch-target inline-flex items-center justify-center rounded-element p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          data-menu-placement={openUpward ? 'top' : 'bottom'}
          className={`absolute right-0 z-[60] min-w-[112px] rounded-element border border-slate-100 bg-white py-1 shadow-elevated ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenChange(false)
              onEdit()
            }}
            className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:bg-slate-50"
          >
            <Pencil size={14} aria-hidden="true" />
            编辑
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={deleteDisabled}
            onClick={() => {
              if (deleteDisabled) return
              onOpenChange(false)
              onDelete()
            }}
            className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={14} aria-hidden="true" />
            删除
          </button>
        </div>
      ) : null}
    </div>
  )
}
