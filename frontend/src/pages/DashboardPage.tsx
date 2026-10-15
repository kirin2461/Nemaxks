import { useState, useEffect } from 'react'
import { Link } from 'wouter'
import { useTranslation } from 'react-i18next'
import { Layout } from '@/components/Layout'
import { useStore } from '@/lib/store'
import { Users, Hash, Activity, TrendingUp, MessageSquare, Wifi, Eye, Radio, Sparkles, Rss, Crown, UserPlus, Video, Phone } from 'lucide-react'
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
  const { t } = useTranslation()
  const { user, isDemoMode, conversations, liteMode } = useStore()
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
    const controller = new AbortController()
    let cancelled = false
    loadStats(controller.signal, () => cancelled)
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isDemoMode])

  const loadStats = async (signal?: AbortSignal, isCancelled?: () => boolean) => {
    const cancelled = () => isCancelled?.() === true
    if (!cancelled()) setIsLoading(true)

    if (isDemoMode) {
      if (cancelled()) return
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
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      })
      if (cancelled()) return
      if (statsResponse.ok) {
        const data = await statsResponse.json()
        if (cancelled()) return
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
      if (cancelled()) return
      if (friendsList) {
        setFriendsCount(friendsList.filter((f: any) => f.isFriend).length)
      } else {
        setFriendsCount(4)
      }

      const streamsResponse = await fetch('/api/streams/live', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      })
      if (cancelled()) return
      if (streamsResponse.ok) {
        const streams = await streamsResponse.json()
        if (cancelled()) return
        setLiveStreams(streams || [])
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || cancelled()) return
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
      if (!cancelled()) setIsLoading(false)
    }
  }

  const totalUnreadMessages = (conversations || []).reduce((sum, c) => sum + (c.unread_count || 0), 0)

  const stats = [
    { name: 'Друзья', value: String(friendsCount), icon: Users, change: 'добавлено' },
    { name: 'В сети', value: String(platformStats.onlineUsers || 0), icon: Wifi, change: 'пользователей' },
    { name: 'Стримов', value: String(liveStreams.length || platformStats.activeStreams || 0), icon: Radio, change: 'активных' },
  ]

  const recentActivity = [
    {
      id: 1,
      type: 'welcome',
      user: 'Nebula',
      action: 'Добро пожаловать на платформу!',
      time: 'сейчас',
      icon: Activity,
      color: 'text-emerald-600'
    },
    {
      id: 2,
      type: 'stats',
      user: 'Статистика',
      action: `${platformStats.totalUsers || 0} пользователей зарегистрировано`,
      time: 'всего',
      icon: Users,
      color: 'text-graphite-500'
    },
    {
      id: 3,
      type: 'channels',
      user: 'Каналы',
      action: `${platformStats.totalChannels || 0} активных каналов`,
      time: 'доступно',
      icon: Hash,
      color: 'text-emerald-600'
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
      <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto animate-rise-in">
        {/* Header */}
        <div className="mb-6 md:mb-8 p-4 md:p-6 lg:p-8 rounded-2xl border border-border bg-card shadow-soft relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Дашборд</p>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-2 text-graphite-900">
              С возвращением, {user?.alias || user?.username}!
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              {isDemoMode
                ? 'Демо режим — только просмотр интерфейса'
                : 'Вот что происходит на платформе прямо сейчас.'}
            </p>
          </div>
          {liveStreams.length > 0 && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-xs font-medium">
              <Radio className="w-4 h-4" />
              {liveStreams.length} Live
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6 mb-6 md:mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.name}
                className="rounded-xl border border-border bg-card shadow-none p-5 animate-rise-in"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1 truncate">{stat.name}</p>
                    <p className="text-xl md:text-2xl lg:text-3xl font-display font-bold mb-1 text-graphite-900 animate-count-flick" style={{ animationDelay: `${index * 80}ms` }}>{isLoading ? '...' : stat.value}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-secondary text-secondary-foreground font-medium">{stat.change}</span>
                    </p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-accent text-emerald-700 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={1.75} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Quick access for lite mode - shows hidden features */}
        {liteMode && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-muted-foreground">{t('common.more')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Link href="/feed">
                <div className="rounded-xl border border-border bg-card shadow-soft p-4 text-center hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 transition-all duration-150 cursor-pointer">
                  <Rss className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                  <span className="text-sm">{t('nav.feed')}</span>
                </div>
              </Link>
              <Link href="/jarvis">
                <div className="rounded-xl border border-border bg-card shadow-soft p-4 text-center hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 transition-all duration-150 cursor-pointer">
                  <Sparkles className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                  <span className="text-sm">{t('nav.jarvis')}</span>
                </div>
              </Link>
              <Link href="/video">
                <div className="rounded-xl border border-border bg-card shadow-soft p-4 text-center hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 transition-all duration-150 cursor-pointer">
                  <Video className="w-6 h-6 mx-auto mb-2 text-graphite-600" />
                  <span className="text-sm">{t('nav.video')}</span>
                </div>
              </Link>
              <Link href="/call">
                <div className="rounded-xl border border-border bg-card shadow-soft p-4 text-center hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 transition-all duration-150 cursor-pointer">
                  <Phone className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                  <span className="text-sm">{t('nav.calls')}</span>
                </div>
              </Link>
              <Link href="/premium">
                <div className="rounded-xl border border-border bg-card shadow-soft p-4 text-center hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 transition-all duration-150 cursor-pointer">
                  <Crown className="w-6 h-6 mx-auto mb-2 text-warning" />
                  <span className="text-sm">{t('nav.premium')}</span>
                </div>
              </Link>
              <Link href="/invite">
                <div className="rounded-xl border border-border bg-card shadow-soft p-4 text-center hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 transition-all duration-150 cursor-pointer">
                  <UserPlus className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                  <span className="text-sm">{t('nav.invite')}</span>
                </div>
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent activity */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card shadow-soft p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
                  <h2 className="text-xl font-display font-bold">Активность платформы</h2>
                </div>
                <button
                  onClick={() => loadStats()}
                  className="text-sm text-primary hover:underline underline-offset-4 transition-colors"
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
                      className="flex items-start gap-4 p-3 rounded-lg hover:bg-accent/60 transition-colors duration-150 animate-rise-in"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div className={cn(
                        'h-9 w-9 rounded-full bg-secondary grid place-items-center shrink-0',
                        activity.color
                      )}>
                        <Icon className="w-4 h-4" strokeWidth={1.75} />
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
            <div className="rounded-xl border border-border bg-card shadow-soft p-6">
              <div className="flex items-center gap-2 mb-6">
                {liveStreams.length > 0 ? (
                  <Radio className="w-5 h-5 text-destructive" strokeWidth={1.75} />
                ) : (
                  <TrendingUp className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
                )}
                <h2 className="text-xl font-display font-bold">
                  {liveStreams.length > 0 ? 'Сейчас в эфире' : 'Популярное'}
                </h2>
              </div>
              <div className="space-y-3">
                {trendingContent.map((topic, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg hover:bg-accent/60 transition-colors duration-150 cursor-pointer animate-rise-in"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm flex items-center gap-2">
                        {topic.name}
                        {topic.isLive && (
                          <span className="px-1.5 py-0.5 bg-destructive text-destructive-foreground text-[10px] rounded-full font-semibold">
                            LIVE
                          </span>
                        )}
                      </p>
                      <span className="text-xs text-emerald-700 font-semibold">{topic.trend}</span>
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
            <div className="rounded-xl border border-border bg-card shadow-soft p-6">
              <div className="flex items-center gap-2 mb-4">
                <Wifi className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
                <h2 className="text-lg font-display font-bold">Статус платформы</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">Всего пользователей</span>
                  <span className="font-semibold">{platformStats.totalUsers || 0}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">Сейчас онлайн</span>
                  <span className="font-semibold text-emerald-600">{platformStats.onlineUsers || 0}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">Всего сообщений</span>
                  <span className="font-semibold">{platformStats.totalMessages || 0}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
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
