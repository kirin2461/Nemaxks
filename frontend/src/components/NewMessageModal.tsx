import { useState } from 'react'
import { Avatar } from './Avatar'
import { X, Search, MessageSquare } from 'lucide-react'

interface NewMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectUser: (user: any) => void
  friends: any[]
}

export function NewMessageModal({ isOpen, onClose, onSelectUser, friends }: NewMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState('')

  if (!isOpen) return null

  const filteredFriends = friends.filter(f =>
    f.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.alias?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelect = (user: any) => {
    onSelectUser(user)
    onClose()
    setSearchQuery('')
  }

  const handleClose = () => {
    setSearchQuery('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div 
        className="relative z-10 w-full max-w-md bg-card rounded-xl border border-border shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Новое сообщение</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-accent/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск друзей..."
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg
                        text-foreground placeholder:text-muted-foreground
                        focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                        transition-all duration-300"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {filteredFriends.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground text-sm">
                {searchQuery ? 'Друзья не найдены' : 'Нет друзей для отправки сообщения'}
              </p>
            </div>
          ) : (
            filteredFriends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => handleSelect(friend)}
                className="w-full p-4 flex items-center gap-3 hover:bg-accent/10 transition-all duration-300 border-b border-border/50 last:border-b-0 cursor-pointer"
              >
                <Avatar
                  src={friend.avatar}
                  alt={friend.username}
                  userId={friend.id}
                />
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate">
                    {friend.alias || friend.username}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    @{friend.username}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
