'use client'

import type { HealthFieldValues, HealthType, DiaperType, VaccineSuggestion } from '@/lib/health-records'

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
}: Props) {
  const showWeightError = type === 'WEIGHT' && !!validationMessage
  const showHeightError = type === 'HEIGHT' && !!validationMessage
  const showTemperatureError = type === 'TEMPERATURE' && !!validationMessage
  const showMedicationNameError = type === 'MEDICATION' && !!validationMessage
  const showVaccineNameError = type === 'VACCINE' && !!validationMessage
  const showVaccineSuggestions = (vaccineSuggestionsLoading || vaccineSuggestions.length > 0) && !!onApplyVaccineSuggestion
  const cardClassName = mode === 'create' ? 'rounded-2xl bg-gray-50/70 p-3' : 'space-y-3'

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
    return (
      <div className="space-y-2.5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'PEE', label: '小便', emoji: '💧' },
            { value: 'POOP', label: '大便', emoji: '💩' },
            { value: 'BOTH', label: '都有', emoji: '🚼' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setters.setDiaperType(option.value as DiaperType)}
              className={`mobile-touch-target ${mode === 'create' ? 'min-h-[78px] ' : ''}rounded-xl border-2 px-2 py-2 text-center transition ${
                values.diaperType === option.value
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-lg">{option.emoji}</span>
              <p className={`mt-1 text-xs ${values.diaperType === option.value ? 'font-medium text-amber-700' : 'text-gray-600'}`}>
                {option.label}
              </p>
            </button>
          ))}
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

  return (
    <div>
      <label className="mobile-touch-target flex items-center space-x-3 rounded-2xl bg-gray-50 px-3.5 py-3">
        <input
          type="checkbox"
          checked={values.adGiven}
          onChange={(e) => setters.setAdGiven(e.target.checked)}
          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-gray-700">已服用AD滴剂</span>
      </label>
    </div>
  )
}
