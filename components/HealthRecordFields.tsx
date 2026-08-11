'use client'

import type { HealthFieldValues, HealthType, DiaperType, VaccineSuggestion } from '@/lib/health-records'
import ToothEruptionFields from '@/components/ToothEruptionFields'
import type { PrimaryToothCode } from '@/lib/tooth-eruptions'

interface HealthFieldSetters {
  setWeight: (value: string) => void
  setHeight: (value: string) => void
  setTemperature: (value: string) => void
  setMedicationName: (value: string) => void
  setMedicationDose: (value: string) => void
  setVaccineName: (value: string) => void
  setVaccineManufacturer: (value: string) => void
  setVaccineDoseNumber: (value: string) => void
  setVaccineTotalDoses: (value: string) => void
  setDiaperType: (value: DiaperType) => void
  setDiaperStatus: (value: string) => void
  setAdGiven: (value: boolean) => void
  setVitaminDGiven: (value: boolean) => void
  setCustomName: (value: string) => void
  setSleepStartTime: (value: string) => void
  setSleepEndTime: (value: string) => void
  setSleepQuality: (value: string) => void
  setToothCodes: (value: PrimaryToothCode[]) => void
}

interface Props {
  type: HealthType
  values: HealthFieldValues
  setters: HealthFieldSetters
  validationMessage?: string
  vaccineSuggestions?: VaccineSuggestion[]
  vaccineSuggestionsLoading?: boolean
  selectedVaccineSuggestionKey?: string
  onApplyVaccineSuggestion?: (suggestion: VaccineSuggestion) => void
  mode?: 'create' | 'edit'
  babyId?: string
  recordedAt?: string
  currentRecordId?: string
}

export function getHealthFieldValidationMessage(type: HealthType, values: HealthFieldValues) {
  if (type === 'WEIGHT' && !(parseFloat(values.weight) > 0)) {
    return '请填写有效的体重'
  }

  if (type === 'HEIGHT' && !(parseFloat(values.height) > 0)) {
    return '请填写有效的身高'
  }

  if (type === 'TEMPERATURE') {
    const parsedTemperature = parseFloat(values.temperature)
    if (!(parsedTemperature >= 35 && parsedTemperature <= 42)) {
      return '请填写 35°C 到 42°C 之间的体温'
    }
  }

  if (type === 'MEDICATION' && !values.medicationName.trim()) {
    return '请填写药物名称'
  }

  if (type === 'VACCINE' && !values.vaccineName.trim()) {
    return '请填写疫苗名称'
  }

  if (type === 'VACCINE') {
    const parsedDoseNumber = Number.parseInt(values.vaccineDoseNumber, 10)
    const parsedTotalDoses = Number.parseInt(values.vaccineTotalDoses, 10)

    if (!(parsedDoseNumber >= 1)) {
      return '请填写有效的当前针次'
    }

    if (!(parsedTotalDoses >= 1)) {
      return '请填写有效的总针数'
    }

    if (parsedDoseNumber > parsedTotalDoses) {
      return '当前针次不能大于总针数'
    }
  }

  if (type === 'AD_VITAMIN' && !values.adGiven && !values.vitaminDGiven) {
    return '请至少选择 AD 或维生素D'
  }

  if (type === 'CUSTOM' && !values.customName.trim()) {
    return '请输入记录名称'
  }

  if (type === 'SLEEP' && !values.sleepStartTime) {
    return '请填写入睡时间'
  }

  if (type === 'SLEEP' && values.sleepStartTime && values.sleepEndTime) {
    const start = new Date(values.sleepStartTime).getTime()
    const end = new Date(values.sleepEndTime).getTime()
    if (end <= start) {
      return '醒来时间必须晚于入睡时间'
    }
  }

  if (type === 'TOOTH_ERUPTION' && values.toothCodes.length === 0) {
    return '请至少选择一颗长出的牙齿'
  }

  return ''
}

function formatSuggestionTime(value: string) {
  const date = new Date(value)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function HealthRecordFields({
  type,
  values,
  setters,
  validationMessage = '',
  vaccineSuggestions = [],
  vaccineSuggestionsLoading = false,
  selectedVaccineSuggestionKey = '',
  onApplyVaccineSuggestion,
  mode = 'create',
  babyId,
  recordedAt,
  currentRecordId,
}: Props) {
  const showWeightError = type === 'WEIGHT' && !!validationMessage
  const showHeightError = type === 'HEIGHT' && !!validationMessage
  const showTemperatureError = type === 'TEMPERATURE' && !!validationMessage
  const showMedicationNameError = type === 'MEDICATION' && !!validationMessage
  const showVaccineNameError = type === 'VACCINE' && !!validationMessage
  const showVaccineSuggestions = (vaccineSuggestionsLoading || vaccineSuggestions.length > 0) && !!onApplyVaccineSuggestion
  const cardClassName = mode === 'create' ? 'rounded-2xl bg-gray-50/70 p-3' : 'space-y-3'

  if (type === 'TOOTH_ERUPTION') {
    return (
      <ToothEruptionFields
        babyId={babyId}
        recordedAt={recordedAt}
        selectedCodes={values.toothCodes}
        onChange={setters.setToothCodes}
        currentRecordId={currentRecordId}
        validationMessage={validationMessage}
      />
    )
  }

  if (type === 'WEIGHT') {
    return (
      <div className={cardClassName}>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          体重（千克）
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={values.weight}
          onChange={(e) => setters.setWeight(e.target.value)}
          min="0"
          step="0.01"
          aria-invalid={showWeightError}
          aria-describedby={showWeightError ? 'health-weight-error' : undefined}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
          placeholder="例如：3.5"
        />
        {showWeightError ? (
          <p id="health-weight-error" className="mt-1.5 text-sm text-red-600">
            请填写有效的体重
          </p>
        ) : null}
      </div>
    )
  }

  if (type === 'HEIGHT') {
    return (
      <div className={cardClassName}>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          身高（厘米）
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={values.height}
          onChange={(e) => setters.setHeight(e.target.value)}
          min="0"
          step="0.1"
          aria-invalid={showHeightError}
          aria-describedby={showHeightError ? 'health-height-error' : undefined}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
          placeholder="例如：50"
        />
        {showHeightError ? (
          <p id="health-height-error" className="mt-1.5 text-sm text-red-600">
            请填写有效的身高
          </p>
        ) : null}
      </div>
    )
  }

  if (type === 'TEMPERATURE') {
    return (
      <div className={cardClassName}>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          体温（摄氏度）
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={values.temperature}
          onChange={(e) => setters.setTemperature(e.target.value)}
          min="35"
          max="42"
          step="0.1"
          aria-invalid={showTemperatureError}
          aria-describedby={showTemperatureError ? 'health-temperature-error' : undefined}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
          placeholder="例如：36.5"
        />
        {showTemperatureError ? (
          <p id="health-temperature-error" className="mt-1.5 text-sm text-red-600">
            请填写 35°C 到 42°C 之间的体温
          </p>
        ) : null}
      </div>
    )
  }

  if (type === 'MEDICATION') {
    return (
      <div className={mode === 'create' ? 'grid gap-2.5 sm:grid-cols-2' : 'space-y-3'}>
        <div className={mode === 'create' ? 'rounded-2xl bg-gray-50/70 p-3' : ''}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            药物名称
          </label>
          <input
            type="text"
            value={values.medicationName}
            onChange={(e) => setters.setMedicationName(e.target.value)}
            aria-invalid={showMedicationNameError}
            aria-describedby={showMedicationNameError ? 'health-medication-name-error' : undefined}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
            placeholder="例如：布洛芬"
          />
          {showMedicationNameError ? (
            <p id="health-medication-name-error" className="mt-1.5 text-sm text-red-600">
              请填写药物名称
            </p>
          ) : null}
        </div>
        <div className={mode === 'create' ? 'rounded-2xl bg-gray-50/70 p-3' : ''}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            剂量（可选）
          </label>
          <input
            type="text"
            value={values.medicationDose}
            onChange={(e) => setters.setMedicationDose(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
            placeholder="例如：2ml"
          />
        </div>
      </div>
    )
  }

  if (type === 'VACCINE') {
    return (
      <div className={mode === 'create' ? 'rounded-2xl bg-gray-50/70 p-3' : 'space-y-3'}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              疫苗名称
            </label>
            <p className="text-xs text-gray-500">
              支持从已打过但尚未完成的多针疫苗中一键带出下一针信息。
            </p>
          </div>
          {showVaccineSuggestions && vaccineSuggestions.length > 0 ? (
            <span className="shrink-0 rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-medium text-teal-700">
              {vaccineSuggestions.length} 个快捷项
            </span>
          ) : null}
        </div>
        {showVaccineSuggestions && vaccineSuggestionsLoading ? (
          <div className="mt-3 rounded-2xl border border-dashed border-teal-200 bg-white/80 px-3 py-2.5 text-xs text-gray-500">
            正在整理已打过的多针疫苗...
          </div>
        ) : null}
        {showVaccineSuggestions && !vaccineSuggestionsLoading && vaccineSuggestions.length > 0 ? (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium text-gray-500">快捷添加下一针</p>
            <div className="grid gap-2">
              {vaccineSuggestions.map((suggestion) => {
                const isSelected = selectedVaccineSuggestionKey === suggestion.key
                return (
                  <button
                    key={suggestion.key}
                    type="button"
                    onClick={() => onApplyVaccineSuggestion?.(suggestion)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50 shadow-sm'
                        : 'border-teal-100 bg-white hover:border-teal-200 hover:bg-teal-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-gray-900">
                          {suggestion.vaccineName}
                          {suggestion.vaccineManufacturer ? `（${suggestion.vaccineManufacturer}）` : ''}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          最近一针记录于 {formatSuggestionTime(suggestion.latestRecordedAt)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        isSelected ? 'bg-white text-teal-700' : 'bg-teal-50 text-teal-700'
                      }`}>
                        下一针：第{suggestion.nextDoseNumber}/{suggestion.totalDoses}针
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
        <div className={mode === 'create' ? 'mt-3' : ''}>
          <input
            type="text"
            value={values.vaccineName}
            onChange={(e) => setters.setVaccineName(e.target.value)}
            aria-invalid={showVaccineNameError}
            aria-describedby={showVaccineNameError ? 'health-vaccine-name-error' : undefined}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
            placeholder="例如：乙肝疫苗"
          />
        </div>
        {showVaccineNameError ? (
          <p id="health-vaccine-name-error" className="mt-1.5 text-sm text-red-600">
            请填写疫苗名称
          </p>
        ) : null}
        <div className={mode === 'create' ? 'mt-3' : ''}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            生产厂商（可选）
          </label>
          <input
            type="text"
            value={values.vaccineManufacturer}
            onChange={(e) => setters.setVaccineManufacturer(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
            placeholder="例如：北京生物"
          />
        </div>
        <div className={`${mode === 'create' ? 'mt-3 ' : ''}grid gap-2.5 sm:grid-cols-2`}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              当前第几针
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={values.vaccineDoseNumber}
              onChange={(e) => setters.setVaccineDoseNumber(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="例如：1"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              总共几针
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={values.vaccineTotalDoses}
              onChange={(e) => setters.setVaccineTotalDoses(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="例如：3"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          可同时记录疫苗名称、生产厂商和针次进度，后续回看会更完整。
        </p>
      </div>
    )
  }

  if (type === 'DIAPER') {
    const diaperOptions: { value: DiaperType; label: string; icons: string[] }[] = [
      { value: 'PEE', label: '小便', icons: ['💧'] },
      { value: 'POOP', label: '大便', icons: ['💩'] },
      { value: 'BOTH', label: '都有', icons: ['💧', '💩'] },
    ]
    return (
      <div className="space-y-2.5">
        <div className="grid grid-cols-3 gap-2">
          {diaperOptions.map((option) => {
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={values.diaperType === option.value}
                onClick={() => setters.setDiaperType(option.value)}
                className={`mobile-touch-target ${mode === 'create' ? 'min-h-[78px] ' : ''}rounded-lg border px-2 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  values.diaperType === option.value
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="flex h-5 items-center justify-center gap-0.5" aria-hidden="true">
                  {option.icons.map(icon => (
                    <span key={icon} className={`${option.icons.length > 1 ? 'text-[15px]' : 'text-[18px]'} leading-none`}>{icon}</span>
                  ))}
                </span>
                <span className={`mt-1 block text-xs ${values.diaperType === option.value ? 'font-medium text-amber-700' : 'text-gray-600'}`}>
                  {option.label}
                </span>
              </button>
            )
          })}
        </div>
        <div className={mode === 'create' ? 'rounded-2xl bg-gray-50/70 p-3' : ''}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            状态（可选）
          </label>
          <input
            type="text"
            value={values.diaperStatus}
            onChange={(e) => setters.setDiaperStatus(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
            placeholder="例如：正常、稀便等"
          />
        </div>
      </div>
    )
  }

  if (type === 'SLEEP') {
    const showSleepError = !!validationMessage

    // Calculate current duration from start and end time
    const currentDurationMinutes = (() => {
      if (!values.sleepStartTime || !values.sleepEndTime) return 0
      const start = new Date(values.sleepStartTime).getTime()
      const end = new Date(values.sleepEndTime).getTime()
      if (end <= start) return 0
      return Math.round((end - start) / (60 * 1000))
    })()

    const durationPresets = [
      { label: '30分钟', minutes: 30 },
      { label: '1小时', minutes: 60 },
      { label: '1.5小时', minutes: 90 },
      { label: '2小时', minutes: 120 },
      { label: '3小时', minutes: 180 },
      { label: '整晚', minutes: 600 },
    ]

    const handleDurationSelect = (minutes: number) => {
      if (!values.sleepStartTime) return
      const start = new Date(values.sleepStartTime)
      const end = new Date(start.getTime() + minutes * 60 * 1000)
      // Format to datetime-local string (YYYY-MM-DDTHH:MM)
      const pad = (n: number) => String(n).padStart(2, '0')
      const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`
      setters.setSleepEndTime(endStr)
    }

    const handleCustomDuration = (value: string) => {
      const minutes = parseInt(value, 10)
      if (minutes > 0 && values.sleepStartTime) {
        handleDurationSelect(minutes)
      } else if (!value) {
        setters.setSleepEndTime('')
      }
    }

    const formatDurationDisplay = (minutes: number) => {
      if (minutes <= 0) return ''
      const h = Math.floor(minutes / 60)
      const m = minutes % 60
      if (h === 0) return `${m}分钟`
      if (m === 0) return `${h}小时`
      return `${h}小时${m}分钟`
    }

    return (
      <div className="space-y-2.5">
        <div className={mode === 'create' ? 'rounded-2xl bg-gray-50/70 p-3' : ''}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            入睡时间
          </label>
          <input
            type="datetime-local"
            value={values.sleepStartTime}
            onChange={(e) => {
              setters.setSleepStartTime(e.target.value)
              // If duration was set, recalculate end time based on new start
              if (currentDurationMinutes > 0 && e.target.value) {
                const start = new Date(e.target.value)
                const end = new Date(start.getTime() + currentDurationMinutes * 60 * 1000)
                const pad = (n: number) => String(n).padStart(2, '0')
                const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`
                setters.setSleepEndTime(endStr)
              }
            }}
            aria-invalid={showSleepError}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
          {showSleepError ? (
            <p className="mt-1.5 text-sm text-red-600">{validationMessage}</p>
          ) : null}
        </div>

        <div className={mode === 'create' ? 'rounded-2xl bg-gray-50/70 p-3' : ''}>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              睡眠时长（可选）
            </label>
            {currentDurationMinutes > 0 ? (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {formatDurationDisplay(currentDurationMinutes)}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {durationPresets.map((preset) => (
              <button
                key={preset.minutes}
                type="button"
                disabled={!values.sleepStartTime}
                onClick={() => handleDurationSelect(preset.minutes)}
                className={`mobile-touch-target rounded-xl border-2 px-2 py-2 text-center text-xs font-medium transition ${
                  currentDurationMinutes === preset.minutes
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : values.sleepStartTime
                      ? 'border-gray-200 text-gray-600 hover:border-gray-300'
                      : 'cursor-not-allowed border-gray-100 text-gray-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              disabled={!values.sleepStartTime}
              placeholder="自定义分钟数"
              value={currentDurationMinutes > 0 && !durationPresets.some(p => p.minutes === currentDurationMinutes) ? currentDurationMinutes : ''}
              onChange={(e) => handleCustomDuration(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300"
            />
            <span className="shrink-0 text-xs text-gray-500">分钟</span>
          </div>
          {!values.sleepStartTime ? (
            <p className="mt-1.5 text-xs text-gray-400">请先填写入睡时间</p>
          ) : null}
        </div>

        <div className={mode === 'create' ? 'rounded-2xl bg-gray-50/70 p-3' : ''}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            睡醒时间（可选）
          </label>
          <input
            type="datetime-local"
            value={values.sleepEndTime}
            disabled={!values.sleepStartTime}
            onChange={(e) => setters.setSleepEndTime(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300"
          />
          {values.sleepStartTime && currentDurationMinutes > 0 ? (
            <p className="mt-1.5 text-xs text-gray-500">
              睡眠时长：{formatDurationDisplay(currentDurationMinutes)}
            </p>
          ) : null}
        </div>

        <div className={mode === 'create' ? 'rounded-2xl bg-gray-50/70 p-3' : ''}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            睡眠质量（可选）
          </label>
          <input
            type="text"
            value={values.sleepQuality}
            onChange={(e) => setters.setSleepQuality(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
            placeholder="例如：安稳、易醒"
          />
        </div>
      </div>
    )
  }

  if (type === 'CUSTOM') {
    const showCustomNameError = !!validationMessage
    return (
      <div>
        <label htmlFor="custom-health-name" className="mb-1.5 block text-sm font-medium text-gray-700">
          记录名称 <span className="text-red-600">*</span>
        </label>
        <input
          id="custom-health-name"
          type="text"
          value={values.customName}
          maxLength={100}
          autoFocus
          aria-invalid={showCustomNameError}
          aria-describedby={showCustomNameError ? 'custom-health-name-error' : undefined}
          onChange={(event) => setters.setCustomName(event.target.value)}
          className={`min-h-12 w-full rounded-lg border bg-white px-3.5 text-base text-slate-950 outline-none transition focus:ring-2 ${showCustomNameError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'}`}
          placeholder="例如：皮肤状态、康复训练"
        />
        {showCustomNameError ? <p id="custom-health-name-error" className="mt-1.5 text-sm text-red-600">{validationMessage}</p> : null}
      </div>
    )
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">本次补充</legend>
      <div className="grid grid-cols-2 gap-2">
        <label className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border px-3 transition-colors ${values.adGiven ? 'border-orange-300 bg-orange-50 text-orange-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
          <input type="checkbox" checked={values.adGiven} onChange={(event) => setters.setAdGiven(event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
          <span className="text-sm font-semibold">AD</span>
        </label>
        <label className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border px-3 transition-colors ${values.vitaminDGiven ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
          <input type="checkbox" checked={values.vitaminDGiven} onChange={(event) => setters.setVitaminDGiven(event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
          <span className="text-sm font-semibold">维生素D</span>
        </label>
      </div>
      {validationMessage ? <p className="mt-1.5 text-sm text-red-600">{validationMessage}</p> : null}
    </fieldset>
  )
}
