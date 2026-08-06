'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toBeijingDatetimeLocal, toBeijingISO } from '@/lib/time'
import { buildFeedingRecordPayload, getBreastModeFromType, getFeedingValidationMessage, type BreastMode, type FeedingFieldValues, type FeedingType } from '@/lib/feeding-records'
import { buildHealthRecordPayload, buildVaccineSuggestions, findSelectedVaccineSuggestion, type HealthFieldValues, type HealthType, type VaccineSuggestion } from '@/lib/health-records'
import FeedingRecordFields from '@/components/FeedingRecordFields'
import HealthRecordFields, { getHealthFieldValidationMessage } from '@/components/HealthRecordFields'
import RecordActionBar from '@/components/RecordActionBar'
import { RecordNotesField, RecordTimeField } from '@/components/RecordMetaFields'

interface FeedingRecord {
  id: string
  type: string
  startTime: string
  endTime?: string | null
  leftBreastDuration?: number | null
  rightBreastDuration?: number | null
  breastMilkAmount?: number | null
  formulaAmount?: number | null
  solidFoodName?: string | null
  solidFoodAmount?: string | null
  adGiven?: boolean | null
  notes?: string | null
  babyId: string
  recordType: 'feeding'
}

interface HealthRecord {
  id: string
  type: string
  recordedAt: string
  weight?: number | null
  height?: number | null
  temperature?: number | null
  medicationName?: string | null
  medicationDose?: string | null
  vaccineName?: string | null
  vaccineManufacturer?: string | null
  vaccineDoseNumber?: number | null
  vaccineTotalDoses?: number | null
  diaperType?: string | null
  diaperStatus?: string | null
  adGiven?: boolean | null
  sleepStartTime?: string | null
  sleepEndTime?: string | null
  sleepQuality?: string | null
  notes?: string | null
  babyId: string
  recordType: 'health'
}

type TimelineRecord = FeedingRecord | HealthRecord

interface Props {
  record: TimelineRecord
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
  saving: boolean
}

export default function TimelineEditRecordModal({ record, onSave, onCancel, saving }: Props) {
  const isFeeding = record.recordType === 'feeding'
  const feedingRecord = isFeeding ? (record as FeedingRecord) : null
  const healthRecord = !isFeeding ? (record as HealthRecord) : null
  const [currentFeedingType, setCurrentFeedingType] = useState<FeedingType>(
    feedingRecord ? (feedingRecord.type as FeedingType) : 'BREAST_MILK'
  )
  const [currentHealthType] = useState<HealthType>(
    healthRecord ? (healthRecord.type as HealthType) : 'WEIGHT'
  )

  const timeStr = isFeeding ? feedingRecord!.startTime : healthRecord!.recordedAt
  const [editTime, setEditTime] = useState(toBeijingDatetimeLocal(timeStr))
  const [editNotes, setEditNotes] = useState(record.notes || '')

  const [leftDuration, setLeftDuration] = useState(String(feedingRecord?.leftBreastDuration || ''))
  const [rightDuration, setRightDuration] = useState(String(feedingRecord?.rightBreastDuration || ''))
  const [breastMilkAmt, setBreastMilkAmt] = useState(String(feedingRecord?.breastMilkAmount || ''))
  const [formulaAmt, setFormulaAmt] = useState(String(feedingRecord?.formulaAmount || ''))
  const [solidFoodName, setSolidFoodName] = useState(feedingRecord?.solidFoodName || '')
  const [solidFoodAmount, setSolidFoodAmount] = useState(feedingRecord?.solidFoodAmount || '')
  const [breastMode, setBreastMode] = useState<BreastMode>(feedingRecord ? getBreastModeFromType(feedingRecord.type as FeedingType) : 'direct')

  const [weight, setWeight] = useState(String(healthRecord?.weight || ''))
  const [height, setHeight] = useState(String(healthRecord?.height || ''))
  const [temperature, setTemperature] = useState(String(healthRecord?.temperature || ''))
  const [medicationName, setMedicationName] = useState(healthRecord?.medicationName || '')
  const [medicationDose, setMedicationDose] = useState(healthRecord?.medicationDose || '')
  const [vaccineName, setVaccineName] = useState(healthRecord?.vaccineName || '')
  const [vaccineManufacturer, setVaccineManufacturer] = useState(healthRecord?.vaccineManufacturer || '')
  const [vaccineDoseNumber, setVaccineDoseNumber] = useState(String(healthRecord?.vaccineDoseNumber || ''))
  const [vaccineTotalDoses, setVaccineTotalDoses] = useState(String(healthRecord?.vaccineTotalDoses || ''))
  const [vaccineSuggestions, setVaccineSuggestions] = useState<VaccineSuggestion[]>([])
  const [vaccineSuggestionsLoading, setVaccineSuggestionsLoading] = useState(false)
  const [selectedVaccineSuggestionKey, setSelectedVaccineSuggestionKey] = useState('')
  const [diaperType, setDiaperType] = useState(healthRecord?.diaperType || 'PEE')
  const [diaperStatus, setDiaperStatus] = useState(healthRecord?.diaperStatus || '')
  const [adGiven, setAdGiven] = useState(healthRecord?.adGiven ?? true)
  const [sleepStartTime, setSleepStartTime] = useState(healthRecord?.sleepStartTime ? toBeijingDatetimeLocal(healthRecord.sleepStartTime) : '')
  const [sleepEndTime, setSleepEndTime] = useState(healthRecord?.sleepEndTime ? toBeijingDatetimeLocal(healthRecord.sleepEndTime) : '')
  const [sleepQuality, setSleepQuality] = useState(healthRecord?.sleepQuality || '')

  // When type is SLEEP, bind editTime to sleepEndTime
  const handleSleepEndTimeChange = (value: string) => {
    setSleepEndTime(value)
    if (value) {
      setEditTime(value)
    }
  }

  const fieldValues: HealthFieldValues = {
    weight,
    height,
    temperature,
    medicationName,
    medicationDose,
    vaccineName,
    vaccineManufacturer,
    vaccineDoseNumber,
    vaccineTotalDoses,
    diaperType: diaperType as 'PEE' | 'POOP' | 'BOTH',
    diaperStatus,
    adGiven,
    sleepStartTime,
    sleepEndTime,
    sleepQuality,
  }

  const feedingFieldValues: FeedingFieldValues = {
    leftBreastDuration: leftDuration,
    rightBreastDuration: rightDuration,
    breastMilkAmount: breastMilkAmt,
    formulaAmount: formulaAmt,
    solidFoodName,
    solidFoodAmount,
  }

  useEffect(() => {
    if (isFeeding || currentHealthType !== 'VACCINE') {
      setVaccineSuggestions([])
      setVaccineSuggestionsLoading(false)
      return
    }

    let cancelled = false

    const fetchVaccineSuggestions = async () => {
      setVaccineSuggestionsLoading(true)

      try {
        const response = await fetch(`/api/health?babyId=${record.babyId}&type=VACCINE`)
        if (!response.ok) {
          throw new Error('获取疫苗记录失败')
        }

        const data = await response.json()
        if (!Array.isArray(data) || cancelled) {
          return
        }

        setVaccineSuggestions(buildVaccineSuggestions(data, { excludeRecordId: record.id }))
      } catch (error) {
        console.error('获取疫苗快捷候选失败:', error)
        if (!cancelled) {
          setVaccineSuggestions([])
        }
      } finally {
        if (!cancelled) {
          setVaccineSuggestionsLoading(false)
        }
      }
    }

    fetchVaccineSuggestions()

    return () => {
      cancelled = true
    }
  }, [currentHealthType, isFeeding, record])

  useEffect(() => {
    if (isFeeding || currentHealthType !== 'VACCINE') {
      setSelectedVaccineSuggestionKey('')
      return
    }

    const matchedSuggestion = findSelectedVaccineSuggestion(vaccineSuggestions, {
      vaccineName,
      vaccineManufacturer,
      vaccineDoseNumber,
      vaccineTotalDoses,
    })

    setSelectedVaccineSuggestionKey(matchedSuggestion?.key || '')
  }, [currentHealthType, isFeeding, vaccineDoseNumber, vaccineManufacturer, vaccineName, vaccineSuggestions, vaccineTotalDoses])

  const validationMessage = isFeeding
    ? ''
    : getHealthFieldValidationMessage(currentHealthType, fieldValues)

  const handleApplyVaccineSuggestion = (suggestion: VaccineSuggestion) => {
    setVaccineName(suggestion.vaccineName)
    setVaccineManufacturer(suggestion.vaccineManufacturer)
    setVaccineDoseNumber(String(suggestion.nextDoseNumber))
    setVaccineTotalDoses(String(suggestion.totalDoses))
  }

  const feedingValidationMessage = isFeeding
    ? getFeedingValidationMessage(currentFeedingType, feedingFieldValues)
    : ''

  const resolvedValidationMessage = isFeeding ? feedingValidationMessage : validationMessage

  const handleSave = () => {
    if (resolvedValidationMessage) {
      return
    }

    const timeISO = toBeijingISO(editTime)
    const data: Record<string, unknown> = {
      type: isFeeding ? currentFeedingType : currentHealthType,
      notes: editNotes || null,
    }

    if (isFeeding) {
      data.startTime = timeISO
      Object.assign(data, buildFeedingRecordPayload(currentFeedingType, feedingFieldValues))
    } else {
      data.recordedAt = timeISO
      Object.assign(data, buildHealthRecordPayload(currentHealthType, fieldValues))
    }

    onSave(data)
  }

  const getTypeLabel = () => {
    const activeType = isFeeding ? currentFeedingType : currentHealthType

    switch (activeType) {
      case 'BREAST_MILK':
        return '母乳亲喂'
      case 'BREAST_MILK_BOTTLE':
        return '母乳瓶喂'
      case 'FORMULA':
        return '奶粉喂养'
      case 'SOLID_FOOD':
        return '辅食'
      case 'AD_VITAMIN':
        return 'AD滴剂'
      case 'WEIGHT':
        return '体重'
      case 'HEIGHT':
        return '身高'
      case 'TEMPERATURE':
        return '体温'
      case 'MEDICATION':
        return '服药'
      case 'VACCINE':
        return '疫苗'
      case 'DIAPER':
        return '大小便'
      default:
        return '记录'
    }
  }




  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onCancel}>
      <div
        className="mobile-sheet w-full max-w-lg overflow-y-auto bg-white px-4 pt-3 shadow-xl sm:rounded-2xl sm:px-5 sm:pt-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-white/95 px-4 pb-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-4">
          <h3 className="text-lg font-bold text-gray-900">编辑{getTypeLabel()}</h3>
          <button type="button" onClick={onCancel} className="mobile-touch-target inline-flex items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-4">
          {(!healthRecord || currentHealthType !== 'SLEEP') ? (
            <RecordTimeField
              mode="edit"
              value={editTime}
              onChange={setEditTime}
            />
          ) : null}

          {isFeeding ? (
            <FeedingRecordFields
              type={currentFeedingType}
              breastMode={breastMode}
              mode="edit"
              values={feedingFieldValues}
              setters={{
                setType: (nextType) => {
                  setCurrentFeedingType(nextType)
                  setBreastMode(getBreastModeFromType(nextType))
                },
                setBreastMode,
                setLeftBreastDuration: setLeftDuration,
                setRightBreastDuration: setRightDuration,
                setBreastMilkAmount: setBreastMilkAmt,
                setFormulaAmount: setFormulaAmt,
                setSolidFoodName,
                setSolidFoodAmount,
              }}
            />
          ) : (
            <HealthRecordFields
              type={currentHealthType}
              mode="edit"
              validationMessage={validationMessage}
              vaccineSuggestions={vaccineSuggestions}
              vaccineSuggestionsLoading={vaccineSuggestionsLoading}
              selectedVaccineSuggestionKey={selectedVaccineSuggestionKey}
              onApplyVaccineSuggestion={handleApplyVaccineSuggestion}
              values={fieldValues}
              setters={{
                setWeight,
                setHeight,
                setTemperature,
                setMedicationName,
                setMedicationDose,
                setVaccineName,
                setVaccineManufacturer,
                setVaccineDoseNumber,
                setVaccineTotalDoses,
                setDiaperType: (value) => setDiaperType(value),
                setDiaperStatus,
                setAdGiven,
                setSleepStartTime,
                setSleepEndTime: handleSleepEndTimeChange,
                setSleepQuality,
              }}
            />
          )}

          <RecordNotesField
            mode="edit"
            label="备注"
            value={editNotes}
            onChange={setEditNotes}
            rows={3}
          />

          <RecordActionBar
            mode="edit"
            validationMessage={resolvedValidationMessage}
            primaryLabel="保存"
            loadingLabel="保存中..."
            loading={saving}
            disabled={!!resolvedValidationMessage}
            onPrimaryClick={handleSave}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  )
}
