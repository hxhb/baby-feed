import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateHealthInput, validateId, safeParseBody, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const updateRateLimit = enforceRateLimit({
      key: buildUserActionKey('health-update', session.user.id, request),
      limit: 30,
      windowMs: 10 * 60 * 1000,
    })
    if (!updateRateLimit.allowed) {
      return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(updateRateLimit.retryAfterSeconds),
        },
      })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const idCheck = validateId(id, '记录ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const validation = validateHealthInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: noStoreHeaders })
    }

    const {
      type,
      weight,
      height,
      temperature,
      medicationName,
      medicationDose,
      vaccineName,
      vaccineManufacturer,
      vaccineDoseNumber,
      vaccineTotalDoses,
      diaperType,
      diaperStatus,
      adGiven,
      recordedAt,
      notes
    } = body

    const updateData: {
      type?: string
      weight?: number | null
      height?: number | null
      temperature?: number | null
      medicationName?: string | null
      medicationDose?: string | null
      vaccineName?: string | null
      vaccineManufacturer?: string | null
      vaccineDoseNumber?: number | null
      vaccineTotalDoses?: number | null
      diaperType?: string | null
      diaperStatus?: string | null
      adGiven?: boolean | null
      recordedAt?: Date
      notes?: string | null
    } = {}

    if (type !== undefined) {
      if (typeof type !== 'string') {
        return NextResponse.json({ error: '健康记录类型字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.type = type
    }

    if (weight !== undefined) {
      if (weight !== null && typeof weight !== 'number') {
        return NextResponse.json({ error: '体重字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.weight = weight as number | null
    }

    if (height !== undefined) {
      if (height !== null && typeof height !== 'number') {
        return NextResponse.json({ error: '身高字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.height = height as number | null
    }

    if (temperature !== undefined) {
      if (temperature !== null && typeof temperature !== 'number') {
        return NextResponse.json({ error: '体温字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.temperature = temperature as number | null
    }

    if (medicationName !== undefined) {
      if (medicationName !== null && typeof medicationName !== 'string') {
        return NextResponse.json({ error: '药物名称字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.medicationName = medicationName as string | null
    }

    if (medicationDose !== undefined) {
      if (medicationDose !== null && typeof medicationDose !== 'string') {
        return NextResponse.json({ error: '药物剂量字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.medicationDose = medicationDose as string | null
    }

    if (vaccineName !== undefined) {
      if (vaccineName !== null && typeof vaccineName !== 'string') {
        return NextResponse.json({ error: '疫苗名称字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.vaccineName = vaccineName as string | null
    }

    if (vaccineManufacturer !== undefined) {
      if (vaccineManufacturer !== null && typeof vaccineManufacturer !== 'string') {
        return NextResponse.json({ error: '疫苗生产厂商字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.vaccineManufacturer = vaccineManufacturer as string | null
    }

    if (vaccineDoseNumber !== undefined) {
      if (vaccineDoseNumber !== null && typeof vaccineDoseNumber !== 'number') {
        return NextResponse.json({ error: '当前针次字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.vaccineDoseNumber = vaccineDoseNumber as number | null
    }

    if (vaccineTotalDoses !== undefined) {
      if (vaccineTotalDoses !== null && typeof vaccineTotalDoses !== 'number') {
        return NextResponse.json({ error: '总针数字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.vaccineTotalDoses = vaccineTotalDoses as number | null
    }

    if (diaperType !== undefined) {
      if (diaperType !== null && typeof diaperType !== 'string') {
        return NextResponse.json({ error: '便便类型字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.diaperType = diaperType as string | null
    }

    if (diaperStatus !== undefined) {
      if (diaperStatus !== null && typeof diaperStatus !== 'string') {
        return NextResponse.json({ error: '尿布状态字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.diaperStatus = diaperStatus as string | null
    }

    if (adGiven !== undefined) {
      if (adGiven !== null && typeof adGiven !== 'boolean') {
        return NextResponse.json({ error: 'AD 字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.adGiven = adGiven as boolean | null
    }

    if (recordedAt !== undefined) {
      if (typeof recordedAt !== 'string') {
        return NextResponse.json({ error: '记录时间字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.recordedAt = new Date(recordedAt)
    }

    if (notes !== undefined) {
      if (notes !== null && typeof notes !== 'string') {
        return NextResponse.json({ error: '备注字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.notes = notes as string | null
    }

    const existingRecord = await prisma.healthRecord.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!existingRecord) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const record = await prisma.healthRecord.update({
      where: { id },
      data: updateData,
      include: { baby: true }
    })

    return NextResponse.json(record, { headers: noStoreHeaders })
  } catch (error) {
    console.error('更新健康记录失败:', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500, headers: noStoreHeaders })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const deleteRateLimit = enforceRateLimit({
      key: buildUserActionKey('health-delete', session.user.id, request),
      limit: 20,
      windowMs: 15 * 60 * 1000,
    })
    if (!deleteRateLimit.allowed) {
      return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(deleteRateLimit.retryAfterSeconds),
        },
      })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const idCheck = validateId(id, '记录ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const existingRecord = await prisma.healthRecord.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!existingRecord) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404, headers: noStoreHeaders })
    }

    await prisma.healthRecord.delete({
      where: { id }
    })

    return NextResponse.json({ success: true }, { headers: noStoreHeaders })
  } catch (error) {
    console.error('删除健康记录失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500, headers: noStoreHeaders })
  }
}
