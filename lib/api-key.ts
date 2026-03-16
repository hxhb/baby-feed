/**
 * API Key 认证模块
 * 
 * 安全设计：
 * 1. Key 格式: bfk_<32字节随机hex> — 前缀 "bfk_" 方便识别来源
 * 2. 数据库只存 SHA-256 哈希，即使数据库泄露也不会暴露明文 Key
 * 3. Key 创建时显示一次明文，之后无法再查看
 * 4. 支持过期时间，过期后自动失效
 * 5. 记录最后使用时间，方便审计
 * 6. 独立的速率限制，防止暴力枚举
 */

import { createHash, randomBytes } from 'crypto'
import { prisma } from './prisma'
import { Session } from 'next-auth'
import { NextRequest } from 'next/server'

const API_KEY_PREFIX = 'bfk_'

// API Key 认证速率限制（独立于登录速率限制）
// 防止暴力枚举 API Key
const apiKeyRateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000    // 1分钟窗口
const RATE_LIMIT_MAX = 30              // 每分钟最多30次失败认证
const RATE_LIMIT_MAP_MAX = 5000

/**
 * 检查 API Key 认证的速率限制
 * 返回 true 表示被限流
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = apiKeyRateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    return false
  }

  return entry.count >= RATE_LIMIT_MAX
}

/**
 * 记录一次失败的 API Key 认证
 */
function recordFailedAttempt(ip: string): void {
  const now = Date.now()

  // 清理过期条目
  if (apiKeyRateLimitMap.size > RATE_LIMIT_MAP_MAX) {
    for (const [key, val] of apiKeyRateLimitMap) {
      if (now > val.resetAt) apiKeyRateLimitMap.delete(key)
    }
  }

  const entry = apiKeyRateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    apiKeyRateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
  } else {
    entry.count++
  }
}

/**
 * 生成一个新的 API Key
 * 返回明文 Key（只此一次）和哈希值
 */
export function generateApiKey(): { plainKey: string; keyHash: string; prefix: string } {
  const randomPart = randomBytes(32).toString('hex')
  const plainKey = `${API_KEY_PREFIX}${randomPart}`
  const keyHash = hashApiKey(plainKey)
  // 前缀用于在列表中识别 Key（显示前8位，足够区分但不会泄露完整 Key）
  const prefix = plainKey.substring(0, 12)

  return { plainKey, keyHash, prefix }
}

/**
 * 对 API Key 进行 SHA-256 哈希
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * 从请求中提取 API Key 并验证
 * 返回 Session 对象（与 cookie 认证兼容）或 null
 */
export async function authByApiKey(request: NextRequest): Promise<Session | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  // 仅接受 Bearer 格式
  const match = authHeader.match(/^Bearer\s+(bfk_[a-f0-9]{64})$/i)
  if (!match) return null

  const plainKey = match[1]

  // 速率限制检查
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  if (isRateLimited(ip)) {
    return null // 返回 null，由调用方返回 401，不暴露限流信息
  }

  const keyHash = hashApiKey(plainKey)

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: { select: { id: true, email: true, name: true, role: true } } }
    })

    if (!apiKey) {
      recordFailedAttempt(ip)
      return null
    }

    // 检查是否过期
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      recordFailedAttempt(ip)
      return null
    }

    // 异步更新最后使用时间（非阻塞，不影响请求响应速度）
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() }
    }).catch(() => {
      // 静默失败，更新最后使用时间不是关键操作
    })

    // 返回与 cookie 认证一致的 Session 结构
    return {
      user: {
        id: apiKey.user.id,
        email: apiKey.user.email,
        name: apiKey.user.name,
        role: apiKey.user.role,
      },
      expires: apiKey.expiresAt
        ? new Date(apiKey.expiresAt).toISOString()
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }
  } catch (error) {
    console.error('API Key 验证失败:', error)
    return null
  }
}
