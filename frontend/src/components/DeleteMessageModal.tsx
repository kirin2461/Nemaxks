import React, { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
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
        <div className="w-16 h-16 bg-danger-soft rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-8 h-8 text-destructive" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">Удалить сообщение?</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Это действие нельзя отменить
        </p>

        {messagePreview && (
          <div className="p-3 bg-secondary/60 rounded-xl mb-4 text-left">
            <p className="text-foreground text-sm line-clamp-3">{messagePreview}</p>
          </div>
        )}

        {canDeleteForEveryone && (
          <label className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl mb-4 cursor-pointer hover:bg-secondary transition-colors">
            <input
              type="checkbox"
              checked={deleteForEveryone}
              onChange={e => setDeleteForEveryone(e.target.checked)}
              className="w-5 h-5 rounded border-border bg-transparent text-destructive focus:ring-destructive/30"
            />
            <div className="text-left">
              <p className="text-foreground text-sm font-medium">Удалить для всех</p>
              <p className="text-muted-foreground text-xs">Сообщение исчезнет у всех участников</p>
            </div>
          </label>
        )}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Отмена
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Удалить
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default DeleteMessageModal
