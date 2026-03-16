/**
 * 统一输入验证工具
 * 防止非法类型、极端数值、不合法枚举等通过 API 进入数据库
 */

// 喂养记录类型白名单
export const FEEDING_TYPES = ['BREAST_MILK', 'BREAST_MILK_BOTTLE', 'FORMULA'] as const
export type FeedingType = typeof FEEDING_TYPES[number]

// 健康记录类型白名单
export const HEALTH_TYPES = ['WEIGHT', 'HEIGHT', 'TEMPERATURE', 'MEDICATION', 'VACCINE', 'DIAPER', 'AD_VITAMIN'] as const
export type HealthType = typeof HEALTH_TYPES[number]

// 性别白名单
export const GENDERS = ['MALE', 'FEMALE'] as const
export type Gender = typeof GENDERS[number]

// 尿布类型白名单
export const DIAPER_TYPES = ['WET', 'DIRTY', 'BOTH', 'DRY'] as const

// 尿布状态白名单
export const DIAPER_STATUSES = ['NORMAL', 'ABNORMAL'] as const

// 验证结果
interface ValidationResult {
  valid: boolean
  error?: string
}

// 验证是否为合法的枚举值
export function validateEnum(value: unknown, allowedValues: readonly string[], fieldName: string): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: true } // 可选字段
  }
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} 必须是字符串` }
  }
  if (!allowedValues.includes(value)) {
    return { valid: false, error: `${fieldName} 的值无效` }
  }
  return { valid: true }
}

// 验证数值范围（可选字段）
export function validateNumber(value: unknown, fieldName: string, min: number, max: number): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: true }
  }
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: `${fieldName} 必须是数字` }
  }
  if (value < min || value > max) {
    return { valid: false, error: `${fieldName} 超出合理范围 (${min}-${max})` }
  }
  return { valid: true }
}

// 验证整数范围（可选字段）
export function validateInt(value: unknown, fieldName: string, min: number, max: number): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: true }
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { valid: false, error: `${fieldName} 必须是整数` }
  }
  if (value < min || value > max) {
    return { valid: false, error: `${fieldName} 超出合理范围 (${min}-${max})` }
  }
  return { valid: true }
}

// 验证布尔值（可选字段）
export function validateBoolean(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: true }
  }
  if (typeof value !== 'boolean') {
    return { valid: false, error: `${fieldName} 必须是布尔值` }
  }
  return { valid: true }
}

// 验证字符串（可选字段，限制长度）
export function validateString(value: unknown, fieldName: string, maxLength: number = 500): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: true }
  }
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} 必须是字符串` }
  }
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} 超出最大长度 (${maxLength})` }
  }
  return { valid: true }
}

// 验证日期字符串
export function validateDateString(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: true }
  }
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} 必须是字符串` }
  }
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return { valid: false, error: `${fieldName} 不是有效的日期格式` }
  }
  // 不允许未来太久或过去太久的日期（100年范围）
  const now = Date.now()
  const hundredYearsMs = 100 * 365 * 24 * 60 * 60 * 1000
  if (date.getTime() > now + 24 * 60 * 60 * 1000 || date.getTime() < now - hundredYearsMs) {
    return { valid: false, error: `${fieldName} 日期超出合理范围` }
  }
  return { valid: true }
}

// 验证 CUID 格式的 ID
export function validateId(value: unknown, fieldName: string = 'ID'): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: false, error: `${fieldName} 不能为空` }
  }
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} 必须是字符串` }
  }
  // CUID 格式: 以 c 开头，长度约 25 字符，包含字母数字
  if (!/^c[a-z0-9]{20,30}$/.test(value)) {
    return { valid: false, error: `${fieldName} 格式无效` }
  }
  return { valid: true }
}

// 批量验证，返回第一个失败的结果
export function validateAll(...results: ValidationResult[]): ValidationResult {
  for (const result of results) {
    if (!result.valid) {
      return result
    }
  }
  return { valid: true }
}

// 验证喂养记录输入
export function validateFeedingInput(body: Record<string, unknown>) {
  return validateAll(
    validateEnum(body.type, FEEDING_TYPES, '喂养类型'),
    validateInt(body.leftBreastDuration, '左侧哺乳时长', 0, 120),
    validateInt(body.rightBreastDuration, '右侧哺乳时长', 0, 120),
    validateNumber(body.breastMilkAmount, '母乳量', 0, 1000),
    validateNumber(body.formulaAmount, '配方奶量', 0, 1000),
    validateBoolean(body.adGiven, 'AD补充'),
    validateDateString(body.startTime, '开始时间'),
    validateDateString(body.endTime, '结束时间'),
    validateString(body.notes, '备注', 1000)
  )
}

// 验证健康记录输入
export function validateHealthInput(body: Record<string, unknown>) {
  return validateAll(
    validateEnum(body.type, HEALTH_TYPES, '健康记录类型'),
    validateNumber(body.weight, '体重', 0, 100),        // 0-100 kg
    validateNumber(body.height, '身高', 0, 200),         // 0-200 cm
    validateNumber(body.temperature, '体温', 30, 45),    // 30-45 °C
    validateString(body.medicationName, '药品名称', 200),
    validateString(body.medicationDose, '药品剂量', 200),
    validateString(body.vaccineName, '疫苗名称', 200),
    validateEnum(body.diaperType, DIAPER_TYPES, '尿布类型'),
    validateEnum(body.diaperStatus, DIAPER_STATUSES, '尿布状态'),
    validateBoolean(body.adGiven, 'AD补充'),
    validateDateString(body.recordedAt, '记录时间'),
    validateString(body.notes, '备注', 1000)
  )
}

// 验证婴儿信息输入
export function validateBabyInput(body: Record<string, unknown>) {
  return validateAll(
    validateString(body.name, '姓名', 50),
    validateDateString(body.birthDate, '出生日期'),
    validateEnum(body.gender, GENDERS, '性别')
  )
}

// 安全解析请求体，限制大小
export async function safeParseBody(request: Request, maxSize: number = 10 * 1024): Promise<{ data?: Record<string, unknown>; error?: string }> {
  try {
    // 检查 Content-Length
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > maxSize) {
      return { error: '请求体过大' }
    }
    
    const text = await request.text()
    if (text.length > maxSize) {
      return { error: '请求体过大' }
    }
    
    const data = JSON.parse(text)
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { error: '请求体格式不正确' }
    }
    
    return { data }
  } catch {
    return { error: '请求体解析失败' }
  }
}
