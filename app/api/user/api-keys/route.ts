import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/api-key'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { validateString, validateId, safeParseBody, validateSameOrigin } from '@/lib/validation'
import { noStoreHeaders } from '@/lib/api-helpers'

// 每个用户最多拥有的 API Key 数量
const MAX_KEYS_PER_USER = 10

/**
 * GET /api/user/api-keys
 * 列出当前用户的所有 API Key（不返回明文或哈希值）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        // 不返回 keyHash
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(keys, { headers: noStoreHeaders })
  } catch (error) {
    console.error('获取 API Key 列表失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}

/**
 * POST /api/user/api-keys
 * 创建新的 API Key
 * 
 * 请求体:
 *   name: string (必填，Key 的名称/用途描述)
 *   expiresInDays?: number (可选，过期天数，不传则永不过期)
 * 
 * 返回:
 *   { key: "bfk_xxx...", id, name, prefix, expiresAt, createdAt }
 *   ⚠️ key 字段是明文 API Key，仅在创建时返回一次！
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const createApiKeyRateLimit = enforceRateLimit({
      key: buildUserActionKey('user-api-key-create', session.user.id, request),
      limit: 5,
      windowMs: 10 * 60 * 1000,
    })
    if (!createApiKeyRateLimit.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            'Retry-After': String(createApiKeyRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const { name, expiresInDays } = body

    // 验证名称
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Key 名称不能为空' }, { status: 400, headers: noStoreHeaders })
    }

    const nameCheck = validateString(name, '名称', 100)
    if (!nameCheck.valid) {
      return NextResponse.json({ error: nameCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    // 验证过期天数
    if (expiresInDays !== undefined && expiresInDays !== null) {
      if (typeof expiresInDays !== 'number' || !Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) {
        return NextResponse.json({ error: '过期天数必须是 1-365 的整数' }, { status: 400, headers: noStoreHeaders })
      }
    }

    // 检查用户已有 Key 数量
    const existingCount = await prisma.apiKey.count({
      where: { userId: session.user.id }
    })

    if (existingCount >= MAX_KEYS_PER_USER) {
      return NextResponse.json({ error: `最多只能创建 ${MAX_KEYS_PER_USER} 个 API Key` }, { status: 400, headers: noStoreHeaders })
    }

    // 生成 Key
    const { plainKey, keyHash, prefix } = generateApiKey()

    // 计算过期时间
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null

    // 存入数据库
    const apiKey = await prisma.apiKey.create({
      data: {
        name: name.trim(),
        prefix,
        keyHash,
        userId: session.user.id,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        expiresAt: true,
        createdAt: true,
      }
    })

    // ⚠️ 明文 Key 仅在此处返回一次
    return NextResponse.json({
      ...apiKey,
      key: plainKey,
      message: '请立即保存此 API Key，之后将无法再次查看完整 Key。'
    }, { status: 201, headers: noStoreHeaders })
  } catch (error) {
    console.error('创建 API Key 失败:', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500, headers: noStoreHeaders })
  }
}

/**
 * DELETE /api/user/api-keys
 * 吊销（删除）一个 API Key
 * 
 * 请求体:
 *   keyId: string (必填)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const deleteApiKeyRateLimit = enforceRateLimit({
      key: buildUserActionKey('user-api-key-delete', session.user.id, request),
      limit: 10,
      windowMs: 10 * 60 * 1000,
    })
    if (!deleteApiKeyRateLimit.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            'Retry-After': String(deleteApiKeyRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const { keyId } = body

    if (!keyId || typeof keyId !== 'string') {
      return NextResponse.json({ error: '缺少 keyId 参数' }, { status: 400, headers: noStoreHeaders })
    }

    const idCheck = validateId(keyId, 'API Key ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    // 确保只能删除自己的 Key
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        userId: session.user.id,
      }
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key 不存在' }, { status: 404, headers: noStoreHeaders })
    }

    await prisma.apiKey.delete({
      where: { id: keyId }
    })

    return NextResponse.json({ message: 'API Key 已删除' }, { headers: noStoreHeaders })
  } catch (error) {
    console.error('删除 API Key 失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500, headers: noStoreHeaders })
  }
}
