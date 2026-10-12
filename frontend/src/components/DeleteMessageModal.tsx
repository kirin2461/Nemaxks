import React, { useState } from 'react'
import { Modal } from './Modal'
import { Trash2, Loader2, AlertTriangle } from 'lucide-react'

interface DeleteMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onDelete: (deleteForEveryone: boolean) => Promise<void>
  messagePreview?: string
  canDeleteForEveryone?: boolean
}

export function DeleteMessageModal({
  isOpen,
  onClose,
  onDelete,
  messagePreview,
  canDeleteForEveryone = false
}: DeleteMessageModalProps) {
  const [deleteForEveryone, setDeleteForEveryone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      await onDelete(deleteForEveryone)
      onClose()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-8 h-8 text-red-400" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Удалить сообщение?</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Это действие нельзя отменить
        </p>

        {messagePreview && (
          <div className="p-3 bg-white/5 rounded-lg mb-4 text-left">
            <p className="text-foreground text-sm line-clamp-3">{messagePreview}</p>
          </div>
        )}

        {canDeleteForEveryone && (
          <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg mb-4 cursor-pointer hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              checked={deleteForEveryone}
              onChange={e => setDeleteForEveryone(e.target.checked)}
              className="w-5 h-5 rounded border-gray-500 bg-transparent text-red-500 focus:ring-red-500"
            />
            <div className="text-left">
              <p className="text-white text-sm font-medium">Удалить для всех</p>
              <p className="text-muted-foreground text-xs">Сообщение исчезнет у всех участников</p>
            </div>
          </label>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Удалить
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default DeleteMessageModal
