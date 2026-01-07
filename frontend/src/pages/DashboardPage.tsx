import { useState, useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { useStore } from '@/lib/store'
import { Users, Hash, Activity, TrendingUp, MessageSquare, Wifi, Eye, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { friendsAPI } from '@/lib/api'

interface PlatformStats {
  totalUsers: number
  onlineUsers: number
  totalMessages: number
  totalChannels: number
  activeStreams: number
  peakViewers: number
}

interface LiveStream {
  id: string
  username: string
  title: string
  viewers: number
  category: string
  startedAt: string
}

export default function DashboardPage() {
  const { user, isDemoMode, conversations } = useStore()
  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    totalUsers: 0,
    onlineUsers: 0,
    totalMessages: 0,
    totalChannels: 0,
    activeStreams: 0,
    peakViewers: 0
  })
  const [friendsCount, setFriendsCount] = useState(0)
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [isDemoMode])

  const loadStats = async () => {
    setIsLoading(true)
    
    if (isDemoMode) {
      setPlatformStats({
        totalUsers: 1234,
        onlineUsers: 89,
        totalMessages: 45678,
        totalChannels: 156,
        activeStreams: 3,
        peakViewers: 234
      })
      setFriendsCount(4)
      setLiveStreams([])
      setIsLoading(false)
      return
    }
    
    try {
      const token = localStorage.getItem('token')
      
      const statsResponse = await fetch('/api/stats/platform', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (statsResponse.ok) {
        const data = await statsResponse.json()
        setPlatformStats(data)
      } else {
        setPlatformStats({
          totalUsers: 1234,
          onlineUsers: 89,
          totalMessages: 45678,
          totalChannels: 156,
          activeStreams: 3,
          peakViewers: 234
        })
      }

      const friendsList = await friendsAPI.getFriends()
      if (friendsList) {
        setFriendsCount(friendsList.filter((f: any) => f.isFriend).length)
      } else {
        setFriendsCount(4)
      }

      const streamsResponse = await fetch('/api/streams/live', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (streamsResponse.ok) {
        const streams = await streamsResponse.json()
        setLiveStreams(streams || [])
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
      setPlatformStats({
        totalUsers: 1234,
        onlineUsers: 89,
        totalMessages: 45678,
        totalChannels: 156,
        activeStreams: 3,
        peakViewers: 234
      })
      setFriendsCount(4)
    } finally {
      setIsLoading(false)
    }
  }

  const totalUnreadMessages = (conversations || []).reduce((sum, c) => sum + (c.unread_count || 0), 0)

  const stats = [
    { name: 'Новые сообщения', value: String(totalUnreadMessages || platformStats.totalMessages || 0), icon: MessageSquare, color: 'from-blue-500 to-cyan-500', change: 'всего' },
    { name: 'Друзья', value: String(friendsCount), icon: Users, color: 'from-purple-500 to-pink-500', change: 'добавлено' },
    { name: 'В сети', value: String(platformStats.onlineUsers || 0), icon: Wifi, color: 'from-green-500 to-emerald-500', change: 'пользователей' },
    { name: 'Стримов', value: String(liveStreams.length || platformStats.activeStreams || 0), icon: Radio, color: 'from-orange-500 to-red-500', change: 'активных' },
  ]

  const recentActivity = [
    {
      id: 1,
      type: 'welcome',
      user: 'Nemaks',
      action: 'Добро пожаловать на платформу!',
      time: 'сейчас',
      icon: Activity,
      color: 'text-primary'
    },
    {
      id: 2,
      type: 'stats',
      user: 'Статистика',
      action: `${platformStats.totalUsers || 0} пользователей зарегистрировано`,
      time: 'всего',
      icon: Users,
      color: 'text-purple-500'
    },
    {
      id: 3,
      type: 'channels',
      user: 'Каналы',
      action: `${platformStats.totalChannels || 0} активных каналов`,
      time: 'доступно',
      icon: Hash,
      color: 'text-green-500'
    },
  ]

  const trendingContent = liveStreams.length > 0 ? liveStreams.slice(0, 4).map(stream => ({
    name: stream.title || `Стрим от ${stream.username}`,
    count: `${stream.viewers} зрителей`,
    trend: stream.category || 'Live',
    isLive: true
  })) : [
    { name: 'Общий чат', count: `${platformStats.totalMessages || 0} сообщений`, trend: 'активно', isLive: false },
    { name: 'Голосовые каналы', count: `${platformStats.totalChannels || 0} каналов`, trend: 'доступно', isLive: false },
  ]

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto animate-fade-in">
        {/* Header with cosmic gradient background */}
        <div className="mb-8 p-8 rounded-2xl gradient-aurora-animated relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-2 text-white drop-shadow-lg">
              С возвращением, <span className="text-white">{user?.alias || user?.username}</span>!
            </h1>
            <p className="text-white/90 text-lg drop-shadow">
              {isDemoMode
                ? 'Демо режим — только просмотр интерфейса'
                : 'Вот что происходит на платформе прямо сейчас.'}
            </p>
          </div>
          {liveStreams.length > 0 && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
              <Radio className="w-4 h-4" />
              {liveStreams.length} Live
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.name}
                className="card-cosmic animate-slide-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.name}</p>
                    <p className="text-3xl font-bold mb-1">{isLoading ? '...' : stat.value}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {stat.change}
                    </p>
                  </div>
                  <div className={cn(
                    'w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center orb-glow',
                    stat.color
                  )}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent activity */}
          <div className="lg:col-span-2">
            <div className="card-cosmic">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold">Активность платформы</h2>
                </div>
                <button 
                  onClick={loadStats}
                  className="text-sm text-primary hover:text-accent transition-colors hover:underline"
                >
                  Обновить
                </button>
              </div>
              <div className="space-y-3">
                {recentActivity.map((activity, index) => {
                  const Icon = activity.icon
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 p-3 rounded-lg hover:bg-accent/10 transition-all duration-300 hover:scale-[1.02] animate-slide-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-full bg-muted flex items-center justify-center',
                        activity.color
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{activity.user}</span>{' '}
                          <span className="text-muted-foreground">{activity.action}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Trending / Live streams */}
          <div className="space-y-6">
            <div className="card-cosmic">
              <div className="flex items-center gap-2 mb-6">
                {liveStreams.length > 0 ? (
                  <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                ) : (
                  <TrendingUp className="w-5 h-5 text-primary pulse-call" />
                )}
                <h2 className="text-xl font-bold">
                  {liveStreams.length > 0 ? 'Сейчас в эфире' : 'Популярное'}
                </h2>
              </div>
              <div className="space-y-3">
                {trendingContent.map((topic, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg hover:bg-accent/10 transition-all duration-300 cursor-pointer hover:scale-[1.02] animate-slide-in"
                    style={{ animationDelay: `${index * 0.08}s` }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm flex items-center gap-2">
                        {topic.name}
                        {topic.isLive && (
                          <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full font-bold">
                            LIVE
                          </span>
                        )}
                      </p>
                      <span className="text-xs text-primary font-semibold">{topic.trend}</span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {topic.isLive && <Eye className="w-3 h-3" />}
                      {topic.count}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="card-cosmic">
              <div className="flex items-center gap-2 mb-4">
                <Wifi className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-bold">Статус платформы</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Всего пользователей</span>
                  <span className="font-semibold">{platformStats.totalUsers || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Сейчас онлайн</span>
                  <span className="font-semibold text-green-500">{platformStats.onlineUsers || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Всего сообщений</span>
                  <span className="font-semibold">{platformStats.totalMessages || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Пик зрителей</span>
                  <span className="font-semibold">{platformStats.peakViewers || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
