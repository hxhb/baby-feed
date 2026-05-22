/**
 * 统一输入验证工具
 * 防止非法类型、极端数值、不合法枚举等通过 API 进入数据库
 */

// Password strength requirements
const PASSWORD_MIN_LENGTH = 8

/**
 * Validate password strength: at least 8 chars, must contain letter and digit
 * @returns error message string, or null if valid
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `密码长度不能少于 ${PASSWORD_MIN_LENGTH} 位`
  }
  if (!/[a-zA-Z]/.test(password)) {
    return '密码必须包含至少一个字母'
  }
  if (!/\d/.test(password)) {
    return '密码必须包含至少一个数字'
  }
  return null
}

// 喂养记录类型白名单
export const FEEDING_TYPES = ['BREAST_MILK', 'BREAST_MILK_BOTTLE', 'FORMULA', 'SOLID_FOOD'] as const
export type FeedingType = typeof FEEDING_TYPES[number]

// 健康记录类型白名单
export const HEALTH_TYPES = ['WEIGHT', 'HEIGHT', 'TEMPERATURE', 'MEDICATION', 'VACCINE', 'DIAPER', 'AD_VITAMIN', 'SLEEP'] as const
export type HealthType = typeof HEALTH_TYPES[number]

// 性别白名单
export const GENDERS = ['MALE', 'FEMALE'] as const
export type Gender = typeof GENDERS[number]

// 尿布类型白名单
export const DIAPER_TYPES = ['PEE', 'POOP', 'BOTH'] as const

// 尿布状态为自由文本，不需要白名单验证

// 验证结果
interface ValidationResult {
  valid: boolean
  error?: string
}

function isProvided(value: unknown) {
  return value !== undefined && value !== null
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

// 验证 YYYY-MM-DD 格式日期
export function validateDateOnlyString(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: true }
  }
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} 必须是字符串` }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { valid: false, error: `${fieldName} 格式无效，应为 YYYY-MM-DD` }
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (isNaN(date.getTime())) {
    return { valid: false, error: `${fieldName} 不是有效的日期` }
  }

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return { valid: false, error: `${fieldName} 不是有效的日期` }
  }

  return validateDateString(date.toISOString(), fieldName)
}

export function validateDateOrder(startValue: unknown, endValue: unknown, startFieldName: string, endFieldName: string): ValidationResult {
  if (!isProvided(startValue) || !isProvided(endValue)) {
    return { valid: true }
  }

  if (typeof startValue !== 'string' || typeof endValue !== 'string') {
    return { valid: false, error: `${startFieldName} 和 ${endFieldName} 必须是字符串` }
  }

  const start = new Date(startValue)
  const end = new Date(endValue)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: `${startFieldName} 或 ${endFieldName} 不是有效的日期格式` }
  }

  if (end.getTime() < start.getTime()) {
    return { valid: false, error: `${endFieldName} 不能早于 ${startFieldName}` }
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
    validateString(body.solidFoodName, '辅食名称', 200),
    validateString(body.solidFoodAmount, '辅食量', 200),
    validateBoolean(body.adGiven, 'AD补充'),
    validateDateString(body.startTime, '开始时间'),
    validateDateString(body.endTime, '结束时间'),
    validateDateOrder(body.startTime, body.endTime, '开始时间', '结束时间'),
    validateString(body.notes, '备注', 1000),
    validateFeedingBusinessRules(body)
  )
}

function validateFeedingBusinessRules(body: Record<string, unknown>): ValidationResult {
  const type = body.type
  if (type === undefined || type === null) {
    return { valid: true }
  }

  if (typeof type !== 'string' || !FEEDING_TYPES.includes(type as FeedingType)) {
    return { valid: false, error: '喂养类型的值无效' }
  }

  if (type === 'BREAST_MILK') {
    const hasDuration = isProvided(body.leftBreastDuration) || isProvided(body.rightBreastDuration)
    if (!hasDuration) {
      return { valid: false, error: '亲喂记录至少需要填写一侧哺乳时长' }
    }
  }

  if (type === 'BREAST_MILK_BOTTLE' && !isProvided(body.breastMilkAmount)) {
    return { valid: false, error: '瓶喂母乳记录需要填写母乳量' }
  }

  if (type === 'FORMULA' && !isProvided(body.formulaAmount)) {
    return { valid: false, error: '奶粉记录需要填写配方奶量' }
  }

  if (type === 'SOLID_FOOD' && !isProvided(body.solidFoodName)) {
    return { valid: false, error: '辅食记录需要填写辅食名称' }
  }

  return { valid: true }
}

// 验证健康记录输入
export function validateHealthInput(body: Record<string, unknown>) {
  const baseValidation = validateAll(
    validateEnum(body.type, HEALTH_TYPES, '健康记录类型'),
    validateNumber(body.weight, '体重', 0, 100),        // 0-100 kg
    validateNumber(body.height, '身高', 0, 200),         // 0-200 cm
    validateNumber(body.temperature, '体温', 30, 45),    // 30-45 °C
    validateString(body.medicationName, '药品名称', 200),
    validateString(body.medicationDose, '药品剂量', 200),
    validateString(body.vaccineName, '疫苗名称', 200),
    validateString(body.vaccineManufacturer, '疫苗生产厂商', 200),
    validateInt(body.vaccineDoseNumber, '当前针次', 1, 20),
    validateInt(body.vaccineTotalDoses, '总针数', 1, 20),
    validateEnum(body.diaperType, DIAPER_TYPES, '尿布类型'),
    validateString(body.diaperStatus, '尿布状态', 200),
    validateBoolean(body.adGiven, 'AD补充'),
    validateDateString(body.sleepStartTime, '入睡时间'),
    validateDateString(body.sleepEndTime, '醒来时间'),
    validateDateOrder(body.sleepStartTime, body.sleepEndTime, '入睡时间', '醒来时间'),
    validateString(body.sleepQuality, '睡眠质量', 200),
    validateDateString(body.recordedAt, '记录时间'),
    validateString(body.notes, '备注', 1000)
  )

  if (!baseValidation.valid) {
    return baseValidation
  }

  const businessValidation = validateHealthBusinessRules(body)
  if (!businessValidation.valid) {
    return businessValidation
  }

  const hasVaccineDoseNumber = body.vaccineDoseNumber !== undefined && body.vaccineDoseNumber !== null
  const hasVaccineTotalDoses = body.vaccineTotalDoses !== undefined && body.vaccineTotalDoses !== null

  if (hasVaccineDoseNumber !== hasVaccineTotalDoses) {
    return { valid: false, error: '请同时填写当前针次和总针数' }
  }

  if (
    hasVaccineDoseNumber &&
    hasVaccineTotalDoses &&
    typeof body.vaccineDoseNumber === 'number' &&
    typeof body.vaccineTotalDoses === 'number' &&
    body.vaccineDoseNumber > body.vaccineTotalDoses
  ) {
    return { valid: false, error: '当前针次不能大于总针数' }
  }

  return { valid: true }
}

function validateHealthBusinessRules(body: Record<string, unknown>): ValidationResult {
  const type = body.type
  if (type === undefined || type === null) {
    return { valid: true }
  }

  if (typeof type !== 'string' || !HEALTH_TYPES.includes(type as HealthType)) {
    return { valid: false, error: '健康记录类型的值无效' }
  }

  if (type === 'WEIGHT' && !isProvided(body.weight)) {
    return { valid: false, error: '体重记录需要填写体重' }
  }

  if (type === 'HEIGHT' && !isProvided(body.height)) {
    return { valid: false, error: '身高记录需要填写身高' }
  }

  if (type === 'TEMPERATURE' && !isProvided(body.temperature)) {
    return { valid: false, error: '体温记录需要填写体温' }
  }

  if (type === 'MEDICATION' && !isProvided(body.medicationName)) {
    return { valid: false, error: '用药记录需要填写药品名称' }
  }

  if (type === 'VACCINE') {
    if (!isProvided(body.vaccineName)) {
      return { valid: false, error: '疫苗记录需要填写疫苗名称' }
    }
    if (!isProvided(body.vaccineDoseNumber) || !isProvided(body.vaccineTotalDoses)) {
      return { valid: false, error: '疫苗记录需要填写当前针次和总针数' }
    }
  }

  if (type === 'DIAPER' && !isProvided(body.diaperType)) {
    return { valid: false, error: '大小便记录需要填写尿布类型' }
  }

  if (type === 'AD_VITAMIN' && !isProvided(body.adGiven)) {
    return { valid: false, error: 'AD 补充记录需要填写是否已补充' }
  }

  if (type === 'SLEEP' && !isProvided(body.sleepStartTime)) {
    return { valid: false, error: '睡眠记录需要填写入睡时间' }
  }

  return { valid: true }
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
    const contentType = request.headers.get('content-type')
    if (contentType && !contentType.toLowerCase().includes('application/json')) {
      return { error: '请求体必须为 JSON' }
    }

    // 检查 Content-Length
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const parsedLength = Number.parseInt(contentLength, 10)
      if (!Number.isFinite(parsedLength)) {
        return { error: '请求体长度无效' }
      }
      if (parsedLength > maxSize) {
        return { error: '请求体过大' }
      }
    }
    
    const text = await request.text()
    if (!text.trim()) {
      return { error: '请求体不能为空' }
    }
    if (text.length > maxSize) {
      return { error: '请求体过大' }
    }
    
    const data = JSON.parse(text)
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { error: '请求体格式不正确' }
    }

    const prototype = Object.getPrototypeOf(data)
    if (prototype !== Object.prototype && prototype !== null) {
      return { error: '请求体格式不正确' }
    }
    
    return { data: data as Record<string, unknown> }
  } catch {
    return { error: '请求体解析失败' }
  }
}

// 验证备忘录输入
export function validateMemoInput(body: Record<string, unknown>): ValidationResult {
  const titleCheck = validateString(body.title, '备忘标题', 100)
  if (!titleCheck.valid) return titleCheck

  if (!body.title || (typeof body.title === 'string' && !body.title.trim())) {
    return { valid: false, error: '备忘标题不能为空' }
  }

  const contentCheck = validateString(body.content, '备忘内容', 500)
  if (!contentCheck.valid) return contentCheck

  // scheduledAt: must be a valid date string, allow future dates (up to 5 years)
  if (body.scheduledAt === undefined || body.scheduledAt === null) {
    return { valid: false, error: '备忘时间不能为空' }
  }
  if (typeof body.scheduledAt !== 'string') {
    return { valid: false, error: '备忘时间必须是字符串' }
  }
  const scheduledDate = new Date(body.scheduledAt as string)
  if (isNaN(scheduledDate.getTime())) {
    return { valid: false, error: '备忘时间不是有效的日期格式' }
  }
  const fiveYearsMs = 5 * 365 * 24 * 60 * 60 * 1000
  const hundredYearsMs = 100 * 365 * 24 * 60 * 60 * 1000
  const now = Date.now()
  if (scheduledDate.getTime() > now + fiveYearsMs || scheduledDate.getTime() < now - hundredYearsMs) {
    return { valid: false, error: '备忘时间超出合理范围' }
  }

  const completedCheck = validateBoolean(body.completed, '是否已完成')
  if (!completedCheck.valid) return completedCheck

  return { valid: true }
}

function isApiKeyRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  return !!authHeader && /^Bearer\s+bfk_[a-f0-9]{64}$/i.test(authHeader)
}

// 从环境变量构建可信来源集合（启动时确定，不依赖请求头）
// 这避免了攻击者伪造 x-forwarded-proto / x-forwarded-host 绕过 CSRF 检查
const trustedOrigins: Set<string> = (() => {
  const origins = new Set<string>()
  const nextAuthUrl = process.env.NEXTAUTH_URL
  if (nextAuthUrl) {
    try { origins.add(new URL(nextAuthUrl).origin) } catch { /* 忽略无效 URL */ }
  }
  const corsOrigin = process.env.CORS_ALLOWED_ORIGIN
  if (corsOrigin) {
    try { origins.add(new URL(corsOrigin).origin) } catch { /* 忽略无效 URL */ }
  }
  if (origins.size === 0) {
    origins.add('http://localhost:3000')
  }
  return origins
})()

export function validateSameOrigin(request: Request): ValidationResult {
  if (isApiKeyRequest(request)) {
    return { valid: true }
  }

  const origin = request.headers.get('origin')
  if (origin) {
    return trustedOrigins.has(origin)
      ? { valid: true }
      : { valid: false, error: '非法请求来源' }
  }

  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      return trustedOrigins.has(refererUrl.origin)
        ? { valid: true }
        : { valid: false, error: '非法请求来源' }
    } catch {
      return { valid: false, error: '非法请求来源' }
    }
  }

  return { valid: false, error: '缺少合法的请求来源' }
}

export function validateUrl(value: unknown, fieldName: string = 'URL'): ValidationResult {
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} 必须是字符串` }
  }

  try {
    const url = new URL(value)
    // Ensure it's HTTP or HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: `${fieldName} 必须使用 HTTP 或 HTTPS 协议` }
    }

    // Block private/internal network addresses (SSRF prevention)
    const hostname = url.hostname.toLowerCase()
    const blockedPatterns = [
      /^localhost$/,
      /^127\./,                          // 127.0.0.0/8
      /^192\.168\./,                     // 192.168.0.0/16
      /^10\./,                           // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[01])\./,  // 172.16.0.0/12
      /^169\.254\./,                     // Link-local 169.254.0.0/16
      /^0\.0\.0\.0$/,
      /^::1$/,                           // IPv6 localhost
      /^fc00:/,                          // IPv6 private
      /^fe80:/,                          // IPv6 link-local
      /^fd[0-9a-f]{2}:/,                 // IPv6 unique local
      /host\.docker\.internal$/,
      /\.local$/,                        // mDNS / local domains
    ]

    for (const pattern of blockedPatterns) {
      if (pattern.test(hostname)) {
        return { valid: false, error: `${fieldName} 不能指向内部网络地址` }
      }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: `${fieldName} 格式不正确` }
  }
}
