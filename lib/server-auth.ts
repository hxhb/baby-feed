import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

export async function createServerRequest(pathname = '/'): Promise<NextRequest> {
  const headerStore = await headers()
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000'

  return new NextRequest(`${protocol}://${host}${pathname}`, { headers: headerStore })
}

export async function getServerSession() {
  return auth(await createServerRequest())
}
