self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : { title: 'Nebula', body: 'New notification' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/nebula-logo.png',
      badge: '/nebula-logo.png',
      tag: data.tag || 'default',
      data: data.url || '/'
    })
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i]
        if ('focus' in client) {
          client.focus()
          client.navigate(event.notification.data)
          return
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data)
      }
    })
  )
})
