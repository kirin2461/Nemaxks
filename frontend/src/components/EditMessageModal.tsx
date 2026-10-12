import React, { useState, useEffect, useRef } from 'react'
import { Modal } from './Modal'
import { Edit3, Loader2 } from 'lucide-react'

interface EditMessageModalProps {
  isOpen: boolean
  onClose: () => void
  messageId: string | number
  originalContent: string
  onSave: (newContent: string) => Promise<void>
}

export function EditMessageModal({
  isOpen,
  onClose,
  messageId,
  originalContent,
  onSave
}: EditMessageModalProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setContent(originalContent)
      setError('')
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.setSelectionRange(originalContent.length, originalContent.length)
      }, 100)
    }
  }, [isOpen, originalContent])

  const handleSave = async () => {
    const trimmed = content.trim()
    if (!trimmed) {
      setError('Сообщение не может быть пустым')
      return
    }
    if (trimmed === originalContent) {
      onClose()
      return
    }

    setLoading(true)
    setError('')

    try {
      await onSave(trimmed)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Редактировать сообщение" size="md">
      <div className="space-y-4">
        <div>
          <textarea
            ref={inputRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            rows={4}
            className="w-full px-4 py-3 bg-muted/60 border border-border rounded-lg text-foreground focus:border-purple-500 outline-none transition-colors resize-none"
            placeholder="Введите сообщение..."
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Enter - сохранить, Shift+Enter - новая строка</span>
            <span>{content.length}/2000</span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-muted/60 hover:bg-muted rounded-lg text-foreground transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !content.trim()}
            className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Edit3 className="w-4 h-4" />
                Сохранить
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default EditMessageModal
