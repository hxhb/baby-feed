'use client'

import { type BreastMode, type FeedingFieldValues, type FeedingType, getQuickFeedingAmounts } from '@/lib/feeding-records'

interface FeedingFieldSetters {
  setType: (value: FeedingType) => void
  setBreastMode: (value: BreastMode) => void
  setLeftBreastDuration: (value: string) => void
  setRightBreastDuration: (value: string) => void
  setBreastMilkAmount: (value: string) => void
  setFormulaAmount: (value: string) => void
}

interface Props {
  type: FeedingType
  breastMode: BreastMode
  values: FeedingFieldValues
  setters: FeedingFieldSetters
  mode?: 'create' | 'edit'
}

export default function FeedingRecordFields({
  type,
  breastMode,
  values,
  setters,
  mode = 'create',
}: Props) {
  const cardClassName = mode === 'create' ? 'rounded-2xl bg-gray-50/70 p-3' : ''
  const quickAmounts = getQuickFeedingAmounts(type)

  const applyQuickAmount = (value: number) => {
    const formatted = String(value)
    if (type === 'FORMULA') {
      setters.setFormulaAmount(formatted)
      return
    }

    if (type === 'BREAST_MILK_BOTTLE') {
      setters.setBreastMilkAmount(formatted)
    }
  }

  if (type === 'BREAST_MILK' || type === 'BREAST_MILK_BOTTLE') {
    return (
      <div className="space-y-3">
        <div className="flex gap-1.5 rounded-2xl bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => {
              setters.setBreastMode('direct')
              setters.setType('BREAST_MILK')
            }}
            className={`mobile-touch-target flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
              breastMode === 'direct'
                ? 'bg-pink-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            亲喂
          </button>
          <button
            type="button"
            onClick={() => {
              setters.setBreastMode('bottle')
              setters.setType('BREAST_MILK_BOTTLE')
            }}
            className={`mobile-touch-target flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
              breastMode === 'bottle'
                ? 'bg-pink-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            瓶喂
          </button>
        </div>

        {breastMode === 'direct' ? (
          <div className="grid grid-cols-2 gap-2.5">
            <div className={cardClassName}>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                左侧（分钟）
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={values.leftBreastDuration}
                onChange={(e) => setters.setLeftBreastDuration(e.target.value)}
                min="0"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="10"
              />
            </div>
            <div className={cardClassName}>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                右侧（分钟）
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={values.rightBreastDuration}
                onChange={(e) => setters.setRightBreastDuration(e.target.value)}
                min="0"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="10"
              />
            </div>
          </div>
        ) : (
          <div className={cardClassName}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-gray-700">
                母乳量（毫升）
              </label>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500">
                快捷填入
              </span>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quickAmounts.map(value => (
                <button
                  key={`breast-milk-${value}`}
                  type="button"
                  onClick={() => applyQuickAmount(value)}
                  className="mobile-touch-target rounded-full bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                >
                  {value}ml
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={values.breastMilkAmount}
              onChange={(e) => setters.setBreastMilkAmount(e.target.value)}
              min="0"
              step="5"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="例如：60"
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cardClassName}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-gray-700">
          奶粉量（毫升）
        </label>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500">
          快捷填入
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {quickAmounts.map(value => (
          <button
            key={`formula-${value}`}
            type="button"
            onClick={() => applyQuickAmount(value)}
            className="mobile-touch-target rounded-full bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
          >
            {value}ml
          </button>
        ))}
      </div>
      <input
        type="number"
        inputMode="decimal"
        value={values.formulaAmount}
        onChange={(e) => setters.setFormulaAmount(e.target.value)}
        min="0"
        step="5"
        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
        placeholder="例如：60"
      />
    </div>
  )
}
