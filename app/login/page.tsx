import { getAllowRegistration } from '@/lib/site-settings'
import LoginClient from './LoginClient'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const allowRegistration = await getAllowRegistration()

  return <LoginClient allowRegistration={allowRegistration} />
}
