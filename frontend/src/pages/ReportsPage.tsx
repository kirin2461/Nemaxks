import { useState, useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { requestsAPI } from '@/lib/api'
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Send,
  FileText,
  Bug,
  Lightbulb,
  CreditCard,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface UserRequest {
  id: number
  category: string
  subject: string
  description: string
  priority: string
  status: string
  admin_notes?: string
  created_at: string
  updated_at: string
}

const categories = [
  { value: 'abuse', label: 'Жалоба на контент/пользователя', icon: AlertCircle },
  { value: 'technical', label: 'Техническая проблема', icon: Bug },
  { value: 'feature_request', label: 'Предложение по улучшению', icon: Lightbulb },
  { value: 'billing', label: 'Вопрос по оплате', icon: CreditCard },
  { value: 'other', label: 'Другое', icon: HelpCircle },
]

const priorities = [
  { value: 'low', label: 'Низкий' },
  { value: 'normal', label: 'Обычный' },
  { value: 'high', label: 'Высокий' },
]

const statusLabels: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Ожидает', color: 'text-warning', icon: Clock },
  in_progress: { label: 'В работе', color: 'text-primary', icon: Clock },
  resolved: { label: 'Решено', color: 'text-emerald-700', icon: CheckCircle },
  rejected: { label: 'Отклонено', color: 'text-destructive', icon: XCircle },
  cancelled: { label: 'Отменено', color: 'text-muted-foreground', icon: XCircle },
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new')
  const [requests, setRequests] = useState<UserRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    category: '',
    subject: '',
    description: '',
    priority: 'normal',
  })
  
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (activeTab === 'history') {
      loadRequests()
    }
  }, [activeTab])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const data = await requestsAPI.getMyRequests()
      setRequests(data)
    } catch (error) {
      console.error('Failed to load requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.category || !formData.subject) {
      setMessage({ type: 'error', text: 'Заполните все обязательные поля' })
      return
    }
    
    setSubmitting(true)
    try {
      await requestsAPI.create(formData)
      setMessage({ type: 'success', text: 'Обращение успешно отправлено!' })
      setFormData({ category: '', subject: '', description: '', priority: 'normal' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: 'Не удалось отправить обращение' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (id: number) => {
    try {
      await requestsAPI.cancel(id)
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r))
    } catch (error) {
      console.error('Failed to cancel request:', error)
    }
  }

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category)
    return cat ? cat.icon : FileText
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-4 md:px-6 md:py-6 animate-rise-in">
        <h1 className="text-2xl font-display font-bold text-graphite-900 mb-6">Обращения</h1>

        <div className="inline-flex p-1 rounded-lg bg-secondary gap-1 mb-6">
          <button
            onClick={() => setActiveTab('new')}
            className={`h-8 px-3 rounded-md text-sm transition-all duration-150 ${
              activeTab === 'new'
                ? 'bg-card text-foreground shadow-soft font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Новое обращение
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`h-8 px-3 rounded-md text-sm transition-all duration-150 ${
              activeTab === 'history'
                ? 'bg-card text-foreground shadow-soft font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Мои обращения
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-xl mb-4 flex items-center gap-2 border animate-toast-in ${
            message.type === 'success' ? 'bg-success-soft text-emerald-800 border-emerald-200' : 'bg-danger-soft text-destructive border-destructive/30'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        {activeTab === 'new' ? (
          <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-soft">
            <div>
              <label className="block text-sm font-medium mb-1.5">Категория *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categories.map(cat => {
                  const Icon = cat.icon
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                      className={`p-3 rounded-lg border text-left flex items-center gap-3 transition-all duration-150 ${
                        formData.category === cat.value
                          ? 'border-primary bg-accent text-accent-foreground shadow-soft'
                          : 'border-border bg-card hover:border-emerald-200 hover:bg-accent'
                      }`}
                    >
                      <Icon className="w-5 h-5 text-emerald-700" />
                      <span className="text-sm">{cat.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Тема *</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Кратко опишите суть обращения"
                className="input-field"
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Описание</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Подробно опишите вашу проблему или предложение..."
                rows={5}
                className="input-field resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Приоритет</label>
              <div className="inline-flex p-1 rounded-lg bg-secondary gap-1">
                {priorities.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, priority: p.value }))}
                    className={`h-8 px-3 rounded-md text-sm transition-all duration-150 ${
                      formData.priority === p.value
                        ? 'bg-card text-foreground shadow-soft font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !formData.category || !formData.subject}
              className="w-full h-12 px-6 rounded-lg bg-primary text-primary-foreground text-base font-medium flex items-center justify-center gap-2 shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150"
            >
              <Send className="w-5 h-5" />
              {submitting ? 'Отправка...' : 'Отправить обращение'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-16 rounded-xl" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-16 px-6 animate-rise-in">
                <div className="h-20 w-20 mx-auto rounded-2xl bg-secondary grid place-items-center">
                  <FileText className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                </div>
                <p className="text-lg font-semibold mt-4">У вас пока нет обращений</p>
              </div>
            ) : (
              requests.map(request => {
                const status = statusLabels[request.status] || statusLabels.pending
                const StatusIcon = status.icon
                const CategoryIcon = getCategoryIcon(request.category)
                const isExpanded = expandedId === request.id
                
                return (
                  <div key={request.id} className="rounded-xl border border-border bg-card overflow-hidden shadow-soft animate-rise-in">
                    <div
                      className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-accent/40 transition-colors duration-150"
                      onClick={() => setExpandedId(isExpanded ? null : request.id)}
                    >
                      <CategoryIcon className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{request.subject}</h3>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-secondary ${status.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span>{status.label}</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border pt-4 animate-fade-in-soft">
                        <p className="text-sm text-muted-foreground mb-3">
                          {request.description || 'Без описания'}
                        </p>
                        {request.admin_notes && (
                          <div className="bg-accent border border-emerald-200 rounded-lg p-3 mt-3">
                            <p className="text-sm font-medium mb-1 text-accent-foreground">Ответ администратора:</p>
                            <p className="text-sm">{request.admin_notes}</p>
                          </div>
                        )}
                        {request.status === 'pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCancel(request.id)
                            }}
                            className="mt-3 text-sm text-destructive hover:underline underline-offset-4"
                          >
                            Отменить обращение
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
