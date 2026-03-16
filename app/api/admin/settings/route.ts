import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeParseBody, validateSameOrigin } from '@/lib/validation'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

// 检查是否为管理员
async function checkAdmin(request: NextRequest) {
  const session = await auth(request)
  if (!session) {
    return { error: '未登录', status: 401 }
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })
  if (user?.role !== 'ADMIN') {
    return { error: '无权限', status: 403 }
  }
  return { session }
}

// GET /api/admin/settings - 获取站点设置
export async function GET(request: NextRequest) {
  const check = await checkAdmin(request)
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const settings = await prisma.siteSettings.findMany()
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => {
      settingsMap[s.key] = s.value
    })

    return NextResponse.json({
      allowRegistration: settingsMap['allowRegistration'] !== 'false', // 默认允许
    }, {
      headers: noStoreHeaders,
    })
  } catch (error) {
    console.error('获取站点设置失败:', error)
    return NextResponse.json({ error: '获取站点设置失败' }, { status: 500 })
  }
}

// PUT /api/admin/settings - 更新站点设置
export async function PUT(request: NextRequest) {
  const check = await checkAdmin(request)
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400 })
    }

    const { allowRegistration } = body

    if (typeof allowRegistration === 'boolean') {
      await prisma.siteSettings.upsert({
        where: { key: 'allowRegistration' },
        update: { value: String(allowRegistration) },
        create: { key: 'allowRegistration', value: String(allowRegistration) }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新站点设置失败:', error)
    return NextResponse.json({ error: '更新站点设置失败' }, { status: 500 })
  }
}
