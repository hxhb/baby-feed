export type FeedingType = 'BREAST_MILK' | 'BREAST_MILK_BOTTLE' | 'FORMULA'
export type BreastMode = 'direct' | 'bottle'

export interface FeedingFieldValues {
  leftBreastDuration: string
  rightBreastDuration: string
  breastMilkAmount: string
  formulaAmount: string
}

function parsePositiveNumber(value: string) {
  const parsed = Number.parseFloat(value)
  return parsed > 0 ? parsed : 0
}

function parseDuration(value: string) {
  const parsed = Number.parseInt(value, 10)
  return parsed > 0 ? parsed : 0
}

export function getFeedingValidationMessage(type: FeedingType, values: FeedingFieldValues) {
  if (type === 'BREAST_MILK') {
    const leftDuration = parseDuration(values.leftBreastDuration)
    const rightDuration = parseDuration(values.rightBreastDuration)

    if (leftDuration <= 0 && rightDuration <= 0) {
      return '请至少填写一侧亲喂时长'
    }
  }

  if (type === 'BREAST_MILK_BOTTLE' && !(parsePositiveNumber(values.breastMilkAmount) > 0)) {
    return '请填写有效的母乳量'
  }

  if (type === 'FORMULA' && !(parsePositiveNumber(values.formulaAmount) > 0)) {
    return '请填写有效的奶粉量'
  }

  return ''
}

export function buildFeedingRecordPayload(type: FeedingType, values: FeedingFieldValues): Record<string, unknown> {
  if (type === 'BREAST_MILK') {
    return {
      leftBreastDuration: parseDuration(values.leftBreastDuration),
      rightBreastDuration: parseDuration(values.rightBreastDuration),
      breastMilkAmount: null,
      formulaAmount: null,
    }
  }

  if (type === 'BREAST_MILK_BOTTLE') {
    return {
      leftBreastDuration: null,
      rightBreastDuration: null,
      breastMilkAmount: parsePositiveNumber(values.breastMilkAmount),
      formulaAmount: null,
    }
  }

  return {
    leftBreastDuration: null,
    rightBreastDuration: null,
    breastMilkAmount: null,
    formulaAmount: parsePositiveNumber(values.formulaAmount),
  }
}

export function getQuickFeedingAmounts(type: FeedingType) {
  if (type === 'FORMULA') {
    return [60, 90, 120, 150]
  }

  if (type === 'BREAST_MILK_BOTTLE') {
    return [60, 90, 120]
  }

  return []
}

export function getBreastModeFromType(type: FeedingType): BreastMode {
  return type === 'BREAST_MILK_BOTTLE' ? 'bottle' : 'direct'
}
