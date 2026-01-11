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
  pending: { label: 'Ожидает', color: 'text-yellow-500', icon: Clock },
  in_progress: { label: 'В работе', color: 'text-blue-500', icon: Clock },
  resolved: { label: 'Решено', color: 'text-green-500', icon: CheckCircle },
  rejected: { label: 'Отклонено', color: 'text-red-500', icon: XCircle },
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
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-6">Обращения</h1>
        
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'new' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card hover:bg-accent'
            }`}
          >
            Новое обращение
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'history' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card hover:bg-accent'
            }`}
          >
            Мои обращения
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-4 flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        {activeTab === 'new' ? (
          <form onSubmit={handleSubmit} className="bg-card rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Категория *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categories.map(cat => {
                  const Icon = cat.icon
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                      className={`p-3 rounded-lg border text-left flex items-center gap-3 transition-colors ${
                        formData.category === cat.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Icon className="w-5 h-5 text-primary" />
                      <span className="text-sm">{cat.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Тема *</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Кратко опишите суть обращения"
                className="w-full px-4 py-2 bg-background rounded-lg border border-border focus:border-primary focus:outline-none"
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Описание</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Подробно опишите вашу проблему или предложение..."
                rows={5}
                className="w-full px-4 py-2 bg-background rounded-lg border border-border focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Приоритет</label>
              <div className="flex gap-2">
                {priorities.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, priority: p.value }))}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      formData.priority === p.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-accent'
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
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
              {submitting ? 'Отправка...' : 'Отправить обращение'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>У вас пока нет обращений</p>
              </div>
            ) : (
              requests.map(request => {
                const status = statusLabels[request.status] || statusLabels.pending
                const StatusIcon = status.icon
                const CategoryIcon = getCategoryIcon(request.category)
                const isExpanded = expandedId === request.id
                
                return (
                  <div key={request.id} className="bg-card rounded-xl overflow-hidden">
                    <div 
                      className="p-4 flex items-center gap-4 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : request.id)}
                    >
                      <CategoryIcon className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{request.subject}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <div className={`flex items-center gap-1 ${status.color}`}>
                        <StatusIcon className="w-4 h-4" />
                        <span className="text-sm">{status.label}</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                    
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border pt-4">
                        <p className="text-sm text-muted-foreground mb-3">
                          {request.description || 'Без описания'}
                        </p>
                        {request.admin_notes && (
                          <div className="bg-primary/10 rounded-lg p-3 mt-3">
                            <p className="text-sm font-medium mb-1">Ответ администратора:</p>
                            <p className="text-sm">{request.admin_notes}</p>
                          </div>
                        )}
                        {request.status === 'pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCancel(request.id)
                            }}
                            className="mt-3 text-sm text-red-400 hover:text-red-300"
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
