import { useState, useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
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

  useEffect(() => {
    loadData()
  }, [activeTab, usersPage, userSearch, roleFilter, statusFilter, guildsPage, guildSearch])

  const loadData = async () => {
    setLoading(true)
    try {
      switch (activeTab) {
        case 'dashboard':
          const statsData = await superAdminAPI.getStats()
          setStats(statsData)
          const statusData = await superAdminAPI.getServiceStatus()
          setServiceStatus(statusData)
          break
        case 'users':
          const usersData = await superAdminAPI.getUsers(usersPage, 20, userSearch, roleFilter, statusFilter)
          setUsers(usersData.users || [])
          setUsersTotal(usersData.total)
          break
        case 'guilds':
          const guildsData = await superAdminAPI.getGuilds(guildsPage, 20, guildSearch)
          setGuilds(guildsData.guilds || [])
          setGuildsTotal(guildsData.total)
          break
        case 'moderation':
          const reportsData = await adminAPI.getReports()
          setReports(reportsData || [])
          break
        case 'monitoring':
          const logsData = await superAdminAPI.getSecurityLogs(1, 50)
          setSecurityLogs(logsData.logs || [])
          const svcStatus = await superAdminAPI.getServiceStatus()
          setServiceStatus(svcStatus)
          break
        case 'jarvis':
          const jStats = await superAdminAPI.getJarvisStats()
          setJarvisStats(jStats)
          break
        case 'banners':
          const bannersData = await superAdminAPI.getBanners()
          setBanners(bannersData.banners || [])
          break
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
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

  const handleDeleteBanner = async (bannerId: number) => {
    if (!confirm('Удалить это уведомление?')) return
    setActionLoading(true)
    try {
      await superAdminAPI.deleteBanner(bannerId)
      loadData()
    } catch (error) {
      console.error('Failed to delete banner:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const loadUserDetail = async (userId: number) => {
    try {
      const detail = await superAdminAPI.getUserDetail(userId)
      setSelectedUser(detail)
    } catch (error) {
      console.error('Failed to load user detail:', error)
    }
  }

  const handleResetPassword = async (userId: number) => {
    if (!confirm('Are you sure you want to reset this user\'s password? This will log them out of all sessions.')) return
    setActionLoading(true)
    try {
      const result = await superAdminAPI.resetPassword(userId)
      setTempPassword(result.temp_password)
      loadUserDetail(userId)
    } catch (error) {
      console.error('Failed to reset password:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleChangeRole = async (userId: number, newRole: string) => {
    if (!confirm(`Change user role to ${newRole}?`)) return
    setActionLoading(true)
    try {
      await superAdminAPI.changeRole(userId, newRole)
      loadData()
      if (selectedUser) loadUserDetail(userId)
    } catch (error) {
      console.error('Failed to change role:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRevokeAllSessions = async (userId: number) => {
    if (!confirm('Revoke all sessions for this user? They will be logged out everywhere.')) return
    setActionLoading(true)
    try {
      await superAdminAPI.revokeAllSessions(userId)
      loadUserDetail(userId)
    } catch (error) {
      console.error('Failed to revoke sessions:', error)
    } finally {
      setActionLoading(false)
    }
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

  const handleDeleteGuild = async (guildId: number, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${name}"? This cannot be undone.`)) return
    setActionLoading(true)
    try {
      await superAdminAPI.deleteGuild(guildId)
      loadData()
    } catch (error) {
      console.error('Failed to delete guild:', error)
    } finally {
      setActionLoading(false)
    }
  }

  if (user?.role !== 'super_admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Super Admin access required</p>
          </div>
        </div>
      </Layout>
    )
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'guilds', label: 'Guilds', icon: Building2 },
    { id: 'moderation', label: 'Moderation', icon: Shield },
    { id: 'monitoring', label: 'Monitoring', icon: Activity },
    { id: 'jarvis', label: 'JARVIS', icon: Bot },
    { id: 'banners', label: 'Уведомления', icon: Bell },
  ] as const

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Crown className="w-8 h-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedUser(null) }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent"
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
                  <StatCard icon={Users} label="Total Users" value={stats.users} color="blue" />
                  <StatCard icon={Globe} label="Online Now" value={stats.online_users} color="green" />
                  <StatCard icon={TrendingUp} label="New Today" value={stats.today_new_users} color="purple" />
                  <StatCard icon={Key} label="Active Sessions" value={stats.active_sessions} color="yellow" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={MessageSquare} label="Messages Today" value={stats.today_messages} color="cyan" />
                  <StatCard icon={Building2} label="Guilds" value={stats.guilds} color="indigo" />
                  <StatCard icon={AlertTriangle} label="Pending Reports" value={stats.pending_reports} color="orange" />
                  <StatCard icon={Ban} label="Active Bans" value={stats.active_bans} color="red" />
                </div>

                {serviceStatus && (
                  <div className="bg-card rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Server className="w-5 h-5" /> Service Status
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
                        placeholder="Search users..."
                        value={userSearch}
                        onChange={(e) => { setUserSearch(e.target.value); setUsersPage(1) }}
                        className="w-full pl-10 pr-4 py-2 bg-card border rounded-lg"
                      />
                    </div>
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => { setRoleFilter(e.target.value); setUsersPage(1) }}
                    className="px-4 py-2 bg-card border rounded-lg"
                  >
                    <option value="">All Roles</option>
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setUsersPage(1) }}
                    className="px-4 py-2 bg-card border rounded-lg"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-card rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-accent">
                        <tr>
                          <th className="text-left p-3">User</th>
                          <th className="text-left p-3">Role</th>
                          <th className="text-left p-3">Status</th>
                          <th className="text-left p-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} className="border-t border-border hover:bg-accent/50">
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
                                  <span className="text-red-500 text-sm flex items-center gap-1">
                                    <Ban className="w-3 h-3" /> Banned
                                  </span>
                                ) : (
                                  <span className="text-green-500 text-sm flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Active
                                  </span>
                                )}
                                {u.has_2fa && (
                                  <span title="2FA Enabled"><Lock className="w-3 h-3 text-blue-500" /></span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => loadUserDetail(u.id)}
                                className="p-2 hover:bg-accent rounded"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="p-3 flex justify-between items-center border-t">
                      <span className="text-sm text-muted-foreground">
                        Page {usersPage} of {Math.ceil(usersTotal / 20)}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                          disabled={usersPage <= 1}
                          className="px-3 py-1 bg-accent rounded disabled:opacity-50"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setUsersPage(p => p + 1)}
                          disabled={usersPage >= Math.ceil(usersTotal / 20)}
                          className="px-3 py-1 bg-accent rounded disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedUser && (
                    <div className="bg-card rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-3">
                        <Avatar alt={selectedUser.user.username} src={selectedUser.user.avatar} size="lg" />
                        <div>
                          <h3 className="font-semibold text-lg">{selectedUser.user.username}</h3>
                          <p className="text-sm text-muted-foreground">{selectedUser.user.email}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-accent p-2 rounded">
                          <div className="text-lg font-bold">{selectedUser.stats.posts}</div>
                          <div className="text-xs text-muted-foreground">Posts</div>
                        </div>
                        <div className="bg-accent p-2 rounded">
                          <div className="text-lg font-bold">{selectedUser.stats.messages}</div>
                          <div className="text-xs text-muted-foreground">Messages</div>
                        </div>
                        <div className="bg-accent p-2 rounded">
                          <div className="text-lg font-bold">{selectedUser.stats.guilds}</div>
                          <div className="text-xs text-muted-foreground">Guilds</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Change Role</label>
                        <select
                          value={selectedUser.user.role}
                          onChange={(e) => handleChangeRole(Number(selectedUser.user.id), e.target.value)}
                          disabled={actionLoading}
                          className="w-full px-3 py-2 bg-accent rounded"
                        >
                          <option value="user">User</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <button
                          onClick={() => handleResetPassword(Number(selectedUser.user.id))}
                          disabled={actionLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded"
                        >
                          <Key className="w-4 h-4" /> Reset Password
                        </button>
                        {tempPassword && (
                          <div className="p-2 bg-accent rounded flex items-center justify-between">
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
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded"
                      >
                        <LogOut className="w-4 h-4" /> Revoke All Sessions
                      </button>

                      {selectedUser.is_banned ? (
                        <button
                          onClick={() => handleUnbanUser(Number(selectedUser.user.id))}
                          disabled={actionLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
                        >
                          <Unlock className="w-4 h-4" /> Unban User
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const reason = prompt('Ban reason:')
                            if (reason) handleBanUser(Number(selectedUser.user.id), reason)
                          }}
                          disabled={actionLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                        >
                          <Ban className="w-4 h-4" /> Ban User
                        </button>
                      )}

                      {selectedUser.sessions.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Active Sessions ({selectedUser.sessions.length})</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {selectedUser.sessions.map(s => (
                              <div key={s.id} className="text-xs bg-accent p-2 rounded flex justify-between">
                                <span>{s.device_info || 'Unknown'}</span>
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
                    placeholder="Search guilds..."
                    value={guildSearch}
                    onChange={(e) => { setGuildSearch(e.target.value); setGuildsPage(1) }}
                    className="w-full pl-10 pr-4 py-2 bg-card border rounded-lg"
                  />
                </div>

                <div className="bg-card rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-accent">
                      <tr>
                        <th className="text-left p-3">Guild</th>
                        <th className="text-left p-3">Owner</th>
                        <th className="text-left p-3">Members</th>
                        <th className="text-left p-3">Channels</th>
                        <th className="text-left p-3">Messages</th>
                        <th className="text-left p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guilds.map(g => (
                        <tr key={g.id} className="border-t border-border hover:bg-accent/50">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
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
                                className="p-2 hover:bg-accent rounded"
                                title="Transfer Ownership"
                              >
                                <Crown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteGuild(g.id, g.name)}
                                className="p-2 hover:bg-red-500/20 rounded text-red-500"
                                title="Delete Guild"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 flex justify-between items-center border-t">
                    <span className="text-sm text-muted-foreground">
                      Total: {guildsTotal} guilds
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setGuildsPage(p => Math.max(1, p - 1))}
                        disabled={guildsPage <= 1}
                        className="px-3 py-1 bg-accent rounded disabled:opacity-50"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setGuildsPage(p => p + 1)}
                        disabled={guildsPage >= Math.ceil(guildsTotal / 20)}
                        className="px-3 py-1 bg-accent rounded disabled:opacity-50"
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
                  <AlertTriangle className="w-5 h-5" /> Pending Reports
                </h2>
                <div className="bg-card rounded-lg overflow-hidden">
                  {reports.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No pending reports
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-accent">
                        <tr>
                          <th className="text-left p-3">Reporter</th>
                          <th className="text-left p-3">Type</th>
                          <th className="text-left p-3">Reason</th>
                          <th className="text-left p-3">Status</th>
                          <th className="text-left p-3">Date</th>
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
                                "px-2 py-1 rounded text-xs",
                                r.status === 'pending' && "bg-yellow-500/20 text-yellow-500",
                                r.status === 'resolved' && "bg-green-500/20 text-green-500",
                                r.status === 'rejected' && "bg-red-500/20 text-red-500"
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
                  <div className="bg-card rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Server className="w-5 h-5" /> Service Status
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <ServiceStatusBadge name="Database" status={serviceStatus.services.database} />
                      <ServiceStatusBadge name="Redis" status={serviceStatus.services.redis} />
                      <ServiceStatusBadge name="LiveKit" status={serviceStatus.services.livekit} />
                    </div>
                  </div>
                )}

                <div className="bg-card rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Security Logs
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {securityLogs.map(log => (
                      <div key={log.id} className="flex items-center justify-between p-3 bg-accent rounded">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            log.action.includes('fail') ? "bg-red-500" :
                            log.action.includes('ban') ? "bg-orange-500" :
                            "bg-blue-500"
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
                  <StatCard icon={Bot} label="Total Requests" value={jarvisStats.total_requests} color="purple" />
                  <StatCard icon={Clock} label="Today's Requests" value={jarvisStats.today_requests} color="blue" />
                </div>

                <div className="bg-card rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Top JARVIS Users</h3>
                  <div className="space-y-2">
                    {(jarvisStats.top_users || []).map((u, i) => (
                      <div key={u.user_id} className="flex items-center justify-between p-3 bg-accent rounded">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-sm font-bold">
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
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                  >
                    <Plus className="w-4 h-4" /> Создать уведомление
                  </button>
                </div>

                {(showBannerForm || editingBanner) && (
                  <div className="bg-card rounded-lg p-6 border border-border">
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
                          className="w-full px-3 py-2 bg-background border rounded-lg"
                          placeholder="Заголовок уведомления"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Сообщение</label>
                        <textarea
                          value={bannerForm.message}
                          onChange={(e) => setBannerForm({ ...bannerForm, message: e.target.value })}
                          className="w-full px-3 py-2 bg-background border rounded-lg resize-none"
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
                            className="w-full px-3 py-2 bg-background border rounded-lg"
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
                            className="w-full px-3 py-2 bg-background border rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={editingBanner ? handleUpdateBanner : handleCreateBanner}
                          disabled={actionLoading || !bannerForm.title || !bannerForm.message}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                        >
                          {editingBanner ? 'Сохранить' : 'Создать'}
                        </button>
                        <button
                          onClick={() => {
                            setShowBannerForm(false)
                            setEditingBanner(null)
                            setBannerForm({ title: '', message: '', type: 'info', expires_at: '' })
                          }}
                          className="px-4 py-2 border border-border rounded-lg hover:bg-accent"
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
                          "bg-card rounded-lg p-4 border-l-4",
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
                              {banner.type === 'info' && <Info className="w-4 h-4 text-blue-500" />}
                              {banner.type === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                              {banner.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                              {banner.type === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                              <h4 className="font-semibold">{banner.title}</h4>
                              {!banner.is_active && (
                                <span className="text-xs bg-muted px-2 py-0.5 rounded">Неактивно</span>
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
                                  ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
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
                              className="p-2 rounded-lg bg-blue-500/20 text-blue-500 hover:bg-blue-500/30"
                              title="Редактировать"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBanner(banner.id)}
                              disabled={actionLoading}
                              className="p-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30"
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
    </Layout>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    purple: 'bg-purple-500/10 text-purple-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
    indigo: 'bg-indigo-500/10 text-indigo-500',
    orange: 'bg-orange-500/10 text-orange-500',
    red: 'bg-red-500/10 text-red-500',
  }
  
  return (
    <div className="bg-card p-4 rounded-lg">
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
      isConnected ? "bg-green-500/10" : "bg-red-500/10"
    )}>
      {isConnected ? (
        <Wifi className="w-5 h-5 text-green-500" />
      ) : (
        <WifiOff className="w-5 h-5 text-red-500" />
      )}
      <div>
        <div className="font-medium">{name}</div>
        <div className={cn("text-sm", isConnected ? "text-green-500" : "text-red-500")}>
          {status}
        </div>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    user: 'bg-gray-500/20 text-muted-foreground',
    moderator: 'bg-blue-500/20 text-blue-400',
    admin: 'bg-purple-500/20 text-purple-400',
    super_admin: 'bg-yellow-500/20 text-yellow-400',
  }
  
  return (
    <span className={cn("px-2 py-1 rounded text-xs font-medium", colors[role] || colors.user)}>
      {role}
    </span>
  )
}
