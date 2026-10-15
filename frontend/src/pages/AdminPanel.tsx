import { useState, useEffect, useRef } from 'react'
import { Layout } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { useStore } from '@/lib/store'
import { adminAPI, adminLicenseAPI, apiKeysAPI, type AdminStats, type IPBan, type AbuseReport, type AuditLog, type User, type ForbiddenWord, type ForbiddenAttempt, type BillingStats, type BillingTransaction, type LicenseKey, type ApiKey, type ApiKeyStats, type CreatedApiKey } from '@/lib/api'
import { ModerationPanel } from '@/components/admin/ModerationPanel'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import {
  Users,
  Shield,
  AlertTriangle,
  Activity,
  Ban,
  FileText,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  TrendingUp,
  MessageSquare,
  Server,
  Filter,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  CreditCard,
  DollarSign,
  RefreshCw,
  KeyRound,
  KeySquare,
  Copy,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TabType = 'dashboard' | 'users' | 'bans' | 'reports' | 'logs' | 'filter' | 'attempts' | 'billing' | 'licenses' | 'apikeys' | 'moderation'

interface LicenseStats {
  total_keys: number
  used_keys: number
  unused_keys: number
  active_users: number
  revenue_rub: number
}

export default function AdminPanel() {
  const { user } = useStore()
  const toast = useToast()
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [ipBans, setIPBans] = useState<IPBan[]>([])
  const [reports, setReports] = useState<AbuseReport[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [forbiddenWords, setForbiddenWords] = useState<ForbiddenWord[]>([])
  const [forbiddenAttempts, setForbiddenAttempts] = useState<ForbiddenAttempt[]>([])
  const [billingStats, setBillingStats] = useState<BillingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [newWord, setNewWord] = useState('')
  const [newWordCategory, setNewWordCategory] = useState('general')
  const [newWordIsRegex, setNewWordIsRegex] = useState(false)
  const [editingWord, setEditingWord] = useState<ForbiddenWord | null>(null)
  // Лицензии
  const [licenseStats, setLicenseStats] = useState<LicenseStats | null>(null)
  const [licenses, setLicenses] = useState<LicenseKey[]>([])
  const [licensesTotal, setLicensesTotal] = useState(0)
  const [licensePage, setLicensePage] = useState(1)
  const [licenseType, setLicenseType] = useState('MONTHLY')
  const [licenseError, setLicenseError] = useState('')
  const [licenseGenerating, setLicenseGenerating] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  // API-ключи
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [apiKeysStats, setApiKeysStats] = useState<ApiKeyStats | null>(null)
  const [apiKeysError, setApiKeysError] = useState('')
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read'])
  const [newKeyExpiry, setNewKeyExpiry] = useState('')
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null)
  const [apiKeyCreating, setApiKeyCreating] = useState(false)

  const loadSeqRef = useRef(0)

  // При размонтировании инвалидируем все летящие запросы
  useEffect(() => {
    return () => { loadSeqRef.current++ }
  }, [])

  useEffect(() => {
    loadData()
  }, [activeTab, licensePage])

  const loadData = async () => {
    // Вкладка «Модерация» управляет своей загрузкой самостоятельно
    if (activeTab === 'moderation') {
      setLoading(false)
      return
    }
    // Защита от гонки: устаревший ответ (после смены вкладки/размонтирования) не затирает состояние
    const seq = ++loadSeqRef.current
    const stale = () => seq !== loadSeqRef.current
    setLoading(true)
    try {
      switch (activeTab) {
        case 'dashboard':
          const statsData = await adminAPI.getStats()
          if (stale()) return
          setStats(statsData)
          break
        case 'users':
          const usersData = await adminAPI.getUsers()
          if (stale()) return
          setUsers(usersData.users)
          break
        case 'bans':
          const bansData = await adminAPI.getIPBans()
          if (stale()) return
          setIPBans(bansData)
          break
        case 'reports':
          const reportsData = await adminAPI.getReports()
          if (stale()) return
          setReports(reportsData)
          break
        case 'logs':
          const logsData = await adminAPI.getAuditLogs()
          if (stale()) return
          setLogs(logsData.logs)
          break
        case 'filter':
          const wordsData = await adminAPI.getForbiddenWords()
          if (stale()) return
          setForbiddenWords(wordsData)
          break
        case 'attempts':
          const attemptsData = await adminAPI.getForbiddenAttempts()
          if (stale()) return
          setForbiddenAttempts(attemptsData.attempts)
          break
        case 'billing':
          const billingData = await adminAPI.getBillingStats()
          if (stale()) return
          setBillingStats(billingData)
          break
        case 'licenses': {
          const [licensesData, statsData] = await Promise.all([
            adminLicenseAPI.getAll(licensePage, 20),
            adminLicenseAPI.getStats(),
          ])
          if (stale()) return
          setLicenses(licensesData.licenses)
          setLicensesTotal(licensesData.total)
          setLicenseStats(statsData)
          setLicenseError('')
          break
        }
        case 'apikeys': {
          const [keysData, keyStatsData] = await Promise.all([
            apiKeysAPI.list(),
            apiKeysAPI.stats(),
          ])
          if (stale()) return
          setApiKeys(keysData.api_keys ?? [])
          setApiKeysStats(keyStatsData)
          setApiKeysError('')
          break
        }
      }
    } catch (error) {
      if (stale()) return
      console.error('Failed to load admin data:', error)
      if (activeTab === 'licenses') setLicenseError('Не удалось загрузить лицензии')
      if (activeTab === 'apikeys') setApiKeysError('Не удалось загрузить API-ключи')
    } finally {
      if (!stale()) setLoading(false)
    }
  }

  const handleGenerateLicense = async (count: number) => {
    setLicenseGenerating(true)
    setLicenseError('')
    try {
      if (count === 1) {
        await adminLicenseAPI.generate(licenseType)
      } else {
        await adminLicenseAPI.generateBatch(licenseType, count)
      }
      setLicensePage(1)
      loadData()
    } catch (error) {
      console.error('Failed to generate license:', error)
      setLicenseError('Ошибка генерации ключа')
    } finally {
      setLicenseGenerating(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(text)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return
    setApiKeyCreating(true)
    setApiKeysError('')
    try {
      const created = await apiKeysAPI.create({
        name: newKeyName.trim(),
        scopes: newKeyScopes,
        expires_in_days: newKeyExpiry ? parseInt(newKeyExpiry) : undefined,
      })
      setCreatedKey(created)
      setNewKeyName('')
      setNewKeyScopes(['read'])
      setNewKeyExpiry('')
      loadData()
    } catch (error) {
      console.error('Failed to create API key:', error)
      setApiKeysError('Ошибка создания API-ключа')
    } finally {
      setApiKeyCreating(false)
    }
  }

  const handleToggleApiKey = async (key: ApiKey) => {
    try {
      await apiKeysAPI.update(key.id, { is_active: !key.is_active })
      loadData()
    } catch (error) {
      console.error('Failed to update API key:', error)
      setApiKeysError('Ошибка обновления API-ключа')
    }
  }

  const handleRevokeApiKey = (id: number) => {
    setConfirmAction({
      title: 'Отзыв API-ключа',
      message: 'Отозвать этот API-ключ? Действие необратимо.',
      onConfirm: async () => {
        try {
          await apiKeysAPI.revoke(id)
          loadData()
          toast.success('API-ключ отозван')
        } catch (error) {
          console.error('Failed to revoke API key:', error)
          setApiKeysError('Ошибка отзыва API-ключа')
        }
      }
    })
  }

  const handleBanUser = async (userId: string, reason: string) => {
    try {
      await adminAPI.banUser(userId, reason)
      loadData()
    } catch (error) {
      console.error('Failed to ban user:', error)
    }
  }

  const handleResolveReport = async (reportId: string, status: string) => {
    try {
      await adminAPI.updateReport(reportId, status)
      loadData()
    } catch (error) {
      console.error('Failed to update report:', error)
    }
  }

  const handleAddForbiddenWord = async () => {
    console.log('Adding forbidden word:', newWord)
    if (!newWord.trim()) return
    try {
      await adminAPI.addForbiddenWord(newWord.trim(), newWordCategory, newWordIsRegex)
      setNewWord('')
      setNewWordCategory('general')
      setNewWordIsRegex(false)
      loadData()
    } catch (error) {
      console.error('Failed to add forbidden word:', error)
      toast.error('Не удалось добавить слово', 'Возможно, оно уже существует')
    }
  }

  const handleDeleteForbiddenWord = (wordId: string) => {
    console.log('Deleting forbidden word:', wordId)
    setConfirmAction({
      title: 'Удаление слова',
      message: 'Удалить это слово из списка запрещённых?',
      onConfirm: async () => {
        try {
          await adminAPI.deleteForbiddenWord(wordId)
          loadData()
          toast.success('Слово удалено')
        } catch (error) {
          console.error('Failed to delete forbidden word:', error)
          toast.error('Не удалось удалить слово')
        }
      }
    })
  }

  const handleUpdateForbiddenWord = async () => {
    if (!editingWord) return
    console.log('Updating forbidden word:', editingWord)
    try {
      await adminAPI.updateForbiddenWord(
        editingWord.id,
        editingWord.word,
        editingWord.category,
        editingWord.is_regex
      )
      setEditingWord(null)
      loadData()
    } catch (error) {
      console.error('Failed to update forbidden word:', error)
    }
  }

  if (!user || (user.role !== 'admin' && user.role !== 'moderator' && user.role !== 'super_admin')) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-pop max-w-md text-center animate-scale-in">
            <div className="h-20 w-20 mx-auto rounded-2xl bg-secondary grid place-items-center mb-4">
              <Shield className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-display font-bold text-graphite-900 mb-4">Доступ запрещён</h1>
            <p className="text-muted-foreground mb-6">
              У вас нет прав для доступа к панели администратора.
            </p>
            <a href="/" className="text-primary underline-offset-4 hover:underline">Вернуться на главную</a>
          </div>
        </div>
      </Layout>
    )
  }

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Обзор', icon: Activity },
    { id: 'users' as TabType, label: 'Пользователи', icon: Users },
    { id: 'bans' as TabType, label: 'Баны IP', icon: Ban },
    { id: 'moderation' as TabType, label: 'Модерация', icon: Shield },
    { id: 'reports' as TabType, label: 'Жалобы', icon: AlertTriangle },
    { id: 'filter' as TabType, label: 'Чёрный список', icon: Filter },
    { id: 'attempts' as TabType, label: 'Попытки', icon: AlertTriangle },
    { id: 'logs' as TabType, label: 'Журнал', icon: FileText },
    { id: 'billing' as TabType, label: 'Биллинг', icon: CreditCard },
    { id: 'licenses' as TabType, label: 'Лицензии', icon: KeyRound },
    { id: 'apikeys' as TabType, label: 'API-ключи', icon: KeySquare },
  ]

  return (
    <Layout>
      <div className="px-6 py-6 max-w-[1440px] mx-auto animate-rise-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display font-bold text-graphite-900">Панель администратора</h1>
            <p className="text-muted-foreground mt-1">Управление платформой и модерация</p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
            <Shield className="w-3.5 h-3.5" />
            {user.role === 'super_admin' ? 'Супер-администратор' : user.role === 'admin' ? 'Администратор' : 'Модератор'}
          </div>
        </div>

        <div className="flex gap-4 mb-6 border-b border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 pb-2.5 -mb-px whitespace-nowrap text-sm font-medium border-b-2 transition-colors duration-150',
                activeTab === tab.id
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-28 rounded-xl" />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Пользователи"
                  value={stats.users}
                  icon={Users}
                  color="text-graphite-600"
                />
                <StatCard
                  title="Онлайн"
                  value={stats.online_users}
                  icon={Globe}
                  color="text-emerald-600"
                />
                <StatCard
                  title="Сообщения"
                  value={stats.messages}
                  icon={MessageSquare}
                  color="text-graphite-600"
                />
                <StatCard
                  title="Посты"
                  value={stats.posts}
                  icon={TrendingUp}
                  color="text-graphite-600"
                />
                <StatCard
                  title="Сообщества"
                  value={stats.guilds}
                  icon={Server}
                  color="text-graphite-600"
                />
                <StatCard
                  title="Активные баны"
                  value={stats.active_bans}
                  icon={Ban}
                  color="text-destructive"
                />
                <StatCard
                  title="Ожидающие жалобы"
                  value={stats.pending_reports}
                  icon={AlertTriangle}
                  color={stats.pending_reports > 0 ? 'text-warning' : 'text-graphite-600'}
                />
              </div>
            )}

            {activeTab === 'users' && (
              <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
                <div className="p-4 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Поиск пользователей..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-field pl-10"
                    />
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {users
                    .filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((u) => (
                      <div key={u.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors duration-150">
                        <div className="flex items-center gap-3">
                          <Avatar alt={u.username} size="md" />
                          <div>
                            <p className="font-medium text-sm">{u.username}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            u.role === 'admin' ? 'bg-emerald-100 text-emerald-800' :
                            u.role === 'moderator' ? 'bg-secondary text-secondary-foreground' :
                            'bg-secondary text-muted-foreground'
                          )}>
                            {u.role || 'user'}
                          </span>
                          <button
                            onClick={() => handleBanUser(u.id, 'Действие администратора')}
                            className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-destructive hover:bg-danger-soft transition-colors duration-150"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {activeTab === 'bans' && (
              <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
                <div className="divide-y divide-border">
                  {ipBans.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Нет активных банов по IP
                    </div>
                  ) : (
                    ipBans.map((ban) => (
                      <div key={ban.id} className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-mono">{ban.ip_address}</p>
                          <p className="text-sm text-muted-foreground">{ban.reason}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {new Date(ban.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'moderation' && (
              <ModerationPanel isSuperAdmin={user.role === 'super_admin'} />
            )}

            {activeTab === 'reports' && (
              <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
                <div className="divide-y divide-border">
                  {reports.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Нет ожидающих жалоб
                    </div>
                  ) : (
                    reports.map((report) => (
                      <div key={report.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                report.status === 'pending' ? 'bg-warning-soft text-[hsl(32_95%_30%)]' :
                                report.status === 'resolved' ? 'bg-success-soft text-emerald-800' :
                                'bg-danger-soft text-destructive'
                              )}>
                                {report.status}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {report.target_type} #{report.target_id}
                              </span>
                            </div>
                            <p className="text-sm">{report.reason}</p>
                          </div>
                          {report.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleResolveReport(report.id, 'resolved')}
                                className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-emerald-700 hover:bg-success-soft transition-colors duration-150"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleResolveReport(report.id, 'rejected')}
                                className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-destructive hover:bg-danger-soft transition-colors duration-150"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
                <div className="divide-y divide-border">
                  {logs.map((log) => (
                    <div key={log.id} className="p-4 flex items-center gap-4">
                      <div className="flex-1">
                        <p className="font-medium">{log.action}</p>
                        <p className="text-sm text-muted-foreground">
                          {log.target} - {log.details}
                        </p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{new Date(log.created_at).toLocaleString()}</p>
                        <p className="font-mono text-xs">{log.ip_address}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'filter' && (
              <div className="space-y-4">
                <div className="bg-card rounded-lg border border-border p-4">
                  <h3 className="font-medium mb-4">Добавить запрещённое слово</h3>
                  <div className="flex flex-wrap gap-3">
                    <input
                      type="text"
                      value={newWord}
                      onChange={(e) => setNewWord(e.target.value)}
                      placeholder="Слово или regex..."
                      className="input-field flex-1 min-w-[200px]"
                    />
                    <select
                      value={newWordCategory}
                      onChange={(e) => setNewWordCategory(e.target.value)}
                      className="input-field !w-auto px-3 py-2"
                    >
                      <option value="general">Общее</option>
                      <option value="criminal">Криминал</option>
                      <option value="violence">Насилие</option>
                      <option value="spam">Спам</option>
                      <option value="fraud">Мошенничество</option>
                      <option value="insult">Оскорбления</option>
                    </select>
                    <label className="flex items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={newWordIsRegex}
                        onChange={(e) => setNewWordIsRegex(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Regex</span>
                    </label>
                    <button
                      onClick={handleAddForbiddenWord}
                      className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] inline-flex items-center gap-2 transition-all duration-150"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
                  <div className="divide-y divide-border">
                    {forbiddenWords.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        Нет запрещённых слов
                      </div>
                    ) : (
                      forbiddenWords.map((word) => (
                        <div key={word.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors duration-150">
                          {editingWord?.id === word.id ? (
                            <div className="flex-1 flex items-center gap-3">
                              <input
                                type="text"
                                value={editingWord.word}
                                onChange={(e) => setEditingWord({ ...editingWord, word: e.target.value })}
                                className="input-field flex-1"
                              />
                              <select
                                value={editingWord.category}
                                onChange={(e) => setEditingWord({ ...editingWord, category: e.target.value })}
                                className="input-field !w-auto px-3 py-2"
                              >
                                <option value="general">Общее</option>
                                <option value="criminal">Криминал</option>
                                <option value="violence">Насилие</option>
                                <option value="spam">Спам</option>
                                <option value="fraud">Мошенничество</option>
                                <option value="insult">Оскорбления</option>
                              </select>
                              <button
                                onClick={handleUpdateForbiddenWord}
                                className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-emerald-700 hover:bg-success-soft transition-colors duration-150"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingWord(null)}
                                className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors duration-150"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs bg-graphite-100 px-2 py-1 rounded-lg border border-border">{word.word}</span>
                                <span className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                  word.category === 'criminal' ? 'bg-danger-soft text-destructive' :
                                  word.category === 'violence' ? 'bg-danger-soft text-destructive' :
                                  word.category === 'spam' ? 'bg-warning-soft text-[hsl(32_95%_30%)]' :
                                  word.category === 'fraud' ? 'bg-warning-soft text-[hsl(32_95%_30%)]' :
                                  'bg-secondary text-secondary-foreground'
                                )}>
                                  {word.category}
                                </span>
                                {word.is_regex && (
                                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                                    regex
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setEditingWord(word)}
                                  className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteForbiddenWord(word.id)}
                                  className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-destructive hover:bg-danger-soft transition-colors duration-150"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'attempts' && (
              <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
                <div className="divide-y divide-border">
                  {forbiddenAttempts.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Нет попыток отправки запрещённого контента
                    </div>
                  ) : (
                    forbiddenAttempts.map((attempt) => (
                      <div key={attempt.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm text-muted-foreground">
                                Пользователь #{attempt.user_id}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-danger-soft text-destructive">
                                {attempt.context}
                              </span>
                            </div>
                            <p className="text-sm bg-graphite-100 p-2 rounded-lg font-mono break-all">
                              {attempt.attempted_content.length > 200
                                ? attempt.attempted_content.substring(0, 200) + '...'
                                : attempt.attempted_content}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Совпадения: <span className="text-destructive">{attempt.matched_words}</span>
                            </p>
                          </div>
                          <div className="text-right text-sm text-muted-foreground ml-4">
                            <p>{new Date(attempt.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'billing' && billingStats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Активные подписки"
                    value={billingStats.active_subscriptions}
                    icon={CreditCard}
                    color="text-graphite-600"
                  />
                  <StatCard
                    title="Доход за месяц"
                    value={billingStats.monthly_revenue}
                    icon={DollarSign}
                    color="text-emerald-600"
                  />
                  <StatCard
                    title="Общий доход"
                    value={billingStats.total_revenue}
                    icon={TrendingUp}
                    color="text-graphite-600"
                  />
                  <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Отток</span>
                      <RefreshCw className="w-5 h-5 text-warning" />
                    </div>
                    <p className="text-3xl font-display font-bold text-graphite-900">{billingStats.churn_rate.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
                    <h3 className="text-lg font-semibold mb-4">Статистика за месяц</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Новых подписок</span>
                        <span className="font-medium text-emerald-700">+{billingStats.new_subscriptions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Отменено</span>
                        <span className="font-medium text-destructive">-{billingStats.cancelled_subscriptions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Нетто</span>
                        <span className={cn("font-medium", billingStats.new_subscriptions - billingStats.cancelled_subscriptions >= 0 ? "text-emerald-700" : "text-destructive")}>
                          {billingStats.new_subscriptions - billingStats.cancelled_subscriptions >= 0 ? '+' : ''}{billingStats.new_subscriptions - billingStats.cancelled_subscriptions}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
                    <h3 className="text-lg font-semibold mb-4">MRR</h3>
                    <div className="text-3xl font-display font-bold text-graphite-900">
                      {billingStats.monthly_revenue.toLocaleString()} ₽
                    </div>
                    <p className="text-muted-foreground mt-2">
                      Ежемесячный регулярный доход
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <h3 className="font-semibold">Последние транзакции</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {billingStats.recent_transactions.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        Нет транзакций
                      </div>
                    ) : (
                      billingStats.recent_transactions.map((tx) => (
                        <div key={tx.id} className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              tx.status === 'succeeded' ? "bg-success-soft" : tx.status === 'pending' ? "bg-warning-soft" : "bg-danger-soft"
                            )}>
                              {tx.status === 'succeeded' ? (
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                              ) : tx.status === 'pending' ? (
                                <Clock className="w-5 h-5 text-warning" />
                              ) : (
                                <XCircle className="w-5 h-5 text-destructive" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{tx.username || `User #${tx.user_id}`}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(tx.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{tx.amount_rub.toLocaleString()} ₽</p>
                            <p className={cn(
                              "text-sm",
                              tx.status === 'succeeded' ? "text-emerald-700" : tx.status === 'pending' ? "text-warning" : "text-destructive"
                            )}>
                              {tx.status === 'succeeded' ? 'Успешно' : tx.status === 'pending' ? 'Ожидание' : 'Ошибка'}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'licenses' && (
              <div className="space-y-6">
                {licenseError && (
                  <div className="p-4 bg-danger-soft border border-destructive/30 rounded-xl text-destructive text-sm">
                    {licenseError}
                  </div>
                )}

                {licenseStats && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard title="Всего ключей" value={licenseStats.total_keys} icon={KeyRound} color="text-graphite-600" />
                    <StatCard title="Использовано" value={licenseStats.used_keys} icon={CheckCircle} color="text-emerald-600" />
                    <StatCard title="Свободно" value={licenseStats.unused_keys} icon={Clock} color="text-warning" />
                    <StatCard title="Активаций" value={licenseStats.active_users} icon={Users} color="text-graphite-600" />
                    <StatCard title="Выручка (₽)" value={licenseStats.revenue_rub} icon={DollarSign} color="text-emerald-600" />
                  </div>
                )}

                <div className="rounded-xl border border-border bg-card p-4 shadow-none">
                  <h3 className="font-medium mb-4">Генерация ключей</h3>
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={licenseType}
                      onChange={(e) => setLicenseType(e.target.value)}
                      className="input-field !w-auto px-3 py-2"
                    >
                      <option value="MONTHLY">Месячная (30 дней)</option>
                      <option value="QUARTERLY">Квартальная (90 дней)</option>
                      <option value="YEARLY">Годовая (365 дней)</option>
                    </select>
                    <button
                      onClick={() => handleGenerateLicense(1)}
                      disabled={licenseGenerating}
                      className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] inline-flex items-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Plus className="w-4 h-4" />
                      Сгенерировать
                    </button>
                    <button
                      onClick={() => handleGenerateLicense(10)}
                      disabled={licenseGenerating}
                      className="h-10 px-4 rounded-lg border border-input bg-card text-foreground text-sm font-medium hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 active:scale-[0.97] inline-flex items-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Plus className="w-4 h-4" />
                      10 шт
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
                  <div className="divide-y divide-border">
                    {licenses.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        Нет лицензионных ключей
                      </div>
                    ) : (
                      licenses.map((lic) => (
                        <div key={lic.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors duration-150">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-xs bg-graphite-100 px-2 py-1 rounded-lg border border-border truncate">
                              {lic.key}
                            </span>
                            <button
                              onClick={() => copyToClipboard(lic.key)}
                              className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150"
                              title="Скопировать"
                            >
                              {copiedKey === lic.key ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                              {lic.type}
                            </span>
                            <span className="text-sm text-muted-foreground font-mono w-16 text-right">
                              {lic.duration_days} дн.
                            </span>
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                              lic.is_used
                                ? 'bg-secondary text-muted-foreground'
                                : 'bg-emerald-100 text-emerald-800'
                            )}>
                              {lic.is_used ? 'Использован' : 'Свободен'}
                            </span>
                            <span className="text-sm text-muted-foreground hidden md:block">
                              {new Date(lic.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      Страница {licensePage} из {Math.max(1, Math.ceil(licensesTotal / 20))} (всего {licensesTotal})
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLicensePage((p) => Math.max(1, p - 1))}
                        disabled={licensePage <= 1}
                        className="h-8 px-3 rounded-lg border border-input bg-card text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors duration-150"
                      >
                        Назад
                      </button>
                      <button
                        onClick={() => setLicensePage((p) => p + 1)}
                        disabled={licensePage * 20 >= licensesTotal}
                        className="h-8 px-3 rounded-lg border border-input bg-card text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors duration-150"
                      >
                        Вперёд
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'apikeys' && (
              <div className="space-y-6">
                {apiKeysError && (
                  <div className="p-4 bg-danger-soft border border-destructive/30 rounded-xl text-destructive text-sm">
                    {apiKeysError}
                  </div>
                )}

                {apiKeysStats && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard title="Всего ключей" value={apiKeysStats.total} icon={KeySquare} color="text-graphite-600" />
                    <StatCard title="Активных" value={apiKeysStats.active} icon={CheckCircle} color="text-emerald-600" />
                    <StatCard title="Использовано за 24ч" value={apiKeysStats.used_last_24h} icon={Activity} color="text-graphite-600" />
                  </div>
                )}

                <div className="rounded-xl border border-border bg-card p-4 shadow-none">
                  <h3 className="font-medium mb-4">Создать API-ключ</h3>
                  <div className="flex flex-wrap gap-3 items-center">
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="Название ключа..."
                      className="input-field flex-1 min-w-[200px]"
                    />
                    <label className="flex items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes('read')}
                        onChange={(e) =>
                          setNewKeyScopes((s) =>
                            e.target.checked ? [...new Set([...s, 'read'])] : s.filter((x) => x !== 'read')
                          )
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm">read</span>
                    </label>
                    <label className="flex items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes('write')}
                        onChange={(e) =>
                          setNewKeyScopes((s) =>
                            e.target.checked ? [...new Set([...s, 'write'])] : s.filter((x) => x !== 'write')
                          )
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm">write</span>
                    </label>
                    <select
                      value={newKeyExpiry}
                      onChange={(e) => setNewKeyExpiry(e.target.value)}
                      className="input-field !w-auto px-3 py-2"
                    >
                      <option value="">Бессрочно</option>
                      <option value="30">30 дней</option>
                      <option value="90">90 дней</option>
                    </select>
                    <button
                      onClick={handleCreateApiKey}
                      disabled={apiKeyCreating || !newKeyName.trim()}
                      className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] inline-flex items-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Plus className="w-4 h-4" />
                      Создать
                    </button>
                  </div>
                </div>

                {createdKey && (
                  <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 shadow-none animate-rise-in">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                      <h3 className="font-medium text-[hsl(32_95%_30%)]">
                        Сохраните ключ — он показывается один раз
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 font-mono text-sm bg-card px-3 py-2 rounded-lg border border-border break-all">
                        {createdKey.key}
                      </code>
                      <button
                        onClick={() => copyToClipboard(createdKey.key)}
                        className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150 flex-shrink-0"
                        title="Скопировать"
                      >
                        {copiedKey === createdKey.key ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setCreatedKey(null)}
                        className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150 flex-shrink-0"
                        title="Скрыть"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
                  <div className="divide-y divide-border">
                    {apiKeys.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        Нет API-ключей
                      </div>
                    ) : (
                      apiKeys.map((key) => (
                        <div key={key.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors duration-150">
                          <div className="flex items-center gap-3 min-w-0">
                            <div>
                              <p className="font-medium text-sm">{key.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{key.prefix}…</p>
                            </div>
                            <div className="flex gap-1">
                              {(key.scopes || []).map((scope) => (
                                <span
                                  key={scope}
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground"
                                >
                                  {scope}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xs text-muted-foreground font-mono hidden md:block">
                              {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : '—'}
                            </span>
                            <button
                              onClick={() => handleToggleApiKey(key)}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-150',
                                key.is_active
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-secondary text-muted-foreground hover:bg-graphite-200'
                              )}
                              title={key.is_active ? 'Деактивировать' : 'Активировать'}
                            >
                              {key.is_active ? 'Активен' : 'Отозван'}
                            </button>
                            <button
                              onClick={() => handleRevokeApiKey(key.id)}
                              className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-destructive hover:bg-danger-soft transition-colors duration-150"
                              title="Отозвать ключ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
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

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-soft animate-count-flick">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</span>
        <Icon className={cn('w-5 h-5', color)} />
      </div>
      <p className="text-3xl font-display font-bold text-graphite-900">{value.toLocaleString()}</p>
    </div>
  )
}
