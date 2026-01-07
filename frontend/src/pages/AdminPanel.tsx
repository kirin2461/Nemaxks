import { useState, useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { useStore } from '@/lib/store'
import { adminAPI, type AdminStats, type IPBan, type AbuseReport, type AuditLog, type User, type ForbiddenWord, type ForbiddenAttempt } from '@/lib/api'
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
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TabType = 'dashboard' | 'users' | 'bans' | 'reports' | 'logs' | 'filter' | 'attempts'

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
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [newWord, setNewWord] = useState('')
  const [newWordCategory, setNewWordCategory] = useState('general')
  const [newWordIsRegex, setNewWordIsRegex] = useState(false)
  const [editingWord, setEditingWord] = useState<ForbiddenWord | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

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
      }
    } catch (error) {
      console.error('Failed to load admin data:', error)
    } finally {
      setLoading(false)
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
          <div className="bg-card border border-border rounded-lg p-8 max-w-md text-center">
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
  ]

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Панель администратора</h1>
            <p className="text-muted-foreground mt-1">Управление платформой и модерация</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
            <Shield className="w-4 h-4" />
            {user.role === 'admin' ? 'Администратор' : 'Модератор'}
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-border pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
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
              <div className="bg-card rounded-lg border border-border">
                <div className="p-4 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Поиск пользователей..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {users
                    .filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Avatar alt={u.username} size="md" />
                          <div>
                            <p className="font-medium">{u.username}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'px-2 py-1 rounded text-xs',
                            u.role === 'admin' ? 'bg-red-500/20 text-red-500' :
                            u.role === 'moderator' ? 'bg-yellow-500/20 text-yellow-500' :
                            'bg-muted text-muted-foreground'
                          )}>
                            {u.role || 'user'}
                          </span>
                          <button
                            onClick={() => handleBanUser(u.id, 'Admin action')}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-red-500"
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
              <div className="bg-card rounded-lg border border-border">
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
              <div className="bg-card rounded-lg border border-border">
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
                                'px-2 py-0.5 rounded text-xs',
                                report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                                report.status === 'resolved' ? 'bg-green-500/20 text-green-500' :
                                'bg-red-500/20 text-red-500'
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
                                className="p-2 rounded-lg hover:bg-red-500/10 text-red-500"
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
              <div className="bg-card rounded-lg border border-border">
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
                      className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <select
                      value={newWordCategory}
                      onChange={(e) => setNewWordCategory(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-background border border-border"
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
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить
                    </button>
                  </div>
                </div>

                <div className="bg-card rounded-lg border border-border">
                  <div className="divide-y divide-border">
                    {forbiddenWords.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        Нет запрещённых слов
                      </div>
                    ) : (
                      forbiddenWords.map((word) => (
                        <div key={word.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                          {editingWord?.id === word.id ? (
                            <div className="flex-1 flex items-center gap-3">
                              <input
                                type="text"
                                value={editingWord.word}
                                onChange={(e) => setEditingWord({ ...editingWord, word: e.target.value })}
                                className="flex-1 px-3 py-2 rounded-lg bg-background border border-border"
                              />
                              <select
                                value={editingWord.category}
                                onChange={(e) => setEditingWord({ ...editingWord, category: e.target.value })}
                                className="px-3 py-2 rounded-lg bg-background border border-border"
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
                                <span className="font-mono bg-muted px-2 py-1 rounded">{word.word}</span>
                                <span className={cn(
                                  'px-2 py-0.5 rounded text-xs',
                                  word.category === 'criminal' ? 'bg-red-500/20 text-red-500' :
                                  word.category === 'violence' ? 'bg-orange-500/20 text-orange-500' :
                                  word.category === 'spam' ? 'bg-yellow-500/20 text-yellow-500' :
                                  word.category === 'fraud' ? 'bg-purple-500/20 text-purple-500' :
                                  'bg-muted text-muted-foreground'
                                )}>
                                  {word.category}
                                </span>
                                {word.is_regex && (
                                  <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-500">
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
                                  className="p-2 rounded-lg hover:bg-red-500/10 text-red-500"
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
              <div className="bg-card rounded-lg border border-border">
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
                              <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-500">
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
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-muted-foreground">{title}</span>
        <Icon className={cn('w-5 h-5', color)} />
      </div>
      <p className="text-3xl font-bold">{value.toLocaleString()}</p>
    </div>
  )
}
