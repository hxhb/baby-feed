import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, subDays, format } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const babyId = searchParams.get('babyId')
    const days = parseInt(searchParams.get('days') || '7')

    if (!babyId) {
      return NextResponse.json({ error: '缺少babyId参数' }, { status: 400 })
    }

    // 验证婴儿是否属于当前用户
    const baby = await prisma.baby.findFirst({
      where: {
        id: babyId,
        createdBy: session.user.id
      }
    })

    if (!baby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404 })
    }

    const endDate = new Date()
    const startDate = subDays(endDate, days - 1)

    // 获取日期范围内的喂养记录
    const feedingRecords = await prisma.feedingRecord.findMany({
      where: {
        babyId,
        createdBy: session.user.id,
        startTime: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate)
        }
      },
      orderBy: { startTime: 'asc' }
    })

    // 获取日期范围内的健康记录
    const healthRecords = await prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: session.user.id,
        recordedAt: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate)
        }
      },
      orderBy: { recordedAt: 'asc' }
    })

    // 按日期分组统计
    const statsMap = new Map()

    // 初始化每天的统计数据
    for (let i = 0; i < days; i++) {
      const date = format(subDays(endDate, i), 'yyyy-MM-dd')
      statsMap.set(date, {
        date,
        breastFeedingCount: 0,
        totalBreastDuration: 0,
        breastBottleCount: 0,
        totalBreastMilkAmount: 0,
        formulaCount: 0,
        totalFormulaAmount: 0,
        adGiven: false,
        weight: undefined,
        temperature: undefined
      })
    }

    // 统计喂养记录
    feedingRecords.forEach(record => {
      const date = format(new Date(record.startTime), 'yyyy-MM-dd')
      const dayStats = statsMap.get(date)
      
      if (dayStats) {
        if (record.type === 'BREAST_MILK') {
          dayStats.breastFeedingCount++
          dayStats.totalBreastDuration += (record.leftBreastDuration || 0) + (record.rightBreastDuration || 0)
        } else if (record.type === 'BREAST_MILK_BOTTLE') {
          dayStats.breastBottleCount++
          dayStats.totalBreastMilkAmount += record.breastMilkAmount || 0
        } else if (record.type === 'FORMULA') {
          dayStats.formulaCount++
          dayStats.totalFormulaAmount += record.formulaAmount || 0
        }
      }
    })

    // 统计健康记录
    healthRecords.forEach(record => {
      const date = format(new Date(record.recordedAt), 'yyyy-MM-dd')
      const dayStats = statsMap.get(date)
      
      if (dayStats) {
        if (record.type === 'WEIGHT' && record.weight) {
          dayStats.weight = record.weight
        } else if (record.type === 'TEMPERATURE' && record.temperature) {
          dayStats.temperature = record.temperature
        } else if (record.type === 'AD_VITAMIN' && record.adGiven) {
          dayStats.adGiven = true
        }
      }
    })

    // 计算总计数据
    const totalStats = {
      totalFeedings: feedingRecords.length,
      totalFormulaAmount: feedingRecords
        .filter(r => r.type === 'FORMULA')
        .reduce((sum, r) => sum + (r.formulaAmount || 0), 0),
      totalBreastDuration: feedingRecords
        .filter(r => r.type === 'BREAST_MILK')
        .reduce((sum, r) => sum + (r.leftBreastDuration || 0) + (r.rightBreastDuration || 0), 0),
      totalBreastMilkAmount: feedingRecords
        .filter(r => r.type === 'BREAST_MILK_BOTTLE')
        .reduce((sum, r) => sum + (r.breastMilkAmount || 0), 0)
    }

    // 获取今天的统计
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayStats = statsMap.get(today)

    return NextResponse.json({
      baby,
      todayStats: todayStats || statsMap.values().next().value,
      lastDays: Array.from(statsMap.values()).reverse(),
      totalStats
    })
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}
