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
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Доступ запрещён</h2>
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
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Crown className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold gradient-brand-text">Панель супер-администратора</h1>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedUser(null) }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200",
                activeTab === tab.id
                  ? "gradient-brand text-primary-foreground shadow-soft"
                  : "glass text-muted-foreground hover:bg-primary/10 hover:text-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
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
                  <div className="glass rounded-xl p-6 shadow-soft">
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
                  <div className="lg:col-span-2 glass rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-primary/10 text-muted-foreground">
                        <tr>
                          <th className="text-left p-3">Пользователь</th>
                          <th className="text-left p-3">Роль</th>
                          <th className="text-left p-3">Статус</th>
                          <th className="text-left p-3">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} className="border-t border-border hover:bg-primary/5 transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <Avatar alt={u.username} src={u.avatar} size="sm" />
                                <div>
                                  <div className="font-medium">{u.username}</div>
                                  <div className="text-xs text-muted-foreground">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <RoleBadge role={u.role} />
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {u.is_banned ? (
                                  <span className="text-red-400 text-sm flex items-center gap-1">
                                    <Ban className="w-3 h-3" /> Заблокирован
                                  </span>
                                ) : (
                                  <span className="text-accent text-sm flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Активен
                                  </span>
                                )}
                                {u.has_2fa && (
                                  <span title="2FA включена"><Lock className="w-3 h-3 text-primary" /></span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => loadUserDetail(u.id)}
                                className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                                title="Подробнее"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="p-3 flex justify-between items-center border-t border-border">
                      <span className="text-sm text-muted-foreground">
                        Page {usersPage} of {Math.ceil(usersTotal / 20)}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                          disabled={usersPage <= 1}
                          className="px-3 py-1 glass rounded-lg hover:bg-primary/10 disabled:opacity-50 transition-colors"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setUsersPage(p => p + 1)}
                          disabled={usersPage >= Math.ceil(usersTotal / 20)}
                          className="px-3 py-1 glass rounded-lg hover:bg-primary/10 disabled:opacity-50 transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedUser && (
                    <div className="glass rounded-xl p-4 space-y-4 shadow-soft">
                      <div className="flex items-center gap-3">
                        <Avatar alt={selectedUser.user.username} src={selectedUser.user.avatar} size="lg" />
                        <div>
                          <h3 className="font-semibold text-lg">{selectedUser.user.username}</h3>
                          <p className="text-sm text-muted-foreground">{selectedUser.user.email}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-primary/10 border border-primary/15 p-2 rounded-lg">
                          <div className="text-lg font-bold">{selectedUser.stats.posts}</div>
                          <div className="text-xs text-muted-foreground">Посты</div>
                        </div>
                        <div className="bg-primary/10 border border-primary/15 p-2 rounded-lg">
                          <div className="text-lg font-bold">{selectedUser.stats.messages}</div>
                          <div className="text-xs text-muted-foreground">Сообщения</div>
                        </div>
                        <div className="bg-primary/10 border border-primary/15 p-2 rounded-lg">
                          <div className="text-lg font-bold">{selectedUser.stats.guilds}</div>
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

                      <div className="space-y-2">
                        <button
                          onClick={() => handleResetPassword(Number(selectedUser.user.id))}
                          disabled={actionLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/25 rounded-lg transition-colors"
                        >
                          <Key className="w-4 h-4" /> Сбросить пароль
                        </button>
                        {tempPassword && (
                          <div className="p-2 bg-background/40 border border-border rounded-lg flex items-center justify-between">
                            <code className="text-sm">{tempPassword}</code>
                            <button
                              onClick={() => { navigator.clipboard.writeText(tempPassword); setTempPassword(null) }}
                              className="p-1 hover:bg-background rounded"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleRevokeAllSessions(Number(selectedUser.user.id))}
                        disabled={actionLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25 rounded-lg transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> Завершить все сессии
                      </button>

                      {selectedUser.is_banned ? (
                        <button
                          onClick={() => handleUnbanUser(Number(selectedUser.user.id))}
                          disabled={actionLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 rounded-lg transition-colors"
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
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 rounded-lg transition-colors"
                        >
                          <Ban className="w-4 h-4" /> Заблокировать
                        </button>
                      )}

                      {selectedUser.sessions.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Активные сессии ({selectedUser.sessions.length})</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {selectedUser.sessions.map(s => (
                              <div key={s.id} className="text-xs bg-background/40 border border-border p-2 rounded-lg flex justify-between">
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

                <div className="glass rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-primary/10 text-muted-foreground">
                      <tr>
                        <th className="text-left p-3">Сервер</th>
                        <th className="text-left p-3">Владелец</th>
                        <th className="text-left p-3">Участники</th>
                        <th className="text-left p-3">Каналы</th>
                        <th className="text-left p-3">Сообщения</th>
                        <th className="text-left p-3">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guilds.map(g => (
                        <tr key={g.id} className="border-t border-border hover:bg-primary/5 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/15 text-primary rounded-lg flex items-center justify-center overflow-hidden">
                                {g.icon ? (
                                  <img src={g.icon} alt="" className="w-full h-full object-cover rounded-lg" />
                                ) : (
                                  <Building2 className="w-5 h-5" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium">{g.name}</div>
                                <div className="text-xs text-muted-foreground">ID: {g.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            {g.owner?.username || `User #${g.owner_id}`}
                          </td>
                          <td className="p-3">{g.member_count}</td>
                          <td className="p-3">{g.channel_count}</td>
                          <td className="p-3">{g.message_count}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleTransferGuild(g.id)}
                                className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                                title="Передать владение"
                              >
                                <Crown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteGuild(g.id, g.name)}
                                className="p-2 hover:bg-red-500/15 rounded-lg text-red-400 transition-colors"
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
                  <div className="p-3 flex justify-between items-center border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      Total: {guildsTotal} guilds
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setGuildsPage(p => Math.max(1, p - 1))}
                        disabled={guildsPage <= 1}
                        className="px-3 py-1 glass rounded-lg hover:bg-primary/10 disabled:opacity-50 transition-colors"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setGuildsPage(p => p + 1)}
                        disabled={guildsPage >= Math.ceil(guildsTotal / 20)}
                        className="px-3 py-1 glass rounded-lg hover:bg-primary/10 disabled:opacity-50 transition-colors"
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
                <div className="glass rounded-xl overflow-hidden">
                  {reports.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Нет ожидающих жалоб
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-primary/10 text-muted-foreground">
                        <tr>
                          <th className="text-left p-3">Автор жалобы</th>
                          <th className="text-left p-3">Тип</th>
                          <th className="text-left p-3">Причина</th>
                          <th className="text-left p-3">Статус</th>
                          <th className="text-left p-3">Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map(r => (
                          <tr key={r.id} className="border-t border-border">
                            <td className="p-3">{r.reporter_id}</td>
                            <td className="p-3">{r.target_type}</td>
                            <td className="p-3">{r.reason}</td>
                            <td className="p-3">
                              <span className={cn(
                                "px-2 py-1 rounded-full text-xs",
                                r.status === 'pending' && "bg-yellow-500/15 text-yellow-400 border border-yellow-500/25",
                                r.status === 'resolved' && "bg-accent/15 text-accent border border-accent/25",
                                r.status === 'rejected' && "bg-red-500/15 text-red-400 border border-red-500/25"
                              )}>
                                {r.status}
                              </span>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">
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
                  <div className="glass rounded-xl p-6 shadow-soft">
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

                <div className="glass rounded-xl p-6 shadow-soft">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Security Logs
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {securityLogs.map(log => (
                      <div key={log.id} className="flex items-center justify-between p-3 bg-background/40 border border-border rounded-lg hover:bg-primary/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            log.action.includes('fail') ? "bg-red-400" :
                            log.action.includes('ban') ? "bg-orange-400" :
                            "bg-primary"
                          )} />
                          <div>
                            <div className="font-medium">{log.action}</div>
                            <div className="text-xs text-muted-foreground">
                              {log.target}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">{log.ip_address}</div>
                          <div className="text-xs text-muted-foreground">
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

                <div className="glass rounded-xl p-6 shadow-soft">
                  <h3 className="text-lg font-semibold mb-4">Топ пользователей JARVIS</h3>
                  <div className="space-y-2">
                    {(jarvisStats.top_users || []).map((u, i) => (
                      <div key={u.user_id} className="flex items-center justify-between p-3 bg-background/40 border border-border rounded-lg hover:bg-primary/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-gradient-brand text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                            {i + 1}
                          </span>
                          <span className="font-medium">{u.username}</span>
                        </div>
                        <span className="text-muted-foreground">{u.requests} requests</span>
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
                    className="flex items-center gap-2 px-4 py-2 gradient-brand text-primary-foreground rounded-lg shadow-soft hover:brightness-110 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Создать уведомление
                  </button>
                </div>

                {(showBannerForm || editingBanner) && (
                  <div className="glass rounded-xl p-6">
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
                          className="px-4 py-2 gradient-brand text-primary-foreground rounded-lg shadow-soft hover:brightness-110 disabled:opacity-50 transition-all"
                        >
                          {editingBanner ? 'Сохранить' : 'Создать'}
                        </button>
                        <button
                          onClick={() => {
                            setShowBannerForm(false)
                            setEditingBanner(null)
                            setBannerForm({ title: '', message: '', type: 'info', expires_at: '' })
                          }}
                          className="px-4 py-2 border border-border rounded-lg hover:bg-primary/10 transition-colors"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {banners.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Нет уведомлений</p>
                    </div>
                  ) : (
                    banners.map(banner => (
                      <div
                        key={banner.id}
                        className={cn(
                          "glass rounded-xl p-4 border-l-4",
                          banner.type === 'info' && "border-blue-500",
                          banner.type === 'success' && "border-green-500",
                          banner.type === 'warning' && "border-yellow-500",
                          banner.type === 'error' && "border-red-500",
                          !banner.is_active && "opacity-50"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {banner.type === 'info' && <Info className="w-4 h-4 text-primary" />}
                              {banner.type === 'success' && <CheckCircle className="w-4 h-4 text-accent" />}
                              {banner.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                              {banner.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                              <h4 className="font-semibold">{banner.title}</h4>
                              {!banner.is_active && (
                                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Неактивно</span>
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
                                "p-2 rounded-lg transition-colors",
                                banner.is_active 
                                  ? "bg-accent/15 text-accent hover:bg-accent/25"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
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
                              className="p-2 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                              title="Редактировать"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBanner(banner.id)}
                              disabled={actionLoading}
                              className="p-2 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
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
    blue: 'bg-primary/15 text-primary',
    green: 'bg-accent/15 text-accent',
    purple: 'bg-primary/15 text-primary',
    yellow: 'bg-yellow-500/15 text-yellow-400',
    cyan: 'bg-accent/15 text-accent',
    indigo: 'bg-primary/15 text-primary',
    orange: 'bg-orange-500/15 text-orange-400',
    red: 'bg-red-500/15 text-red-400',
  }
  
  return (
    <div className="glass p-4 rounded-xl shadow-soft">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  )
}

function ServiceStatusBadge({ name, status }: { name: string; status: string }) {
  const isConnected = status === 'connected' || status === 'configured'
  
  return (
    <div className={cn(
      "p-4 rounded-lg flex items-center gap-3",
      isConnected ? "bg-accent/10 border border-accent/25" : "bg-red-500/10 border border-red-500/25"
    )}>
      {isConnected ? (
        <Wifi className="w-5 h-5 text-accent" />
      ) : (
        <WifiOff className="w-5 h-5 text-red-400" />
      )}
      <div>
        <div className="font-medium">{name}</div>
        <div className={cn("text-sm", isConnected ? "text-accent" : "text-red-400")}>
          {status}
        </div>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    user: 'bg-muted text-muted-foreground',
    moderator: 'bg-accent/15 text-accent border border-accent/25',
    admin: 'bg-primary/15 text-primary border border-primary/25',
    super_admin: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25',
  }
  
  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", colors[role] || colors.user)}>
      {role}
    </span>
  )
}
