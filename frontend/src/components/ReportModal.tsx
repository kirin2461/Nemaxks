import React, { useState } from 'react'
import { Modal } from './Modal'
import { Flag, AlertTriangle, Loader2, CheckCircle } from 'lucide-react'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  targetType: 'user' | 'message' | 'guild' | 'post'
  targetId: string | number
  targetName?: string
  onSubmit: (data: { reason: string; category: string; details?: string }) => Promise<void>
}

const REPORT_CATEGORIES = [
  { id: 'spam', label: 'Спам', icon: '📧' },
  { id: 'harassment', label: 'Оскорбления', icon: '😠' },
  { id: 'inappropriate', label: 'Неприемлемый контент', icon: '🔞' },
  { id: 'impersonation', label: 'Выдача себя за другого', icon: '🎭' },
  { id: 'scam', label: 'Мошенничество', icon: '💰' },
  { id: 'violence', label: 'Угрозы насилия', icon: '⚠️' },
  { id: 'other', label: 'Другое', icon: '📝' },
]

export function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetName,
  onSubmit
}: ReportModalProps) {
  const [category, setCategory] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const getTargetLabel = () => {
    switch (targetType) {
      case 'user': return 'пользователя'
      case 'message': return 'сообщение'
      case 'guild': return 'гильдию'
      case 'post': return 'публикацию'
      default: return 'контент'
    }
  }

  const handleSubmit = async () => {
    if (!category) {
      setError('Выберите причину жалобы')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onSubmit({
        reason: REPORT_CATEGORIES.find(c => c.id === category)?.label || category,
        category,
        details: details.trim() || undefined
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Не удалось отправить жалобу')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setCategory('')
    setDetails('')
    setSubmitted(false)
    setError('')
    onClose()
  }

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} size="sm">
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Жалоба отправлена</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Спасибо за обращение! Наша команда модерации рассмотрит вашу жалобу в ближайшее время.
          </p>
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white transition-colors"
          >
            Закрыть
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-300 text-sm">
            Пожалуйста, используйте эту функцию только для реальных нарушений. 
            Ложные жалобы могут привести к ограничениям вашего аккаунта.
          </p>
        </div>

        <div>
          <p className="text-muted-foreground text-sm mb-3">
            Жалоба на {getTargetLabel()}{targetName ? `: ${targetName}` : ''}
          </p>
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-2">Причина жалобы *</label>
          <div className="grid grid-cols-2 gap-2">
            {REPORT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-all text-left ${
                  category === cat.id
                    ? 'border-red-500 bg-red-500/10 text-red-300'
                    : 'border-white/10 bg-white/5 text-foreground hover:bg-white/10'
                }`}
              >
                <span>{cat.icon}</span>
                <span className="text-sm">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-2">Дополнительная информация</label>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-colors resize-none"
            placeholder="Опишите ситуацию подробнее (необязательно)..."
          />
          <p className="text-xs text-muted-foreground mt-1">{details.length}/500</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !category}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Flag className="w-4 h-4" />
                Отправить жалобу
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ReportModal
