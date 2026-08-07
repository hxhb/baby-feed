import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'
import { checkForUpdates, UpdateCheckError } from '@/lib/update-check'
import { CURRENT_VERSION, CURRENT_VERSION_NUMBER } from '@/lib/version'

function getPublicError(error: unknown): string {
  if (!(error instanceof UpdateCheckError)) return '暂时无法检查更新'

  switch (error.code) {
    case 'RATE_LIMITED':
      return 'GitHub 请求受限，请稍后重试'
    case 'NO_RELEASE':
      return '暂未找到可用版本'
    case 'INVALID_RELEASE':
      return '最新版本信息格式不正确'
    default:
      return '暂时无法检查更新'
  }
}

export async function GET(request: NextRequest) {
  const session = await auth(request)
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
  }

  const checkedAt = new Date().toISOString()
  try {
    const result = await checkForUpdates(CURRENT_VERSION_NUMBER)
    return NextResponse.json({ ...result, checkedAt }, { headers: noStoreHeaders })
  } catch (error) {
    logError('检查 GitHub Release 失败', error)
    return NextResponse.json(
      { currentVersion: CURRENT_VERSION, error: getPublicError(error), checkedAt },
      { status: 502, headers: noStoreHeaders },
    )
  }
}
