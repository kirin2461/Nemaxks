import React, { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { Forward, Search, User, Users, Loader2, Check } from 'lucide-react'
import { guildsAPI } from '../lib/api'

interface ForwardMessageModalProps {
  isOpen: boolean
  onClose: () => void
  messageContent: string
  messageId: string | number
  onForward: (targetType: 'user' | 'channel', targetId: string | number) => Promise<void>
}

interface Target {
  id: string | number
  name: string
  avatar?: string
  type: 'user' | 'channel'
  subtitle?: string
}

export function ForwardMessageModal({
  isOpen,
  onClose,
  messageContent,
  messageId,
  onForward
}: ForwardMessageModalProps) {
  const [search, setSearch] = useState('')
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null)
  const [forwarding, setForwarding] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadTargets()
    }
  }, [isOpen])

  const loadTargets = async () => {
    setLoading(true)
    try {
      const [friendsRes, guilds] = await Promise.all([
        fetch('/api/friends', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()),
        guildsAPI.getGuilds()
      ])
      const friends = friendsRes || []

      const userTargets: Target[] = (friends || []).map((f: any) => ({
        id: f.id,
        name: f.display_name || f.username,
        avatar: f.avatar,
        type: 'user' as const,
        subtitle: `@${f.username}`
      }))

      const channelTargets: Target[] = []
      for (const guild of (guilds || [])) {
        if (guild.channels) {
          for (const channel of guild.channels) {
            if (channel.type === 'text') {
              channelTargets.push({
                id: channel.id,
                name: `#${channel.name}`,
                type: 'channel' as const,
                subtitle: guild.name
              })
            }
          }
        }
      }

      setTargets([...userTargets, ...channelTargets])
    } catch (err) {
      console.error('Failed to load targets:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredTargets = targets.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subtitle?.toLowerCase().includes(search.toLowerCase())
  )

  const handleForward = async () => {
    if (!selectedTarget) return

    setForwarding(true)
    try {
      await onForward(selectedTarget.type, selectedTarget.id)
      handleClose()
    } catch (err) {
      console.error('Forward failed:', err)
    } finally {
      setForwarding(false)
    }
  }

  const handleClose = () => {
    setSearch('')
    setSelectedTarget(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Переслать сообщение" size="md">
      <div className="space-y-4">
        <div className="p-3 bg-muted/60 rounded-lg border-l-4 border-purple-500">
          <p className="text-foreground text-sm line-clamp-3">{messageContent}</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-muted/60 border border-border rounded-lg text-foreground focus:border-purple-500 outline-none transition-colors"
            placeholder="Поиск друзей и каналов..."
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : filteredTargets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'Ничего не найдено' : 'Нет доступных получателей'}
            </div>
          ) : (
            filteredTargets.map(target => (
              <button
                key={`${target.type}-${target.id}`}
                onClick={() => setSelectedTarget(target)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                  selectedTarget?.id === target.id && selectedTarget?.type === target.type
                    ? 'bg-purple-500/20 border border-purple-500'
                    : 'bg-muted/60 hover:bg-muted border border-transparent'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
                  {target.avatar ? (
                    <img src={target.avatar} alt="" className="w-full h-full object-cover" />
                  ) : target.type === 'user' ? (
                    <User className="w-5 h-5 text-white" />
                  ) : (
                    <Users className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-foreground font-medium">{target.name}</p>
                  {target.subtitle && (
                    <p className="text-muted-foreground text-sm">{target.subtitle}</p>
                  )}
                </div>
                {selectedTarget?.id === target.id && selectedTarget?.type === target.type && (
                  <Check className="w-5 h-5 text-purple-400" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={forwarding}
            className="flex-1 px-4 py-2 bg-muted/60 hover:bg-muted rounded-lg text-foreground transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleForward}
            disabled={!selectedTarget || forwarding}
            className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {forwarding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Forward className="w-4 h-4" />
                Переслать
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ForwardMessageModal
