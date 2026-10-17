self.addEventListener('push', (event) => {
  let message = {}
  try { message = event.data ? event.data.json() : {} } catch { message = { body: event.data?.text() || '' } }
  const title = message.title || 'SenpaiAI'
  const options = {
    body: message.body || 'Bạn có một lời nhắc học tập mới.',
    icon: '/cat-logo.webp',
    badge: '/cat-logo.webp',
    data: { url: message.url || '/' },
    tag: message.tag || 'senpaiai-reminder',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetPath = event.notification.data?.url || '/'
  event.waitUntil((async () => {
    const target = new URL(targetPath, self.location.origin)
    if (target.origin !== self.location.origin) return
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(target.href)
        return client.focus()
      }
    }
    return self.clients.openWindow(target.href)
  })())
})
