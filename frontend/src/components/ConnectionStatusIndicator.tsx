import { useNotifications } from '@/contexts/NotificationContext'
import { Wifi, WifiOff, Loader2, Radio, RefreshCw } from 'lucide-react'
import { ConnectionType } from '@/lib/connectionManager'

const connectionTypeLabels: Record<ConnectionType, string> = {
  websocket: 'WebSocket',
  sse: 'SSE',
  long_polling: 'Long Polling',
  disconnected: 'Отключено'
}

const connectionTypeIcons: Record<ConnectionType, React.ComponentType<{ className?: string }>> = {
  websocket: Wifi,
  sse: Radio,
  long_polling: RefreshCw,
  disconnected: WifiOff
}

export function ConnectionStatusIndicator() {
  const { connectionStatus, connectionType } = useNotifications()

  if (connectionStatus === 'connected' && connectionType === 'websocket') {
    return null
  }

  const statusConfig = {
    disconnected: {
      icon: WifiOff,
      text: 'Отключено',
      bgColor: 'bg-red-500/90',
      animate: false
    },
    connecting: {
      icon: Loader2,
      text: 'Подключение...',
      bgColor: 'bg-yellow-500/90',
      animate: true
    },
    reconnecting: {
      icon: Loader2,
      text: 'Переподключение...',
      bgColor: 'bg-yellow-500/90',
      animate: true
    },
    error: {
      icon: WifiOff,
      text: 'Ошибка соединения',
      bgColor: 'bg-red-500/90',
      animate: false
    },
    connected: {
      icon: connectionTypeIcons[connectionType] || Wifi,
      text: connectionTypeLabels[connectionType] || 'Подключено',
      bgColor: connectionType === 'websocket' ? 'bg-green-500/90' : 'bg-blue-500/90',
      animate: false
    }
  }

  const config = statusConfig[connectionStatus] || statusConfig.disconnected
  const Icon = config.icon

  return (
    <div className={`fixed bottom-20 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm shadow-lg ${config.bgColor}`}>
      <Icon className={`w-4 h-4 ${config.animate ? 'animate-spin' : ''}`} />
      <span>{config.text}</span>
    </div>
  )
}
