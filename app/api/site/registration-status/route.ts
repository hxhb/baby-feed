import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/site/registration-status - 查询是否允许注册（公开接口）
export async function GET() {
  try {
    const setting = await prisma.siteSettings.findUnique({
      where: { key: 'allowRegistration' }
    })

    return NextResponse.json({
      allowRegistration: setting?.value !== 'false' // 默认允许
    })
  } catch (error) {
    console.error('查询注册状态失败:', error)
    // 出错时默认允许注册
    return NextResponse.json({ allowRegistration: true })
  }
}
