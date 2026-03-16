import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// 邮箱格式验证
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 密码强度要求：至少 8 位，包含字母和数字
const PASSWORD_MIN_LENGTH = 8
function validatePassword(password: string): string | null {
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

// 简易内存速率限制（按 IP，1 分钟最多 5 次注册请求）
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 分钟
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_MAP_MAX_SIZE = 10000 // 防止内存泄漏

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  
  // 定期清理过期条目，防止内存泄漏
  if (rateLimitMap.size > RATE_LIMIT_MAP_MAX_SIZE) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetTime) {
        rateLimitMap.delete(key)
      }
    }
  }

  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false
  }

  record.count++
  return true
}

// POST /api/auth/register - 用户注册
export async function POST(request: NextRequest) {
  try {
    // 检查是否允许注册
    const regSetting = await prisma.siteSettings.findUnique({
      where: { key: 'allowRegistration' }
    })
    if (regSetting?.value === 'false') {
      return NextResponse.json({ error: '管理员已关闭注册功能' }, { status: 403 })
    }

    // 速率限制检查
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 })
    }

    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password || !name) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
    }

    // 邮箱格式验证
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
    }

    // 用户名长度验证
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
      return NextResponse.json({ error: '用户名长度需在 1-50 个字符之间' }, { status: 400 })
    }

    // 密码强度验证
    if (typeof password !== 'string') {
      return NextResponse.json({ error: '密码格式不正确' }, { status: 400 })
    }
    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    // 检查邮箱是否已存在（使用统一错误消息防止邮箱枚举）
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    })

    if (existingUser) {
      // 返回通用错误消息，防止攻击者通过不同的响应判断邮箱是否已注册
      return NextResponse.json({ error: '注册失败，请检查输入信息' }, { status: 400 })
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim()
      }
    })

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name
    }, { status: 201 })
  } catch (error) {
    console.error('注册失败:', error)
    return NextResponse.json({ error: '注册失败' }, { status: 500 })
  }
}
