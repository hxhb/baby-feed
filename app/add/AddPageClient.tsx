'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import FeedingForm from '@/components/FeedingForm'
import HealthForm from '@/components/HealthForm'
import type { PreloadedBaby } from '@/lib/server-babies'

interface Props {
  initialBabies: PreloadedBaby[]
}

type AddRecordSharedDraft = {
  babyId: string
  eventTime: string
  notes: string
}

type HealthInitialType = 'WEIGHT' | 'HEIGHT' | 'TEMPERATURE' | 'MEDICATION' | 'VACCINE' | 'DIAPER' | 'AD_VITAMIN' | 'SLEEP'

const SHARED_DRAFT_STORAGE_KEY = 'baby-feed:add-record-shared-draft'
const emptySharedDraft: AddRecordSharedDraft = {
  babyId: '',
  eventTime: '',
  notes: ''
}

function getHealthInitialType(type: string | null): HealthInitialType | undefined {
  switch (type) {
    case 'weight':
      return 'WEIGHT'
    case 'height':
      return 'HEIGHT'
    case 'temperature':
      return 'TEMPERATURE'
    case 'medication':
      return 'MEDICATION'
    case 'vaccine':
      return 'VACCINE'
    case 'diaper':
      return 'DIAPER'
    case 'ad':
      return 'AD_VITAMIN'
    case 'sleep':
      return 'SLEEP'
    default:
      return undefined
  }
}

function isEmptySharedDraft(draft: AddRecordSharedDraft) {
  return !draft.babyId && !draft.eventTime && !draft.notes
}

export default function AddPageClient({ initialBabies }: Props) {
  const searchParams = useSearchParams()
  const type = searchParams.get('type')
  const isHealthView = !type || ['health', 'weight', 'height', 'temperature', 'medication', 'vaccine', 'diaper', 'ad', 'sleep'].includes(type)
  const [sharedDraft, setSharedDraft] = useState<AddRecordSharedDraft>(emptySharedDraft)

  useEffect(() => {
    try {
      const rawDraft = window.sessionStorage.getItem(SHARED_DRAFT_STORAGE_KEY)
      if (!rawDraft) {
        return
      }

      const parsedDraft = JSON.parse(rawDraft) as Partial<AddRecordSharedDraft>
      setSharedDraft({
        babyId: typeof parsedDraft.babyId === 'string' ? parsedDraft.babyId : '',
        eventTime: typeof parsedDraft.eventTime === 'string' ? parsedDraft.eventTime : '',
        notes: typeof parsedDraft.notes === 'string' ? parsedDraft.notes : ''
      })
    } catch (error) {
      console.error('读取添加记录草稿失败:', error)
    }
  }, [])

  useEffect(() => {
    try {
      if (isEmptySharedDraft(sharedDraft)) {
        window.sessionStorage.removeItem(SHARED_DRAFT_STORAGE_KEY)
        return
      }

      window.sessionStorage.setItem(SHARED_DRAFT_STORAGE_KEY, JSON.stringify(sharedDraft))
    } catch (error) {
      console.error('保存添加记录草稿失败:', error)
    }
  }, [sharedDraft])

  const handleSharedDraftChange = useCallback((nextDraft: AddRecordSharedDraft) => {
    setSharedDraft(currentDraft => {
      if (
        currentDraft.babyId === nextDraft.babyId &&
        currentDraft.eventTime === nextDraft.eventTime &&
        currentDraft.notes === nextDraft.notes
      ) {
        return currentDraft
      }

      return nextDraft
    })
  }, [])

  const handleRecordSaved = useCallback(() => {
    setSharedDraft(emptySharedDraft)
    window.sessionStorage.removeItem(SHARED_DRAFT_STORAGE_KEY)
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-2.5 py-3 sm:px-4 sm:py-5">
      {isHealthView ? (
        <HealthForm
          initialType={getHealthInitialType(type)}
          initialBabies={initialBabies}
          initialSharedDraft={sharedDraft}
          onSharedDraftChange={handleSharedDraftChange}
          onRecordSaved={handleRecordSaved}
        />
      ) : (
        <FeedingForm
          initialType={type as 'breast' | 'breast_bottle' | 'formula' | 'solid_food' | null}
          initialBabies={initialBabies}
          initialSharedDraft={sharedDraft}
          onSharedDraftChange={handleSharedDraftChange}
          onRecordSaved={handleRecordSaved}
        />
      )}
    </div>
  )
}
