'use client'

import { Check } from 'lucide-react'
import {
  getToothDefinition,
  type PrimaryToothCode,
  type ToothDefinition,
} from '@/lib/tooth-eruptions'

export interface EruptedToothState {
  toothCode: PrimaryToothCode
  eventId: string
  recordedAt: string
  orderStart: number
  orderEnd: number
}

interface Props {
  selectedCodes?: readonly PrimaryToothCode[]
  eruptedTeeth?: readonly EruptedToothState[]
  onToggle?: (code: PrimaryToothCode) => void
  onEruptedToothClick?: (tooth: EruptedToothState) => void
  readOnly?: boolean
  compact?: boolean
}

interface ToothPlacement {
  code: PrimaryToothCode
  x: number | string
  y: number
  layerClass: string
}

const UPPER_CODES: readonly PrimaryToothCode[] = ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65']
const LOWER_CODES: readonly PrimaryToothCode[] = ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75']
const ARCH_X = [
  14,
  19.5,
  27,
  35,
  'calc(50% - clamp(16.5px, 4.5vw, 18px) - 2px)',
  'calc(50% + clamp(16.5px, 4.5vw, 18px) + 2px)',
  65,
  73,
  80.5,
  86,
] as const
const UPPER_Y = [40, 31, 23.5, 18, 14, 14, 18, 23.5, 31, 40] as const
const LOWER_Y = [60, 69, 76.5, 82, 86, 86, 82, 76.5, 69, 60] as const
const UPPER_LAYERS = ['z-[20]', 'z-[18]', 'z-[16]', 'z-[14]', 'z-[12]', 'z-[12]', 'z-[14]', 'z-[16]', 'z-[18]', 'z-[20]'] as const
const LOWER_LAYERS = ['z-[12]', 'z-[14]', 'z-[16]', 'z-[18]', 'z-[20]', 'z-[20]', 'z-[18]', 'z-[16]', 'z-[14]', 'z-[12]'] as const

const TOOTH_PLACEMENTS: readonly ToothPlacement[] = [
  ...UPPER_CODES.map((code, index) => ({
    code,
    x: ARCH_X[index],
    y: UPPER_Y[index],
    layerClass: UPPER_LAYERS[index],
  })),
  ...LOWER_CODES.map((code, index) => ({
    code,
    x: ARCH_X[index],
    y: LOWER_Y[index],
    layerClass: LOWER_LAYERS[index],
  })),
]

function getToothSizeClass(position: ToothDefinition['position']) {
  switch (position) {
    case 'SECOND_MOLAR': return 'h-[clamp(38px,10.8vw,43px)] w-[clamp(38px,10.8vw,43px)]'
    case 'FIRST_MOLAR': return 'h-[clamp(35px,10vw,40px)] w-[clamp(35px,10vw,40px)]'
    case 'CANINE': return 'h-[clamp(33px,9.2vw,36px)] w-[clamp(30px,8.5vw,34px)]'
    case 'LATERAL_INCISOR': return 'h-[clamp(31px,8.5vw,34px)] w-[clamp(30px,8.5vw,34px)]'
    case 'CENTRAL_INCISOR': return 'h-[clamp(32px,8.7vw,35px)] w-[clamp(33px,9vw,36px)]'
  }
}

function getToothBorderRadius(position: ToothDefinition['position']) {
  switch (position) {
    case 'SECOND_MOLAR': return '38% 32% 40% 34% / 34% 40% 36% 42%'
    case 'FIRST_MOLAR': return '42% 34% 38% 36% / 38% 44% 34% 40%'
    case 'CANINE': return '48% 48% 38% 38% / 34% 34% 58% 58%'
    case 'LATERAL_INCISOR': return '36% 36% 44% 44% / 28% 28% 42% 42%'
    case 'CENTRAL_INCISOR': return '28% 28% 36% 36% / 24% 24% 38% 38%'
  }
}

function ToothSurface({
  position,
  selected,
}: {
  position: ToothDefinition['position']
  selected: boolean
}) {
  const lineColor = selected ? 'border-white/55' : 'border-slate-400/65'
  const fillColor = selected ? 'bg-white/65' : 'bg-slate-400/65'

  if (position === 'SECOND_MOLAR') {
    return (
      <>
        <span className={`absolute left-[26%] top-[25%] h-1 w-1 rounded-full ${fillColor}`} />
        <span className={`absolute right-[25%] top-[27%] h-1 w-1 rounded-full ${fillColor}`} />
        <span className={`absolute bottom-[25%] left-[28%] h-1 w-1 rounded-full ${fillColor}`} />
        <span className={`absolute bottom-[27%] right-[26%] h-1 w-1 rounded-full ${fillColor}`} />
        <span className={`absolute left-1/2 top-[18%] h-[64%] w-px -translate-x-1/2 border-l ${lineColor}`} />
        <span className={`absolute left-[18%] top-1/2 h-px w-[64%] -translate-y-1/2 border-t ${lineColor}`} />
      </>
    )
  }

  if (position === 'FIRST_MOLAR') {
    return (
      <>
        <span className={`absolute left-[28%] top-[27%] h-1 w-1 rounded-full ${fillColor}`} />
        <span className={`absolute right-[27%] top-[31%] h-1 w-1 rounded-full ${fillColor}`} />
        <span className={`absolute bottom-[25%] left-[46%] h-1 w-1 rounded-full ${fillColor}`} />
        <span className={`absolute left-[22%] top-1/2 h-px w-[58%] -translate-y-1/2 rotate-[18deg] border-t ${lineColor}`} />
      </>
    )
  }

  if (position === 'CANINE') {
    return (
      <>
        <span className={`absolute left-1/2 top-[27%] h-1.5 w-1.5 -translate-x-1/2 rounded-full ${fillColor}`} />
        <span className={`absolute left-1/2 top-[39%] h-[33%] w-px -translate-x-1/2 border-l ${lineColor}`} />
        <span className={`absolute left-[25%] top-[52%] h-px w-[22%] -rotate-[24deg] border-t ${lineColor}`} />
        <span className={`absolute right-[25%] top-[52%] h-px w-[22%] rotate-[24deg] border-t ${lineColor}`} />
      </>
    )
  }

  if (position === 'LATERAL_INCISOR') {
    return (
      <>
        <span className={`absolute left-1/2 top-[18%] h-[38%] w-px -translate-x-1/2 border-l ${lineColor}`} />
        <span className={`absolute bottom-[22%] left-[28%] h-[18%] w-[44%] rounded-b-full border-b ${lineColor}`} />
      </>
    )
  }

  return (
    <>
      <span className={`absolute left-[22%] top-[19%] h-[30%] w-px border-l ${lineColor}`} />
      <span className={`absolute right-[22%] top-[19%] h-[30%] w-px border-l ${lineColor}`} />
      <span className={`absolute bottom-[24%] left-[22%] h-[20%] w-[56%] rounded-b-full border-b ${lineColor}`} />
    </>
  )
}

function ToothGlyph({
  selected,
  erupted,
  position,
}: {
  selected: boolean
  erupted: boolean
  position: ToothDefinition['position']
}) {
  const faceClasses = selected
    ? 'border-emerald-700 bg-emerald-500 text-white'
    : erupted
      ? 'border-emerald-600 bg-white text-emerald-700'
      : 'border-slate-400 bg-slate-100 text-slate-600'
  const sideClasses = selected
    ? 'border-emerald-800 bg-emerald-700'
    : erupted
      ? 'border-emerald-700 bg-emerald-100'
      : 'border-slate-500 bg-slate-300'
  const faceShadow = selected
    ? 'inset 1px 2px 0 rgba(255,255,255,0.34), inset -1px -3px 4px rgba(4,120,87,0.28)'
    : erupted
      ? 'inset 1px 2px 0 rgba(255,255,255,0.95), inset -1px -3px 4px rgba(148,163,184,0.22)'
      : 'inset 1px 2px 0 rgba(255,255,255,0.78), inset -1px -3px 4px rgba(100,116,139,0.22)'
  const borderRadius = getToothBorderRadius(position)

  return (
    <span
      aria-hidden="true"
      className={`relative flex items-center justify-center ${getToothSizeClass(position)}`}
      style={{ filter: 'drop-shadow(1px 4px 2px rgba(127, 29, 29, 0.27))' }}
    >
      <span
        className={`absolute inset-0 border-2 transition-[background-color,border-color] duration-200 motion-reduce:transition-none ${sideClasses}`}
        style={{
          borderRadius,
          transform: 'translate(1px, 4px) perspective(80px) rotateX(7deg)',
          transformOrigin: 'bottom center',
        }}
      />
      <span
        className={`absolute inset-0 flex items-center justify-center border-2 transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none ${faceClasses}`}
        style={{
          borderRadius,
          boxShadow: faceShadow,
          transform: 'translateY(-1px) perspective(80px) rotateX(7deg)',
          transformOrigin: 'bottom center',
        }}
      >
        <span className={`absolute left-[13%] top-[10%] h-[18%] w-[45%] rounded-full ${selected ? 'bg-white/25' : 'bg-white/75'}`} />
        <ToothSurface position={position} selected={selected} />
        {(selected || erupted) ? <Check size={13} strokeWidth={3} className="relative z-10" /> : null}
      </span>
    </span>
  )
}

export default function ToothChart({
  selectedCodes = [],
  eruptedTeeth = [],
  onToggle,
  onEruptedToothClick,
  readOnly = false,
  compact = false,
}: Props) {
  const selectedSet = new Set(selectedCodes)
  const eruptedByCode = new Map(eruptedTeeth.map(tooth => [tooth.toothCode, tooth]))

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center justify-between px-2 text-xs font-medium text-slate-500" aria-hidden="true">
        <span>宝宝右侧</span>
        <span>宝宝左侧</span>
      </div>

      <div
        className={`relative isolate mx-auto aspect-[10/9] w-full ${compact ? 'max-w-[370px]' : 'max-w-[410px]'}`}
        role="group"
        aria-label="宝宝乳牙牙弓图，上半圈为上牙，下半圈为下牙"
      >
        <div
          aria-hidden="true"
          className="absolute inset-[1.5%] overflow-hidden rounded-[47%] border-[5px] border-orange-300 bg-orange-200 shadow-[inset_0_0_0_2px_rgba(251,113,133,0.22),0_8px_20px_rgba(194,65,12,0.10)]"
        >
          <div className="absolute inset-[5px] rounded-[46%] bg-rose-300 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.16)]" />

          <div className="absolute left-[12%] top-[11%] h-[37%] w-[76%] rounded-[50%_50%_46%_46%] border border-rose-200 bg-rose-100 shadow-[inset_0_5px_12px_rgba(251,113,133,0.13)]" />
          <div className="absolute bottom-[11%] left-[12%] h-[37%] w-[76%] rounded-[46%_46%_50%_50%] border border-rose-200 bg-rose-100 shadow-[inset_0_-5px_12px_rgba(251,113,133,0.13)]" />

          <div className="absolute left-1/2 top-1/2 h-6 w-14 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-rose-400/80 shadow-[inset_0_-2px_0_rgba(225,29,72,0.10)]" />
          <div className="absolute left-1/2 top-[34%] -translate-x-1/2 text-sm font-bold text-rose-950">上牙</div>
          <div className="absolute left-1/2 top-[59%] -translate-x-1/2 text-sm font-bold text-rose-950">下牙</div>
        </div>

        {TOOTH_PLACEMENTS.map(({ code, x, y, layerClass }) => {
          const definition = getToothDefinition(code)!
          const erupted = eruptedByCode.get(code)
          const selected = selectedSet.has(code)
          const canInteract = erupted ? Boolean(onEruptedToothClick) : !readOnly && Boolean(onToggle)
          const status = selected
            ? '本次已选择'
            : erupted
              ? erupted.orderStart === erupted.orderEnd
                ? `第${erupted.orderStart}颗，已记录`
                : `第${erupted.orderStart}到${erupted.orderEnd}颗，同时萌出，已记录`
              : '未长出'

          return (
            <button
              key={code}
              type="button"
              disabled={!canInteract}
              aria-pressed={selected || undefined}
              aria-label={`${definition.name}，${status}`}
              title={definition.name}
              onClick={() => erupted ? onEruptedToothClick?.(erupted) : onToggle?.(code)}
              className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full !bg-transparent transition-[filter,opacity] duration-200 motion-reduce:transition-none focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-100 ${layerClass} ${
                canInteract ? 'cursor-pointer hover:brightness-105 active:opacity-80' : 'cursor-default'
              }`}
              style={{ left: typeof x === 'number' ? `${x}%` : x, top: `${y}%` }}
            >
              <span className="relative flex items-center justify-center">
                <ToothGlyph
                  selected={selected}
                  erupted={Boolean(erupted)}
                  position={definition.position}
                />
              </span>
              {erupted ? (
                <span className="absolute right-0 top-0 flex min-h-4 min-w-4 items-center justify-center rounded-full border border-white bg-emerald-700 px-1 text-[9px] font-bold leading-4 text-white shadow-sm">
                  {erupted.orderStart === erupted.orderEnd ? erupted.orderStart : `${erupted.orderStart}-${erupted.orderEnd}`}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-xs text-slate-600" aria-label="牙位状态图例">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-slate-400 bg-slate-200" />未长出</span>
        <span className="inline-flex items-center gap-1.5"><span className="flex h-3 w-3 items-center justify-center rounded-sm border border-emerald-600 bg-white text-emerald-700"><Check size={9} strokeWidth={3} /></span>已记录</span>
        {!readOnly ? <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-500" />本次选择</span> : null}
      </div>
    </div>
  )
}
