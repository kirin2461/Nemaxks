import React, { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { User, MessageCircle, UserPlus, UserMinus, Ban, Flag, Crown, Shield, Star, Calendar, Clock } from 'lucide-react'
import { userAPI } from '../lib/api'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  userId: number | string
  onMessage?: (userId: number) => void
}

export function UserProfileModal({ isOpen, onClose, userId, onMessage }: UserProfileModalProps) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isFriend, setIsFriend] = useState(false)
  const [friendLoading, setFriendLoading] = useState(false)

  useEffect(() => {
    if (isOpen && userId) {
      loadUser()
    }
  }, [isOpen, userId])

  const loadUser = async () => {
    setLoading(true)
    try {
      const data = await userAPI.getProfile(String(userId))
      setUser(data)
      setIsFriend((data as any).is_friend || false)
    } catch (err) {
      console.error('Failed to load user:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFriendAction = async () => {
    setFriendLoading(true)
    try {
      if (isFriend) {
        await fetch(`/api/friends/${userId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        setIsFriend(false)
      } else {
        await fetch(`/api/friends/request`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_id: userId })
        })
        setIsFriend(true)
      }
    } catch (err) {
      console.error('Friend action failed:', err)
    } finally {
      setFriendLoading(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return { icon: Crown, color: 'text-warning', bg: 'bg-warning-soft', label: 'Super Admin' }
      case 'admin':
        return { icon: Shield, color: 'text-destructive', bg: 'bg-danger-soft', label: 'Админ' }
      case 'moderator':
        return { icon: Shield, color: 'text-primary', bg: 'bg-accent', label: 'Модератор' }
      default:
        return null
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Modal>
    )
  }

  if (!user) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <div className="text-center py-8 text-muted-foreground">
          Пользователь не найден
        </div>
      </Modal>
    )
  }

  const roleBadge = getRoleBadge(user.role)

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="relative max-h-[85vh] overflow-y-auto">
        <div className="h-24 bg-emerald-700 rounded-t-lg -mx-4 -mt-4" />
        
        <div className="relative -mt-12 px-4">
          <div className="w-24 h-24 rounded-full bg-emerald-700 border-4 border-card flex items-center justify-center overflow-hidden">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-white" />
            )}
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">
                {user.display_name || user.username}
              </h2>
              {roleBadge && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge.bg} ${roleBadge.color} flex items-center gap-1`}>
                  <roleBadge.icon className="w-3 h-3" />
                  {roleBadge.label}
                </span>
              )}
            </div>
            <p className="text-muted-foreground">@{user.username}</p>
          </div>

          {user.bio && (
            <p className="mt-3 text-foreground text-sm">{user.bio}</p>
          )}

          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-warning" />
              <span>Уровень {user.level || 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(user.created_at)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4 p-4 bg-muted/60 rounded-lg">
            <div className="text-center">
              <p className="text-xl font-bold text-white">{user.friends_count || 0}</p>
              <p className="text-xs text-muted-foreground">Друзей</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white">{user.messages_count || 0}</p>
              <p className="text-xs text-muted-foreground">Сообщений</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white">{user.xp || 0}</p>
              <p className="text-xs text-muted-foreground">XP</p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onMessage?.(user.id)}
              className="flex-1 px-4 py-2 bg-primary hover:bg-emerald-800 rounded-lg text-white transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Написать
            </button>
            <button
              onClick={handleFriendAction}
              disabled={friendLoading}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                isFriend 
                  ? 'bg-danger-soft hover:bg-destructive/30 text-destructive'
                  : 'bg-accent hover:bg-emerald-500/30 text-emerald-600'
              }`}
            >
              {isFriend ? (
                <>
                  <UserMinus className="w-4 h-4" />
                  Удалить
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Добавить
                </>
              )}
            </button>
          </div>

          <div className="flex gap-2 mt-2">
            <button className="flex-1 px-4 py-2 bg-muted/60 hover:bg-muted rounded-lg text-muted-foreground transition-colors flex items-center justify-center gap-2 text-sm">
              <Ban className="w-4 h-4" />
              Заблокировать
            </button>
            <button className="flex-1 px-4 py-2 bg-muted/60 hover:bg-muted rounded-lg text-muted-foreground transition-colors flex items-center justify-center gap-2 text-sm">
              <Flag className="w-4 h-4" />
              Пожаловаться
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default UserProfileModal
