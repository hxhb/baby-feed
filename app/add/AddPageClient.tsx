'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import FeedingForm from '@/components/FeedingForm'
import HealthForm from '@/components/HealthForm'
import MemoForm from '@/components/MemoForm'
import type { PreloadedBaby } from '@/lib/server-babies'
import type { ActiveTab } from '@/components/RecordTabBar'

interface Props {
  initialBabies: PreloadedBaby[]
  activeBabyId: string | null
}

type AddRecordSharedDraft = {
  babyId: string
  eventTime: string
  notes: string
}

type HealthInitialType = 'WEIGHT' | 'HEIGHT' | 'TEMPERATURE' | 'MEDICATION' | 'VACCINE' | 'DIAPER' | 'AD_VITAMIN' | 'SLEEP' | 'TOOTH_ERUPTION' | 'CUSTOM'

const SHARED_DRAFT_STORAGE_KEY = 'baby-feed:add-record-shared-draft'
const emptySharedDraft: AddRecordSharedDraft = {
  babyId: '',
  eventTime: '',
  notes: ''
}

function getHealthInitialType(type: string | null): HealthInitialType | undefined {
  switch (type) {
    case 'weight': return 'WEIGHT'
    case 'height': return 'HEIGHT'
    case 'temperature': return 'TEMPERATURE'
    case 'medication': return 'MEDICATION'
    case 'vaccine': return 'VACCINE'
    case 'diaper': return 'DIAPER'
    case 'ad': return 'AD_VITAMIN'
    case 'sleep': return 'SLEEP'
    case 'teething': return 'TOOTH_ERUPTION'
    case 'custom': return 'CUSTOM'
    default: return undefined
  }
}

function isEmptySharedDraft(draft: AddRecordSharedDraft) {
  return !draft.babyId && !draft.eventTime && !draft.notes
}

function getActiveTab(type: string | null): ActiveTab {
  if (type === 'memo') return 'memo'
  if (!type || ['breast', 'breast_bottle', 'formula', 'solid_food'].includes(type)) return 'feeding'
  return 'health'
}

export default function AddPageClient({ initialBabies, activeBabyId }: Props) {
  const searchParams = useSearchParams()
  const type = searchParams.get('type')
  const [activeTab, setActiveTab] = useState<ActiveTab>(getActiveTab(type))
  const resolvedBabyId = activeBabyId || (initialBabies.length > 0 ? initialBabies[0].id : '')
  const [sharedDraft, setSharedDraft] = useState<AddRecordSharedDraft>({ ...emptySharedDraft, babyId: resolvedBabyId })

  useEffect(() => {
    try {
      const rawDraft = window.sessionStorage.getItem(SHARED_DRAFT_STORAGE_KEY)
      if (!rawDraft) return

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

  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab)
    const href = tab === 'feeding' ? '/add?type=breast' : tab === 'health' ? '/add?type=health' : '/add?type=memo'
    window.history.replaceState(null, '', href)
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-2.5 py-3 sm:px-4 sm:py-5">
      {activeTab === 'memo' ? (
        <MemoForm
          initialBabies={initialBabies}
          initialSharedDraft={sharedDraft}
          onSharedDraftChange={handleSharedDraftChange}
          onRecordSaved={handleRecordSaved}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      ) : activeTab === 'health' ? (
        <HealthForm
          initialType={getHealthInitialType(type)}
          initialBabies={initialBabies}
          initialSharedDraft={sharedDraft}
          onSharedDraftChange={handleSharedDraftChange}
          onRecordSaved={handleRecordSaved}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      ) : (
        <FeedingForm
          initialType={type as 'breast' | 'breast_bottle' | 'formula' | 'solid_food' | null}
          initialBabies={initialBabies}
          initialSharedDraft={sharedDraft}
          onSharedDraftChange={handleSharedDraftChange}
          onRecordSaved={handleRecordSaved}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}
    </div>
  )
}
