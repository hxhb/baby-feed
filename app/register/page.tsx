export const dynamic = 'force-dynamic'

import { getAllowRegistration } from '@/lib/site-settings'
import RegisterClient from '@/app/register/RegisterClient'
export default async function RegisterPage() {
  const allowRegistration = await getAllowRegistration()

  return <RegisterClient allowRegistration={allowRegistration} />
}
