import React, { useState } from 'react'
import { Modal } from './Modal'
import { LogOut, AlertTriangle, Loader2, Users } from 'lucide-react'

interface LeaveGuildModalProps {
  isOpen: boolean
  onClose: () => void
  guildId: string | number
  guildName: string
  guildIcon?: string
  isOwner?: boolean
  onLeave: () => Promise<void>
}

export function LeaveGuildModal({
  isOpen,
  onClose,
  guildId,
  guildName,
  guildIcon,
  isOwner = false,
  onLeave
}: LeaveGuildModalProps) {
  const [loading, setLoading] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const needsConfirmation = isOwner
  const isConfirmed = !needsConfirmation || confirmText === guildName

  const handleLeave = async () => {
    if (!isConfirmed) return

    setLoading(true)
    try {
      await onLeave()
      onClose()
    } catch (err) {
      console.error('Leave guild failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <LogOut className="w-8 h-8 text-red-400" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          {isOwner ? 'Удалить гильдию?' : 'Покинуть гильдию?'}
        </h2>

        <div className="flex items-center justify-center gap-3 my-4 p-3 bg-white/5 rounded-lg">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
            {guildIcon ? (
              <img src={guildIcon} alt="" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-5 h-5 text-white" />
            )}
          </div>
          <span className="text-white font-medium">{guildName}</span>
        </div>

        {isOwner ? (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4 text-left">
            <div className="flex gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-300">
                <p className="font-medium mb-1">Внимание!</p>
                <p>Вы являетесь владельцем гильдии. При удалении:</p>
                <ul className="list-disc list-inside mt-1 text-red-300/80">
                  <li>Все каналы будут удалены</li>
                  <li>Все сообщения будут потеряны</li>
                  <li>Все участники будут исключены</li>
                </ul>
                <p className="mt-2">Введите название гильдии для подтверждения:</p>
              </div>
            </div>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="w-full mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-white focus:border-red-400 outline-none"
              placeholder={guildName}
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm mb-4">
            Вы больше не сможете видеть каналы и сообщения этой гильдии.
            Вы сможете присоединиться снова по приглашению.
          </p>
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
            onClick={handleLeave}
            disabled={loading || !isConfirmed}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                {isOwner ? 'Удалить' : 'Покинуть'}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default LeaveGuildModal
