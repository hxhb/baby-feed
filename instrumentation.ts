export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { reminderScheduler } = await import('@/lib/reminder-scheduler')
    reminderScheduler.start()
  }
}
