import { useState, useEffect, useRef } from 'react'
import { Layout } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { useStore } from '@/lib/store'
import { 
  superAdminAPI, 
  adminAPI,
  type SuperAdminStats, 
  type UserWithStatus,
  type UserDetail,
  type GuildWithStats,
  type ServiceStatus,
  type JarvisStats,
  type AuditLog,
  type AbuseReport,
  type NotificationBanner
} from '@/lib/api'
import {
  Users,
  Shield,
  AlertTriangle,
  Activity,
  Server,
  Settings,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  MessageSquare,
  Globe,
  Key,
  Lock,
  Unlock,
  UserCog,
  Building2,
  Eye,
  Trash2,
  RefreshCw,
  Bot,
  Database,
  Wifi,
  WifiOff,
  ChevronRight,
  Copy,
  LogOut,
  Crown,
  BarChart3,
  FileText,
  Ban,
  Bell,
  Plus,
  Edit,
  AlertCircle,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

type TabType = 'dashboard' | 'users' | 'guilds' | 'moderation' | 'monitoring' | 'jarvis' | 'banners'

export default function SuperAdminPage() {
  const { user } = useStore()
  const toast = useToast()
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [stats, setStats] = useState<SuperAdminStats | null>(null)
  const [users, setUsers] = useState<UserWithStatus[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [guilds, setGuilds] = useState<GuildWithStats[]>([])
  const [guildsTotal, setGuildsTotal] = useState(0)
  const [guildsPage, setGuildsPage] = useState(1)
  const [guildSearch, setGuildSearch] = useState('')
  const [reports, setReports] = useState<AbuseReport[]>([])
  const [securityLogs, setSecurityLogs] = useState<AuditLog[]>([])
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null)
  const [jarvisStats, setJarvisStats] = useState<JarvisStats | null>(null)
  const [banners, setBanners] = useState<NotificationBanner[]>([])
  const [showBannerForm, setShowBannerForm] = useState(false)
  const [editingBanner, setEditingBanner] = useState<NotificationBanner | null>(null)
  const [bannerForm, setBannerForm] = useState({ title: '', message: '', type: 'info', expires_at: '' })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  const loadSeqRef = useRef(0)

  // При размонтировании инвалидируем все летящие запросы
  useEffect(() => {
    return () => { loadSeqRef.current++ }
  }, [])

  useEffect(() => {
    loadData()
  }, [activeTab, usersPage, userSearch, roleFilter, statusFilter, guildsPage, guildSearch])

  const loadData = async () => {
    // Защита от гонки: ответ устаревшего запроса не затирает актуальное состояние
    const seq = ++loadSeqRef.current
    const stale = () => seq !== loadSeqRef.current
    setLoading(true)
    try {
      switch (activeTab) {
        case 'dashboard':
          const statsData = await superAdminAPI.getStats()
          if (stale()) return
          setStats(statsData)
          const statusData = await superAdminAPI.getServiceStatus()
          if (stale()) return
          setServiceStatus(statusData)
          break
        case 'users':
          const usersData = await superAdminAPI.getUsers(usersPage, 20, userSearch, roleFilter, statusFilter)
          if (stale()) return
          setUsers(usersData.users || [])
          setUsersTotal(usersData.total)
          break
        case 'guilds':
          const guildsData = await superAdminAPI.getGuilds(guildsPage, 20, guildSearch)
          if (stale()) return
          setGuilds(guildsData.guilds || [])
          setGuildsTotal(guildsData.total)
          break
        case 'moderation':
          const reportsData = await adminAPI.getReports()
          if (stale()) return
          setReports(reportsData || [])
          break
        case 'monitoring':
          const logsData = await superAdminAPI.getSecurityLogs(1, 50)
          if (stale()) return
          setSecurityLogs(logsData.logs || [])
          const svcStatus = await superAdminAPI.getServiceStatus()
          if (stale()) return
          setServiceStatus(svcStatus)
          break
        case 'jarvis':
          const jStats = await superAdminAPI.getJarvisStats()
          if (stale()) return
          setJarvisStats(jStats)
          break
        case 'banners':
          const bannersData = await superAdminAPI.getBanners()
          if (stale()) return
          setBanners(bannersData.banners || [])
          break
      }
    } catch (error) {
      if (stale()) return
      console.error('Failed to load data:', error)
    } finally {
      if (!stale()) setLoading(false)
    }
  }

  const handleCreateBanner = async () => {
    if (!bannerForm.title || !bannerForm.message) return
    setActionLoading(true)
    try {
      await superAdminAPI.createBanner({
        title: bannerForm.title,
        message: bannerForm.message,
        type: bannerForm.type,
        expires_at: bannerForm.expires_at || undefined
      })
      setBannerForm({ title: '', message: '', type: 'info', expires_at: '' })
      setShowBannerForm(false)
      loadData()
    } catch (error) {
      console.error('Failed to create banner:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateBanner = async () => {
    if (!editingBanner) return
    setActionLoading(true)
    try {
      await superAdminAPI.updateBanner(editingBanner.id, {
        title: bannerForm.title,
        message: bannerForm.message,
        type: bannerForm.type,
        expires_at: bannerForm.expires_at || undefined
      })
      setBannerForm({ title: '', message: '', type: 'info', expires_at: '' })
      setEditingBanner(null)
      loadData()
    } catch (error) {
      console.error('Failed to update banner:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleBanner = async (banner: NotificationBanner) => {
    setActionLoading(true)
    try {
      await superAdminAPI.updateBanner(banner.id, { is_active: !banner.is_active })
      loadData()
    } catch (error) {
      console.error('Failed to toggle banner:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteBanner = (bannerId: number) => {
    setConfirmAction({
      title: 'Удаление уведомления',
      message: 'Удалить это уведомление?',
      onConfirm: async () => {
        setActionLoading(true)
        try {
          await superAdminAPI.deleteBanner(bannerId)
          loadData()
          toast.success('Уведомление удалено')
        } catch (error) {
          console.error('Failed to delete banner:', error)
          toast.error('Не удалось удалить уведомление')
        } finally {
          setActionLoading(false)
        }
      }
    })
  }

  const loadUserDetail = async (userId: number) => {
    try {
      const detail = await superAdminAPI.getUserDetail(userId)
      setSelectedUser(detail)
    } catch (error) {
      console.error('Failed to load user detail:', error)
    }
  }

  const handleResetPassword = (userId: number) => {
    setConfirmAction({
      title: 'Сброс пароля',
      message: 'Сбросить пароль пользователя? Это завершит все его сессии.',
      onConfirm: async () => {
        setActionLoading(true)
        try {
          const result = await superAdminAPI.resetPassword(userId)
          setTempPassword(result.temp_password)
          loadUserDetail(userId)
          toast.success('Пароль сброшен')
        } catch (error) {
          console.error('Failed to reset password:', error)
          toast.error('Не удалось сбросить пароль')
        } finally {
          setActionLoading(false)
        }
      }
    })
  }

  const handleChangeRole = (userId: number, newRole: string) => {
    setConfirmAction({
      title: 'Смена роли',
      message: `Изменить роль пользователя на «${newRole}»?`,
      onConfirm: async () => {
        setActionLoading(true)
        try {
          await superAdminAPI.changeRole(userId, newRole)
          loadData()
          if (selectedUser) loadUserDetail(userId)
          toast.success('Роль пользователя изменена')
        } catch (error) {
          console.error('Failed to change role:', error)
          toast.error('Не удалось изменить роль')
        } finally {
          setActionLoading(false)
        }
      }
    })
  }

  const handleRevokeAllSessions = (userId: number) => {
    setConfirmAction({
      title: 'Отзыв сессий',
      message: 'Отозвать все сессии пользователя? Он будет разлогинен на всех устройствах.',
      onConfirm: async () => {
        setActionLoading(true)
        try {
          await superAdminAPI.revokeAllSessions(userId)
          loadUserDetail(userId)
          toast.success('Все сессии отозваны')
        } catch (error) {
          console.error('Failed to revoke sessions:', error)
          toast.error('Не удалось отозвать сессии')
        } finally {
          setActionLoading(false)
        }
      }
    })
  }

  const handleBanUser = async (userId: number, reason: string) => {
    setActionLoading(true)
    try {
      await adminAPI.banUser(userId.toString(), reason)
      loadData()
      if (selectedUser) loadUserDetail(userId)
    } catch (error) {
      console.error('Failed to ban user:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnbanUser = async (userId: number) => {
    setActionLoading(true)
    try {
      await adminAPI.unbanUser(userId.toString())
      loadData()
      if (selectedUser) loadUserDetail(userId)
    } catch (error) {
      console.error('Failed to unban user:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleTransferGuild = async (guildId: number) => {
    const newOwnerId = prompt('Enter new owner user ID:')
    if (!newOwnerId) return
    setActionLoading(true)
    try {
      await superAdminAPI.transferGuild(guildId, parseInt(newOwnerId))
      loadData()
    } catch (error) {
      console.error('Failed to transfer guild:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteGuild = (guildId: number, name: string) => {
    setConfirmAction({
      title: 'Удаление сервера',
      message: `Удалить сервер «${name}» навсегда? Это действие нельзя отменить.`,
      onConfirm: async () => {
        setActionLoading(true)
        try {
          await superAdminAPI.deleteGuild(guildId)
          loadData()
          toast.success('Сервер удалён')
        } catch (error) {
          console.error('Failed to delete guild:', error)
          toast.error('Не удалось удалить сервер')
        } finally {
          setActionLoading(false)
        }
      }
    })
  }

  if (user?.role !== 'super_admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center animate-rise-in">
            <div className="h-20 w-20 mx-auto rounded-2xl bg-secondary grid place-items-center mb-4">
              <Shield className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-display font-bold text-graphite-900 mb-2">Доступ запрещён</h2>
            <p className="text-muted-foreground">Требуются права супер-администратора</p>
          </div>
        </div>
      </Layout>
    )
  }

  const tabs = [
    { id: 'dashboard', label: 'Обзор', icon: BarChart3 },
    { id: 'users', label: 'Пользователи', icon: Users },
    { id: 'guilds', label: 'Серверы', icon: Building2 },
    { id: 'moderation', label: 'Модерация', icon: Shield },
    { id: 'monitoring', label: 'Мониторинг', icon: Activity },
    { id: 'jarvis', label: 'JARVIS', icon: Bot },
    { id: 'banners', label: 'Уведомления', icon: Bell },
  ] as const

  return (
    <Layout>
      <div className="max-w-[1440px] mx-auto px-6 py-6 animate-rise-in">
        <div className="flex items-center gap-3 mb-6">
          <Crown className="w-7 h-7 text-emerald-700" />
          <h1 className="text-2xl font-display font-bold text-graphite-900">Панель супер-администратора</h1>
        </div>

        <div className="flex gap-4 mb-6 border-b border-border overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedUser(null) }}
              className={cn(
                "flex items-center gap-2 pb-2.5 -mb-px whitespace-nowrap text-sm font-medium border-b-2 transition-colors duration-150",
                activeTab === tab.id
                  ? "text-foreground border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={Users} label="Всего пользователей" value={stats.users} color="blue" />
                  <StatCard icon={Globe} label="Сейчас онлайн" value={stats.online_users} color="green" />
                  <StatCard icon={TrendingUp} label="Новые сегодня" value={stats.today_new_users} color="purple" />
                  <StatCard icon={Key} label="Активные сессии" value={stats.active_sessions} color="yellow" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={MessageSquare} label="Сообщения сегодня" value={stats.today_messages} color="cyan" />
                  <StatCard icon={Building2} label="Серверы" value={stats.guilds} color="indigo" />
                  <StatCard icon={AlertTriangle} label="Ожидающие жалобы" value={stats.pending_reports} color="orange" />
                  <StatCard icon={Ban} label="Активные баны" value={stats.active_bans} color="red" />
                </div>

                {serviceStatus && (
                  <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Server className="w-5 h-5" /> Статус сервисов
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <ServiceStatusBadge name="Database" status={serviceStatus.services.database} />
                      <ServiceStatusBadge name="Redis" status={serviceStatus.services.redis} />
                      <ServiceStatusBadge name="LiveKit" status={serviceStatus.services.livekit} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Поиск пользователей..."
                        value={userSearch}
                        onChange={(e) => { setUserSearch(e.target.value); setUsersPage(1) }}
                        className="input-field pl-10"
                      />
                    </div>
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => { setRoleFilter(e.target.value); setUsersPage(1) }}
                    className="input-field !w-auto px-4 py-2"
                  >
                    <option value="">Все роли</option>
                    <option value="user">Пользователь</option>
                    <option value="moderator">Модератор</option>
                    <option value="admin">Администратор</option>
                    <option value="super_admin">Супер-администратор</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setUsersPage(1) }}
                    className="input-field !w-auto px-4 py-2"
                  >
                    <option value="">Все статусы</option>
                    <option value="active">Активен</option>
                    <option value="banned">Заблокирован</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-none overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-secondary/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        <tr>
                          <th className="text-left px-4 py-3">Пользователь</th>
                          <th className="text-left px-4 py-3">Роль</th>
                          <th className="text-left px-4 py-3">Статус</th>
                          <th className="text-left px-4 py-3">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} className="border-t border-border hover:bg-accent/40 transition-colors duration-150">
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-3">
                                <Avatar alt={u.username} src={u.avatar} size="sm" />
                                <div>
                                  <div className="font-medium">{u.username}</div>
                                  <div className="text-xs text-muted-foreground">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <RoleBadge role={u.role} />
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                {u.is_banned ? (
                                  <span className="text-destructive text-sm flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-destructive" /> Заблокирован
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 text-sm flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600" /> Активен
                                  </span>
                                )}
                                {u.has_2fa && (
                                  <span title="2FA включена"><Lock className="w-3 h-3 text-primary" /></span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <button
                                onClick={() => loadUserDetail(u.id)}
                                className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150"
                                title="Подробнее"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-3 flex justify-between items-center border-t border-border">
                      <span className="text-sm text-muted-foreground">
                        Page {usersPage} of {Math.ceil(usersTotal / 20)}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                          disabled={usersPage <= 1}
                          className="h-8 px-3 rounded-lg border border-input bg-card text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors duration-150"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setUsersPage(p => p + 1)}
                          disabled={usersPage >= Math.ceil(usersTotal / 20)}
                          className="h-8 px-3 rounded-lg border border-input bg-card text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors duration-150"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedUser && (
                    <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-soft animate-slide-in-right">
                      <div className="flex items-center gap-3">
                        <Avatar alt={selectedUser.user.username} src={selectedUser.user.avatar} size="lg" />
                        <div>
                          <h3 className="font-semibold text-lg">{selectedUser.user.username}</h3>
                          <p className="text-sm text-muted-foreground">{selectedUser.user.email}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-secondary p-2 rounded-lg">
                          <div className="text-lg font-display font-bold text-graphite-900">{selectedUser.stats.posts}</div>
                          <div className="text-xs text-muted-foreground">Посты</div>
                        </div>
                        <div className="bg-secondary p-2 rounded-lg">
                          <div className="text-lg font-display font-bold text-graphite-900">{selectedUser.stats.messages}</div>
                          <div className="text-xs text-muted-foreground">Сообщения</div>
                        </div>
                        <div className="bg-secondary p-2 rounded-lg">
                          <div className="text-lg font-display font-bold text-graphite-900">{selectedUser.stats.guilds}</div>
                          <div className="text-xs text-muted-foreground">Серверы</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Изменить роль</label>
                        <select
                          value={selectedUser.user.role}
                          onChange={(e) => handleChangeRole(Number(selectedUser.user.id), e.target.value)}
                          disabled={actionLoading}
                          className="input-field"
                        >
                          <option value="user">Пользователь</option>
                          <option value="moderator">Модератор</option>
                          <option value="admin">Администратор</option>
                          <option value="super_admin">Супер-администратор</option>
                        </select>
                      </div>

                      <div className="rounded-xl border border-destructive/30 bg-danger-soft/40 p-3 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-destructive">Опасная зона</p>
                        <button
                          onClick={() => handleResetPassword(Number(selectedUser.user.id))}
                          disabled={actionLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-warning/40 bg-card text-warning text-sm font-medium hover:bg-warning-soft active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
                        >
                          <Key className="w-4 h-4" /> Сбросить пароль
                        </button>
                        {tempPassword && (
                          <div className="p-2 bg-graphite-100 border border-border rounded-lg flex items-center justify-between">
                            <code className="text-sm font-mono">{tempPassword}</code>
                            <button
                              onClick={() => { navigator.clipboard.writeText(tempPassword); setTempPassword(null) }}
                              className="p-1 rounded hover:bg-secondary text-muted-foreground"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => handleRevokeAllSessions(Number(selectedUser.user.id))}
                          disabled={actionLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-warning/40 bg-card text-warning text-sm font-medium hover:bg-warning-soft active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
                        >
                          <LogOut className="w-4 h-4" /> Завершить все сессии
                        </button>

                        {selectedUser.is_banned ? (
                          <button
                            onClick={() => handleUnbanUser(Number(selectedUser.user.id))}
                            disabled={actionLoading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-emerald-300 bg-card text-emerald-700 text-sm font-medium hover:bg-success-soft active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
                          >
                            <Unlock className="w-4 h-4" /> Разблокировать
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const reason = prompt('Причина бана:')
                              if (reason) handleBanUser(Number(selectedUser.user.id), reason)
                            }}
                            disabled={actionLoading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-destructive/40 bg-card text-destructive text-sm font-medium hover:bg-danger-soft active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
                          >
                            <Ban className="w-4 h-4" /> Заблокировать
                          </button>
                        )}
                      </div>

                      {selectedUser.sessions.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Активные сессии ({selectedUser.sessions.length})</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {selectedUser.sessions.map(s => (
                              <div key={s.id} className="text-xs bg-graphite-100 border border-border p-2 rounded-lg flex justify-between">
                                <span>{s.device_info || 'Неизвестно'}</span>
                                <span className="text-muted-foreground">{s.ip_address}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'guilds' && (
              <div className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Поиск серверов..."
                    value={guildSearch}
                    onChange={(e) => { setGuildSearch(e.target.value); setGuildsPage(1) }}
                    className="input-field pl-10"
                  />
                </div>

                <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-secondary/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-3">Сервер</th>
                        <th className="text-left px-4 py-3">Владелец</th>
                        <th className="text-left px-4 py-3">Участники</th>
                        <th className="text-left px-4 py-3">Каналы</th>
                        <th className="text-left px-4 py-3">Сообщения</th>
                        <th className="text-left px-4 py-3">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guilds.map(g => (
                        <tr key={g.id} className="border-t border-border hover:bg-accent/40 transition-colors duration-150">
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-secondary text-graphite-600 rounded-lg flex items-center justify-center overflow-hidden">
                                {g.icon ? (
                                  <img src={g.icon} alt="" className="w-full h-full object-cover rounded-lg" />
                                ) : (
                                  <Building2 className="w-5 h-5" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium">{g.name}</div>
                                <div className="text-xs text-muted-foreground font-mono">ID: {g.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {g.owner?.username || `User #${g.owner_id}`}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">{g.member_count}</td>
                          <td className="px-4 py-3 text-sm font-mono">{g.channel_count}</td>
                          <td className="px-4 py-3 text-sm font-mono">{g.message_count}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleTransferGuild(g.id)}
                                className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150"
                                title="Передать владение"
                              >
                                <Crown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteGuild(g.id, g.name)}
                                className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-destructive hover:bg-danger-soft transition-colors duration-150"
                                title="Удалить сервер"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 flex justify-between items-center border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      Total: {guildsTotal} guilds
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setGuildsPage(p => Math.max(1, p - 1))}
                        disabled={guildsPage <= 1}
                        className="h-8 px-3 rounded-lg border border-input bg-card text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors duration-150"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setGuildsPage(p => p + 1)}
                        disabled={guildsPage >= Math.ceil(guildsTotal / 20)}
                        className="h-8 px-3 rounded-lg border border-input bg-card text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors duration-150"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'moderation' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Ожидающие жалобы
                </h2>
                <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
                  {reports.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Нет ожидающих жалоб
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-secondary/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        <tr>
                          <th className="text-left px-4 py-3">Автор жалобы</th>
                          <th className="text-left px-4 py-3">Тип</th>
                          <th className="text-left px-4 py-3">Причина</th>
                          <th className="text-left px-4 py-3">Статус</th>
                          <th className="text-left px-4 py-3">Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map(r => (
                          <tr key={r.id} className="border-t border-border hover:bg-accent/40 transition-colors duration-150">
                            <td className="px-4 py-3 text-sm font-mono">{r.reporter_id}</td>
                            <td className="px-4 py-3 text-sm">{r.target_type}</td>
                            <td className="px-4 py-3 text-sm">{r.reason}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                                r.status === 'pending' && "bg-warning-soft text-[hsl(32_95%_30%)]",
                                r.status === 'resolved' && "bg-success-soft text-emerald-800",
                                r.status === 'rejected' && "bg-danger-soft text-destructive"
                              )}>
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                              {format(new Date(r.created_at), 'MMM d, yyyy')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'monitoring' && (
              <div className="space-y-6">
                {serviceStatus && (
                  <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Server className="w-5 h-5" /> Статус сервисов
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <ServiceStatusBadge name="Database" status={serviceStatus.services.database} />
                      <ServiceStatusBadge name="Redis" status={serviceStatus.services.redis} />
                      <ServiceStatusBadge name="LiveKit" status={serviceStatus.services.livekit} />
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Security Logs
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {securityLogs.map(log => (
                      <div key={log.id} className="flex items-center justify-between p-3 bg-graphite-100 border border-border rounded-lg hover:bg-accent/40 transition-colors duration-150">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            log.action.includes('fail') ? "bg-destructive" :
                            log.action.includes('ban') ? "bg-warning" :
                            "bg-emerald-600"
                          )} />
                          <div>
                            <div className="font-medium text-sm font-mono">{log.action}</div>
                            <div className="text-xs text-muted-foreground">
                              {log.target}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono">{log.ip_address}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {format(new Date(log.created_at), 'MMM d, HH:mm')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'jarvis' && jarvisStats && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <StatCard icon={Bot} label="Всего запросов" value={jarvisStats.total_requests} color="purple" />
                  <StatCard icon={Clock} label="Запросы сегодня" value={jarvisStats.today_requests} color="blue" />
                </div>

                <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
                  <h3 className="text-lg font-semibold mb-4">Топ пользователей JARVIS</h3>
                  <div className="space-y-2">
                    {(jarvisStats.top_users || []).map((u, i) => (
                      <div key={u.user_id} className="flex items-center justify-between p-3 bg-graphite-100 border border-border rounded-lg hover:bg-accent/40 transition-colors duration-150">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <span className="font-medium text-sm">{u.username}</span>
                        </div>
                        <span className="text-muted-foreground font-mono text-sm">{u.requests} requests</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'banners' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Управление уведомлениями</h2>
                  <button
                    onClick={() => {
                      setBannerForm({ title: '', message: '', type: 'info', expires_at: '' })
                      setShowBannerForm(true)
                      setEditingBanner(null)
                    }}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150"
                  >
                    <Plus className="w-4 h-4" /> Создать уведомление
                  </button>
                </div>

                {(showBannerForm || editingBanner) && (
                  <div className="rounded-xl border border-border bg-card p-6 shadow-soft animate-rise-in">
                    <h3 className="text-lg font-semibold mb-4">
                      {editingBanner ? 'Редактировать уведомление' : 'Новое уведомление'}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Заголовок</label>
                        <input
                          type="text"
                          value={bannerForm.title}
                          onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                          className="input-field"
                          placeholder="Заголовок уведомления"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Сообщение</label>
                        <textarea
                          value={bannerForm.message}
                          onChange={(e) => setBannerForm({ ...bannerForm, message: e.target.value })}
                          className="input-field resize-none"
                          rows={3}
                          placeholder="Текст уведомления"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Тип</label>
                          <select
                            value={bannerForm.type}
                            onChange={(e) => setBannerForm({ ...bannerForm, type: e.target.value })}
                            className="input-field"
                          >
                            <option value="info">Информация</option>
                            <option value="success">Успех</option>
                            <option value="warning">Предупреждение</option>
                            <option value="error">Ошибка</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Истекает (опционально)</label>
                          <input
                            type="datetime-local"
                            value={bannerForm.expires_at}
                            onChange={(e) => setBannerForm({ ...bannerForm, expires_at: e.target.value })}
                            className="input-field"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={editingBanner ? handleUpdateBanner : handleCreateBanner}
                          disabled={actionLoading || !bannerForm.title || !bannerForm.message}
                          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150"
                        >
                          {editingBanner ? 'Сохранить' : 'Создать'}
                        </button>
                        <button
                          onClick={() => {
                            setShowBannerForm(false)
                            setEditingBanner(null)
                            setBannerForm({ title: '', message: '', type: 'info', expires_at: '' })
                          }}
                          className="h-10 px-4 rounded-lg border border-input bg-card text-sm font-medium hover:bg-accent hover:text-accent-foreground active:scale-[0.97] transition-all duration-150"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {banners.length === 0 ? (
                    <div className="text-center py-16 px-6 animate-rise-in">
                      <div className="h-20 w-20 mx-auto rounded-2xl bg-secondary grid place-items-center mb-4">
                        <Bell className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                      </div>
                      <p className="text-lg font-semibold">Нет уведомлений</p>
                    </div>
                  ) : (
                    banners.map(banner => (
                      <div
                        key={banner.id}
                        className={cn(
                          "rounded-xl border border-border bg-card shadow-soft p-4 border-l-4",
                          banner.type === 'info' && "border-l-graphite-400",
                          banner.type === 'success' && "border-l-emerald-600",
                          banner.type === 'warning' && "border-l-warning",
                          banner.type === 'error' && "border-l-destructive",
                          !banner.is_active && "opacity-50"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {banner.type === 'info' && <Info className="w-4 h-4 text-graphite-500" />}
                              {banner.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                              {banner.type === 'warning' && <AlertTriangle className="w-4 h-4 text-warning" />}
                              {banner.type === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
                              <h4 className="font-semibold">{banner.title}</h4>
                              {!banner.is_active && (
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-muted-foreground">Неактивно</span>
                              )}
                            </div>
                            <p className="text-muted-foreground">{banner.message}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>Создано: {format(new Date(banner.created_at), 'dd.MM.yyyy HH:mm')}</span>
                              {banner.expires_at && (
                                <span>Истекает: {format(new Date(banner.expires_at), 'dd.MM.yyyy HH:mm')}</span>
                              )}
                              {banner.creator && <span>Автор: {banner.creator.username}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleBanner(banner)}
                              disabled={actionLoading}
                              className={cn(
                                "h-8 w-8 rounded-lg inline-flex items-center justify-center transition-colors duration-150",
                                banner.is_active
                                  ? "text-emerald-700 hover:bg-success-soft"
                                  : "text-muted-foreground hover:bg-secondary"
                              )}
                              title={banner.is_active ? 'Деактивировать' : 'Активировать'}
                            >
                              {banner.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                setEditingBanner(banner)
                                setBannerForm({
                                  title: banner.title,
                                  message: banner.message,
                                  type: banner.type,
                                  expires_at: banner.expires_at ? banner.expires_at.slice(0, 16) : ''
                                })
                              }}
                              className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150"
                              title="Редактировать"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBanner(banner.id)}
                              disabled={actionLoading}
                              className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-destructive hover:bg-danger-soft transition-colors duration-150"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          confirmAction?.onConfirm()
          setConfirmAction(null)
        }}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        variant="danger"
      />
    </Layout>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-secondary text-graphite-600',
    green: 'bg-success-soft text-emerald-700',
    purple: 'bg-secondary text-graphite-600',
    yellow: 'bg-warning-soft text-warning',
    cyan: 'bg-success-soft text-emerald-700',
    indigo: 'bg-secondary text-graphite-600',
    orange: 'bg-warning-soft text-warning',
    red: 'bg-danger-soft text-destructive',
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft animate-count-flick">
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-lg grid place-items-center", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-display font-bold text-graphite-900">{value.toLocaleString()}</div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  )
}

function ServiceStatusBadge({ name, status }: { name: string; status: string }) {
  const isConnected = status === 'connected' || status === 'configured'

  return (
    <div className={cn(
      "p-4 rounded-lg border flex items-center gap-3",
      isConnected ? "bg-success-soft border-emerald-200" : "bg-danger-soft border-destructive/30"
    )}>
      <span className="relative flex h-2.5 w-2.5">
        {!isConnected && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-destructive animate-pulse-ring" />
        )}
        <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", isConnected ? "bg-emerald-600" : "bg-destructive")} />
      </span>
      {isConnected ? (
        <Wifi className="w-5 h-5 text-emerald-700" />
      ) : (
        <WifiOff className="w-5 h-5 text-destructive" />
      )}
      <div>
        <div className="font-medium text-sm">{name}</div>
        <div className={cn("text-xs font-mono", isConnected ? "text-emerald-700" : "text-destructive")}>
          {status}
        </div>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    user: 'bg-secondary text-secondary-foreground',
    moderator: 'bg-emerald-100 text-emerald-800',
    admin: 'bg-emerald-100 text-emerald-800',
    super_admin: 'bg-warning-soft text-[hsl(32_95%_30%)]',
  }

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", colors[role] || colors.user)}>
      {role}
    </span>
  )
}
