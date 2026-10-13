import { useState, useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { useStore } from '@/lib/store'
import { adminAPI, adminLicenseAPI, apiKeysAPI, type AdminStats, type IPBan, type AbuseReport, type AuditLog, type User, type ForbiddenWord, type ForbiddenAttempt, type BillingStats, type BillingTransaction, type LicenseKey, type ApiKey, type ApiKeyStats, type CreatedApiKey } from '@/lib/api'
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

type TabType = 'dashboard' | 'users' | 'bans' | 'reports' | 'logs' | 'filter' | 'attempts' | 'billing' | 'licenses' | 'apikeys'

interface LicenseStats {
  total_keys: number
  used_keys: number
  unused_keys: number
  active_users: number
  revenue_rub: number
}

export default function AdminPanel() {
  const { user } = useStore()
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
  const [licenseType, setLicenseType] = useState('PREMIUM')
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

  useEffect(() => {
    loadData()
  }, [activeTab, licensePage])

  const loadData = async () => {
    setLoading(true)
    try {
      switch (activeTab) {
        case 'dashboard':
          const statsData = await adminAPI.getStats()
          setStats(statsData)
          break
        case 'users':
          const usersData = await adminAPI.getUsers()
          setUsers(usersData.users)
          break
        case 'bans':
          const bansData = await adminAPI.getIPBans()
          setIPBans(bansData)
          break
        case 'reports':
          const reportsData = await adminAPI.getReports()
          setReports(reportsData)
          break
        case 'logs':
          const logsData = await adminAPI.getAuditLogs()
          setLogs(logsData.logs)
          break
        case 'filter':
          const wordsData = await adminAPI.getForbiddenWords()
          setForbiddenWords(wordsData)
          break
        case 'attempts':
          const attemptsData = await adminAPI.getForbiddenAttempts()
          setForbiddenAttempts(attemptsData.attempts)
          break
        case 'billing':
          const billingData = await adminAPI.getBillingStats()
          setBillingStats(billingData)
          break
        case 'licenses': {
          const [licensesData, statsData] = await Promise.all([
            adminLicenseAPI.getAll(licensePage, 20),
            adminLicenseAPI.getStats(),
          ])
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
          setApiKeys(keysData.api_keys ?? [])
          setApiKeysStats(keyStatsData)
          setApiKeysError('')
          break
        }
      }
    } catch (error) {
      console.error('Failed to load admin data:', error)
      if (activeTab === 'licenses') setLicenseError('Не удалось загрузить лицензии')
      if (activeTab === 'apikeys') setApiKeysError('Не удалось загрузить API-ключи')
    } finally {
      setLoading(false)
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

  const handleRevokeApiKey = async (id: number) => {
    if (!confirm('Отозвать этот API-ключ? Действие необратимо.')) return
    try {
      await apiKeysAPI.revoke(id)
      loadData()
    } catch (error) {
      console.error('Failed to revoke API key:', error)
      setApiKeysError('Ошибка отзыва API-ключа')
    }
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
      alert('Failed to add word. It may already exist.')
    }
  }

  const handleDeleteForbiddenWord = async (wordId: string) => {
    console.log('Deleting forbidden word:', wordId)
    if (!confirm('Are you sure you want to delete this word?')) return
    try {
      await adminAPI.deleteForbiddenWord(wordId)
      loadData()
    } catch (error) {
      console.error('Failed to delete forbidden word:', error)
    }
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

  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="glass-strong rounded-xl p-8 max-w-md text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-2xl font-bold mb-4">Доступ запрещён</h1>
            <p className="text-muted-foreground mb-6">
              У вас нет прав для доступа к панели администратора.
            </p>
            <a href="/" className="text-primary hover:text-primary/80">Вернуться на главную</a>
          </div>
        </div>
      </Layout>
    )
  }

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Обзор', icon: Activity },
    { id: 'users' as TabType, label: 'Пользователи', icon: Users },
    { id: 'bans' as TabType, label: 'Баны IP', icon: Ban },
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
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-brand-text">Панель администратора</h1>
            <p className="text-muted-foreground mt-1">Управление платформой и модерация</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 text-primary border border-primary/25 text-sm">
            <Shield className="w-4 h-4" />
            {user.role === 'admin' ? 'Администратор' : 'Модератор'}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
                activeTab === tab.id
                  ? 'gradient-brand text-primary-foreground shadow-soft'
                  : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="loading-spinner" />
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Пользователи"
                  value={stats.users}
                  icon={Users}
                  color="text-blue-500"
                />
                <StatCard
                  title="Онлайн"
                  value={stats.online_users}
                  icon={Globe}
                  color="text-green-500"
                />
                <StatCard
                  title="Сообщения"
                  value={stats.messages}
                  icon={MessageSquare}
                  color="text-purple-500"
                />
                <StatCard
                  title="Посты"
                  value={stats.posts}
                  icon={TrendingUp}
                  color="text-orange-500"
                />
                <StatCard
                  title="Сообщества"
                  value={stats.guilds}
                  icon={Server}
                  color="text-cyan-500"
                />
                <StatCard
                  title="Активные баны"
                  value={stats.active_bans}
                  icon={Ban}
                  color="text-red-500"
                />
                <StatCard
                  title="Ожидающие жалобы"
                  value={stats.pending_reports}
                  icon={AlertTriangle}
                  color="text-yellow-500"
                />
              </div>
            )}

            {activeTab === 'users' && (
              <div className="glass rounded-xl">
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
                      <div key={u.id} className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar alt={u.username} size="md" />
                          <div>
                            <p className="font-medium">{u.username}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'px-2 py-1 rounded-full text-xs',
                            u.role === 'admin' ? 'bg-primary/15 text-primary border border-primary/25' :
                            u.role === 'moderator' ? 'bg-accent/15 text-accent border border-accent/25' :
                            'bg-muted text-muted-foreground'
                          )}>
                            {u.role || 'user'}
                          </span>
                          <button
                            onClick={() => handleBanUser(u.id, 'Действие администратора')}
                            className="p-2 rounded-lg hover:bg-red-500/15 text-red-400 transition-colors"
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
              <div className="glass rounded-xl">
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

            {activeTab === 'reports' && (
              <div className="glass rounded-xl">
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
                                'px-2 py-0.5 rounded-full text-xs',
                                report.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25' :
                                report.status === 'resolved' ? 'bg-accent/15 text-accent border border-accent/25' :
                                'bg-red-500/15 text-red-400 border border-red-500/25'
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
                                className="p-2 rounded-lg hover:bg-green-500/10 text-green-500"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleResolveReport(report.id, 'rejected')}
                                className="p-2 rounded-lg hover:bg-red-500/15 text-red-400 transition-colors"
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
              <div className="glass rounded-xl">
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
                      className="px-4 py-2 rounded-lg gradient-brand text-primary-foreground shadow-soft hover:brightness-110 flex items-center gap-2 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить
                    </button>
                  </div>
                </div>

                <div className="glass rounded-xl">
                  <div className="divide-y divide-border">
                    {forbiddenWords.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        Нет запрещённых слов
                      </div>
                    ) : (
                      forbiddenWords.map((word) => (
                        <div key={word.id} className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
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
                                className="p-2 rounded-lg hover:bg-green-500/10 text-green-500"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingWord(null)}
                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3">
                                <span className="font-mono bg-muted/70 px-2 py-1 rounded-lg border border-border">{word.word}</span>
                                <span className={cn(
                                  'px-2 py-0.5 rounded-full text-xs',
                                  word.category === 'criminal' ? 'bg-red-500/15 text-red-400 border border-red-500/25' :
                                  word.category === 'violence' ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25' :
                                  word.category === 'spam' ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25' :
                                  word.category === 'fraud' ? 'bg-primary/15 text-primary border border-primary/25' :
                                  'bg-muted text-muted-foreground'
                                )}>
                                  {word.category}
                                </span>
                                {word.is_regex && (
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-accent/15 text-accent border border-accent/25">
                                    regex
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setEditingWord(word)}
                                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteForbiddenWord(word.id)}
                                  className="p-2 rounded-lg hover:bg-red-500/15 text-red-400 transition-colors"
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
              <div className="glass rounded-xl">
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
                              <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 border border-red-500/25">
                                {attempt.context}
                              </span>
                            </div>
                            <p className="text-sm bg-muted p-2 rounded font-mono break-all">
                              {attempt.attempted_content.length > 200
                                ? attempt.attempted_content.substring(0, 200) + '...'
                                : attempt.attempted_content}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Совпадения: <span className="text-red-400">{attempt.matched_words}</span>
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
                    color="text-purple-500"
                  />
                  <StatCard
                    title="Доход за месяц"
                    value={billingStats.monthly_revenue}
                    icon={DollarSign}
                    color="text-green-500"
                  />
                  <StatCard
                    title="Общий доход"
                    value={billingStats.total_revenue}
                    icon={TrendingUp}
                    color="text-blue-500"
                  />
                  <div className="glass rounded-xl p-6 shadow-soft">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-muted-foreground">Отток</span>
                      <RefreshCw className="w-5 h-5 text-orange-500" />
                    </div>
                    <p className="text-3xl font-bold">{billingStats.churn_rate.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass rounded-xl p-6 shadow-soft">
                    <h3 className="text-lg font-semibold mb-4">Статистика за месяц</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Новых подписок</span>
                        <span className="font-medium text-green-500">+{billingStats.new_subscriptions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Отменено</span>
                        <span className="font-medium text-red-500">-{billingStats.cancelled_subscriptions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Нетто</span>
                        <span className={cn("font-medium", billingStats.new_subscriptions - billingStats.cancelled_subscriptions >= 0 ? "text-green-500" : "text-red-500")}>
                          {billingStats.new_subscriptions - billingStats.cancelled_subscriptions >= 0 ? '+' : ''}{billingStats.new_subscriptions - billingStats.cancelled_subscriptions}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="glass rounded-xl p-6 shadow-soft">
                    <h3 className="text-lg font-semibold mb-4">MRR</h3>
                    <div className="text-4xl font-bold gradient-brand-text">
                      {billingStats.monthly_revenue.toLocaleString()} ₽
                    </div>
                    <p className="text-muted-foreground mt-2">
                      Ежемесячный регулярный доход
                    </p>
                  </div>
                </div>

                <div className="glass rounded-xl">
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
                              tx.status === 'succeeded' ? "bg-accent/15" : tx.status === 'pending' ? "bg-yellow-500/15" : "bg-red-500/15"
                            )}>
                              {tx.status === 'succeeded' ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : tx.status === 'pending' ? (
                                <Clock className="w-5 h-5 text-yellow-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
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
                              tx.status === 'succeeded' ? "text-green-500" : tx.status === 'pending' ? "text-yellow-500" : "text-red-500"
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
                  <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm">
                    {licenseError}
                  </div>
                )}

                {licenseStats && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard title="Всего ключей" value={licenseStats.total_keys} icon={KeyRound} color="text-blue-500" />
                    <StatCard title="Использовано" value={licenseStats.used_keys} icon={CheckCircle} color="text-green-500" />
                    <StatCard title="Свободно" value={licenseStats.unused_keys} icon={Clock} color="text-yellow-500" />
                    <StatCard title="Активаций" value={licenseStats.active_users} icon={Users} color="text-purple-500" />
                    <StatCard title="Выручка (₽)" value={licenseStats.revenue_rub} icon={DollarSign} color="text-orange-500" />
                  </div>
                )}

                <div className="glass rounded-xl p-4">
                  <h3 className="font-medium mb-4">Генерация ключей</h3>
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={licenseType}
                      onChange={(e) => setLicenseType(e.target.value)}
                      className="input-field !w-auto px-3 py-2"
                    >
                      <option value="PREMIUM">PREMIUM</option>
                      <option value="BASIC">BASIC</option>
                    </select>
                    <button
                      onClick={() => handleGenerateLicense(1)}
                      disabled={licenseGenerating}
                      className="px-4 py-2 rounded-lg gradient-brand text-primary-foreground shadow-soft hover:brightness-110 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      Сгенерировать
                    </button>
                    <button
                      onClick={() => handleGenerateLicense(10)}
                      disabled={licenseGenerating}
                      className="px-4 py-2 rounded-lg bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      10 шт
                    </button>
                  </div>
                </div>

                <div className="glass rounded-xl">
                  <div className="divide-y divide-border">
                    {licenses.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        Нет лицензионных ключей
                      </div>
                    ) : (
                      licenses.map((lic) => (
                        <div key={lic.id} className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-sm bg-muted/70 px-2 py-1 rounded-lg border border-border truncate">
                              {lic.key}
                            </span>
                            <button
                              onClick={() => copyToClipboard(lic.key)}
                              className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                              title="Скопировать"
                            >
                              {copiedKey === lic.key ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-primary/15 text-primary border border-primary/25">
                              {lic.type}
                            </span>
                            <span className="text-sm text-muted-foreground w-16 text-right">
                              {lic.duration_days} дн.
                            </span>
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs',
                              lic.is_used
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-accent/15 text-accent border border-accent/25'
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
                  <div className="flex items-center justify-between p-4 border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      Страница {licensePage} из {Math.max(1, Math.ceil(licensesTotal / 20))} (всего {licensesTotal})
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLicensePage((p) => Math.max(1, p - 1))}
                        disabled={licensePage <= 1}
                        className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Назад
                      </button>
                      <button
                        onClick={() => setLicensePage((p) => p + 1)}
                        disabled={licensePage * 20 >= licensesTotal}
                        className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm">
                    {apiKeysError}
                  </div>
                )}

                {apiKeysStats && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard title="Всего ключей" value={apiKeysStats.total} icon={KeySquare} color="text-blue-500" />
                    <StatCard title="Активных" value={apiKeysStats.active} icon={CheckCircle} color="text-green-500" />
                    <StatCard title="Использовано за 24ч" value={apiKeysStats.used_last_24h} icon={Activity} color="text-purple-500" />
                  </div>
                )}

                <div className="glass rounded-xl p-4">
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
                      className="px-4 py-2 rounded-lg gradient-brand text-primary-foreground shadow-soft hover:brightness-110 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      Создать
                    </button>
                  </div>
                </div>

                {createdKey && (
                  <div className="glass rounded-xl p-4 border border-yellow-500/40 bg-yellow-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      <h3 className="font-medium text-yellow-400">
                        Сохраните ключ — он показывается один раз
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 font-mono text-sm bg-background/60 px-3 py-2 rounded-lg border border-border break-all">
                        {createdKey.key}
                      </code>
                      <button
                        onClick={() => copyToClipboard(createdKey.key)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors flex-shrink-0"
                        title="Скопировать"
                      >
                        {copiedKey === createdKey.key ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setCreatedKey(null)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors flex-shrink-0"
                        title="Скрыть"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="glass rounded-xl">
                  <div className="divide-y divide-border">
                    {apiKeys.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        Нет API-ключей
                      </div>
                    ) : (
                      apiKeys.map((key) => (
                        <div key={key.id} className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div>
                              <p className="font-medium">{key.name}</p>
                              <p className="text-sm text-muted-foreground font-mono">{key.prefix}…</p>
                            </div>
                            <div className="flex gap-1">
                              {(key.scopes || []).map((scope) => (
                                <span
                                  key={scope}
                                  className="px-2 py-0.5 rounded-full text-xs bg-accent/15 text-accent border border-accent/25"
                                >
                                  {scope}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-sm text-muted-foreground hidden md:block">
                              {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : '—'}
                            </span>
                            <button
                              onClick={() => handleToggleApiKey(key)}
                              className={cn(
                                'px-2 py-0.5 rounded-full text-xs border transition-colors',
                                key.is_active
                                  ? 'bg-green-500/15 text-green-400 border-green-500/25 hover:bg-green-500/25'
                                  : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                              )}
                              title={key.is_active ? 'Деактивировать' : 'Активировать'}
                            >
                              {key.is_active ? 'Активен' : 'Отозван'}
                            </button>
                            <button
                              onClick={() => handleRevokeApiKey(key.id)}
                              className="p-2 rounded-lg hover:bg-red-500/15 text-red-400 transition-colors"
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
    <div className="glass rounded-xl p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <span className="text-muted-foreground">{title}</span>
        <Icon className={cn('w-5 h-5', color)} />
      </div>
      <p className="text-3xl font-bold">{value.toLocaleString()}</p>
    </div>
  )
}
