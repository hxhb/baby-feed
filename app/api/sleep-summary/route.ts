import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateId, validateDateOnlyString } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders, getBeijingDayRange, getBeijingDateStr, splitDurationByBeijingDay } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const rateLimit = enforceRateLimit({
      key: buildUserActionKey('sleep-summary', session.user.id, request),
      ...getRateLimit('sleep-summary'),
    })
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      })
    }

    const { searchParams } = new URL(request.url)
    const babyId = searchParams.get('babyId')
    const date = searchParams.get('date')

    if (!babyId || !date) {
      return NextResponse.json({ error: '缺少必要参数 babyId 和 date' }, { status: 400, headers: noStoreHeaders })
    }

    const idCheck = validateId(babyId, 'babyId')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const dateCheck = validateDateOnlyString(date, '日期')
    if (!dateCheck.valid) {
      return NextResponse.json({ error: dateCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    // Verify baby ownership
    const baby = await prisma.baby.findFirst({
      where: { id: babyId, createdBy: session.user.id },
      select: { id: true },
    })
    if (!baby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const { start, end } = getBeijingDayRange(date)

    // Query all SLEEP records that touch this day:
    // - recordedAt (=sleepEndTime) falls in range → record ends on this day
    // - sleepStartTime falls in range → record starts on this day
    const records = await prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: session.user.id,
        type: 'SLEEP',
        OR: [
          { recordedAt: { gte: start, lte: end } },
          { sleepStartTime: { gte: start, lte: end } },
        ],
      },
      orderBy: { sleepStartTime: 'asc' },
      select: {
        id: true,
        sleepStartTime: true,
        sleepEndTime: true,
        sleepQuality: true,
        notes: true,
      },
    })

    const dayStartMs = start.getTime()
    const dayEndMs = end.getTime()

    // Build segments: for each record, extract only the portion within the requested day
    const segments: Array<{
      id: string
      sleepStart: string | null
      sleepEnd: string | null
      segmentStart: string
      segmentEnd: string
      segmentMinutes: number
      quality: string | null
      note: string | null
      isFullRecord: boolean
    }> = []

    let totalMinutes = 0
    let count = 0

    for (const record of records) {
      if (!record.sleepStartTime || !record.sleepEndTime) continue

      const startMs = record.sleepStartTime.getTime()
      const endMs = record.sleepEndTime.getTime()
      if (endMs <= startMs) continue

      // Use splitDurationByBeijingDay to walk each day segment,
      // but only keep the segment matching the requested date
      splitDurationByBeijingDay(startMs, endMs, (dayStr, minutes, isStartDay) => {
        if (dayStr !== date) return

        // Compute the actual segment boundaries within this day
        const segStart = Math.max(startMs, dayStartMs)
        const segEnd = Math.min(endMs, dayEndMs + 1) // +1 to include 23:59:59.999

        segments.push({
          id: record.id,
          sleepStart: record.sleepStartTime!.toISOString(),
          sleepEnd: record.sleepEndTime!.toISOString(),
          segmentStart: new Date(segStart).toISOString(),
          segmentEnd: new Date(segEnd).toISOString(),
          segmentMinutes: minutes,
          quality: record.sleepQuality,
          note: record.notes?.trim() || null,
          isFullRecord: getBeijingDateStr(record.sleepStartTime!) === date
            && getBeijingDateStr(record.sleepEndTime!) === date,
        })

        totalMinutes += minutes

        // Count only sessions that started on this day (consistent with stats page)
        if (isStartDay) {
          count += 1
        }
      })
    }

    return NextResponse.json({
      date,
      totalMinutes,
      count,
      segments,
    }, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取睡眠摘要失败', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}
