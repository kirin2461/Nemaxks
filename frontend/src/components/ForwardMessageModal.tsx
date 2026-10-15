import React, { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
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
        <div className="p-3 bg-secondary/60 rounded-xl border-l-4 border-primary">
          <p className="text-foreground text-sm line-clamp-3">{messageContent}</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
            placeholder="Поиск друзей и каналов..."
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
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
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                  selectedTarget?.id === target.id && selectedTarget?.type === target.type
                    ? 'bg-primary/15 border border-primary/60 shadow-lg-brand'
                    : 'bg-secondary/50 hover:bg-secondary border border-transparent'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center overflow-hidden">
                  {target.avatar ? (
                    <img src={target.avatar} alt="" className="w-full h-full object-cover" />
                  ) : target.type === 'user' ? (
                    <User className="w-5 h-5 text-primary-foreground" />
                  ) : (
                    <Users className="w-5 h-5 text-primary-foreground" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-foreground font-medium">{target.name}</p>
                  {target.subtitle && (
                    <p className="text-muted-foreground text-sm">{target.subtitle}</p>
                  )}
                </div>
                {selectedTarget?.id === target.id && selectedTarget?.type === target.type && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={forwarding}
            className="flex-1"
          >
            Отмена
          </Button>
          <Button
            onClick={handleForward}
            disabled={!selectedTarget || forwarding}
            className="flex-1"
          >
            {forwarding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Forward className="w-4 h-4" />
                Переслать
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ForwardMessageModal
