import React, { useState } from 'react'
import { Modal } from './Modal'
import { Ban, AlertTriangle, Loader2, User } from 'lucide-react'

interface BlockUserModalProps {
  isOpen: boolean
  onClose: () => void
  userId: number
  username: string
  avatar?: string
  onBlock: () => Promise<void>
}

export function BlockUserModal({
  isOpen,
  onClose,
  userId,
  username,
  avatar,
  onBlock
}: BlockUserModalProps) {
  const [loading, setLoading] = useState(false)

  const handleBlock = async () => {
    setLoading(true)
    try {
      await onBlock()
      onClose()
    } catch (err) {
      console.error('Block failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Ban className="w-8 h-8 text-red-400" />
        </div>

        <h2 className="text-xl font-bold text-foreground mb-2">Заблокировать пользователя?</h2>
        
        <div className="flex items-center justify-center gap-3 my-4 p-3 bg-muted/60 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-white" />
            )}
          </div>
          <span className="text-foreground font-medium">@{username}</span>
        </div>

        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4 text-left">
          <div className="flex gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-300">
              <p className="font-medium mb-1">После блокировки:</p>
              <ul className="list-disc list-inside text-yellow-300/80 space-y-1">
                <li>Пользователь не сможет писать вам</li>
                <li>Вы не увидите его сообщения в чатах</li>
                <li>Он не сможет добавить вас в друзья</li>
                <li>Вы можете разблокировать его в любое время</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-muted/60 hover:bg-muted rounded-lg text-foreground transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleBlock}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Ban className="w-4 h-4" />
                Заблокировать
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default BlockUserModal
