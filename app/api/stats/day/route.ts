import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateId, validateDateOnlyString } from '@/lib/validation'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

// 获取北京时间（UTC+8）的一天起止
function getBeijingDayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+08:00`)
  const end = new Date(`${dateStr}T23:59:59.999+08:00`)
  return { start, end }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const { searchParams } = new URL(request.url)
    const babyId = searchParams.get('babyId')
    const dateStr = searchParams.get('date')

    if (!babyId || !dateStr) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400, headers: noStoreHeaders })
    }

    // 验证 babyId 格式
    const idCheck = validateId(babyId, 'babyId')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const dateCheck = validateDateOnlyString(dateStr, '日期')
    if (!dateCheck.valid) {
      return NextResponse.json({ error: dateCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const baby = await prisma.baby.findFirst({
      where: {
        id: babyId,
        createdBy: session.user.id
      }
    })

    if (!baby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const { start: dayStart, end: dayEnd } = getBeijingDayRange(dateStr)

    const feedingRecords = await prisma.feedingRecord.findMany({
      where: {
        babyId,
        createdBy: session.user.id,
        startTime: {
          gte: dayStart,
          lte: dayEnd
        }
      }
    })

    const healthRecords = await prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: session.user.id,
        recordedAt: {
          gte: dayStart,
          lte: dayEnd
        }
      }
    })

    const breastRecords = feedingRecords.filter(r => r.type === 'BREAST_MILK')
    const breastBottleRecords = feedingRecords.filter(r => r.type === 'BREAST_MILK_BOTTLE')
    const formulaRecords = feedingRecords.filter(r => r.type === 'FORMULA')

    const dayStats = {
      date: dateStr,
      breastFeedingCount: breastRecords.length,
      totalBreastDuration: breastRecords.reduce(
        (sum, r) => sum + (r.leftBreastDuration || 0) + (r.rightBreastDuration || 0),
        0
      ),
      breastBottleCount: breastBottleRecords.length,
      totalBreastMilkAmount: breastBottleRecords.reduce(
        (sum, r) => sum + (r.breastMilkAmount || 0),
        0
      ),
      formulaCount: formulaRecords.length,
      totalFormulaAmount: formulaRecords.reduce(
        (sum, r) => sum + (r.formulaAmount || 0),
        0
      ),
      adGiven: healthRecords.some(r => r.type === 'AD_VITAMIN' && r.adGiven),
      weight: healthRecords.find(r => r.type === 'WEIGHT')?.weight,
      temperature: healthRecords.find(r => r.type === 'TEMPERATURE')?.temperature
    }

    return NextResponse.json(dayStats, { headers: noStoreHeaders })
  } catch (error) {
    console.error('获取单日统计失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}
