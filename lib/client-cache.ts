export async function clearServiceWorkerCache(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return
  }

  const channel = new MessageChannel()
  navigator.serviceWorker.controller.postMessage(
    { type: 'CLEAR_CACHE' },
    [channel.port2],
  )

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      channel.port1.close()
      resolve()
    }
    const timeoutId = window.setTimeout(finish, 1_000)
    channel.port1.onmessage = finish
  })
}
