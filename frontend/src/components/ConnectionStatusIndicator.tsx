import { useNotifications } from '@/contexts/NotificationContext'

export function ConnectionStatusIndicator() {
  const { connectionStatus, connectionType } = useNotifications()

  if (connectionStatus === 'connected' && connectionType === 'websocket') {
    return null
  }

  let color = 'bg-red-500'
  
  if (connectionStatus === 'connected') {
    if (connectionType === 'sse' || connectionType === 'long_polling') {
      color = 'bg-orange-500'
    } else {
      color = 'bg-green-500'
    }
  } else if (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') {
    color = 'bg-orange-500'
  }

  return (
    <div 
      className={`fixed bottom-4 left-4 z-50 w-3 h-3 rounded-sm ${color} shadow-lg`}
      title={connectionStatus === 'connected' ? connectionType : connectionStatus}
    />
  )
}
