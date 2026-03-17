import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { safeParseBody, validateSameOrigin } from '@/lib/validation'
import { getSiteSettings, setAllowRegistration } from '@/lib/site-settings'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

export async function GET(request: NextRequest) {
  const check = await requireAdmin(request)
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const settings = await getSiteSettings()
    return NextResponse.json(settings, {
      headers: noStoreHeaders,
    })
  } catch (error) {
    console.error('获取站点设置失败:', error)
    return NextResponse.json({ error: '获取站点设置失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const check = await requireAdmin(request)
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const originCheck = validateSameOrigin(request)
  if (!originCheck.valid) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 })
  }

  try {
    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400 })
    }

    const { allowRegistration } = body

    if (typeof allowRegistration === 'boolean') {
      await setAllowRegistration(allowRegistration)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新站点设置失败:', error)
    return NextResponse.json({ error: '更新站点设置失败' }, { status: 500 })
  }
}
