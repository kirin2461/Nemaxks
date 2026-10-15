import { useState, useEffect, useRef } from 'react'
import { Layout } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { useStore } from '@/lib/store'
import { formatTime } from '@/lib/utils'
import { friendsAPI } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'

import {
  Users,
  UserPlus,
  Search,
  MessageSquare,
  Phone,
  Video,
  MoreVertical,
  Send,
  UserMinus,
  UserCheck,
  UserX,
  Ban,
  Paperclip,
  Gift,
  Clock,
  Flag
} from 'lucide-react'

import { useLocation } from 'wouter'
import { useNotifications } from '@/contexts/NotificationContext'
import { useToast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface Friend {
  id: string
  request_id?: number
  username: string
  alias?: string
  avatar?: string | null
  status?: string
  bio?: string
  created_at?: string
  isFriend?: boolean
  isPending?: boolean
  isOutgoing?: boolean
}

type TabType = 'all' | 'online' | 'pending' | 'blocked' | 'discover'

export default function FriendsPage() {
  const { user, isDemoMode } = useStore()
  const [, navigate] = useLocation()
  const { initiateCall } = useNotifications()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([])
  const [blockedUsers, setBlockedUsers] = useState<Friend[]>([])
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [addFriendInput, setAddFriendInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [searchResults, setSearchResults] = useState<Friend[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [allUsers, setAllUsers] = useState<any[]>([])
  
  void isLoading
  void searchResults
  void isSearching

  const friendContextMenu = useContextMenu()
  const toast = useToast()
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const loadFriends = async () => {
    setIsLoading(true)
    try {
      const friendsList = await friendsAPI.getFriends()
      if (!mountedRef.current) return
      setFriends((friendsList || []).filter((f: Friend) => f.isFriend))
      setPendingRequests((friendsList || []).filter((f: Friend) => f.isPending))
    } catch (error) {
      if (!mountedRef.current) return
      console.error('Failed to load friends:', error)
      setFriends([])
      setPendingRequests([])
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }

  const loadBlockedUsers = async () => {
    try {
      const blocked = await friendsAPI.getBlockedUsers()
      if (!mountedRef.current) return
      setBlockedUsers((blocked || []).map(b => ({
        id: String(b.user_id),
        username: b.username,
        avatar: b.avatar,
        created_at: b.created_at
      })))
    } catch (error) {
      if (!mountedRef.current) return
      console.error('Failed to load blocked users:', error)
      setBlockedUsers([])
    }
  }

  const loadAllUsers = async (signal?: AbortSignal) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/users/all', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      })
      if (!mountedRef.current) return
      if (response.ok) {
        const users = await response.json()
        if (!mountedRef.current) return
        setAllUsers(users || [])
      } else {
        setAllUsers([])
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || !mountedRef.current) return
      console.error('Failed to load all users:', error)
      setAllUsers([])
    }
  }

  useEffect(() => {
    if (!isDemoMode) {
      const controller = new AbortController()
      loadFriends()
      loadAllUsers(controller.signal)
      loadBlockedUsers()
      return () => controller.abort()
    }
  }, [isDemoMode])

  const handleSearchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const users = await friendsAPI.searchUsers(query)
      setSearchResults((users || []).filter((u: any) => String(u.id) !== String(user?.id)).map(u => ({
        id: String(u.id),
        username: u.username,
        avatar: u.avatar,
        bio: u.bio
      })))
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (addFriendInput.length >= 2) {
        handleSearchUsers(addFriendInput)
      } else {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [addFriendInput])

  const handleSendMessage = (friendId: string) => {
    navigate(`/messages?user=${friendId}`)
  }

  const handleSendFriendRequest = async (username: string) => {
    try {
      await friendsAPI.sendFriendRequest(username)
      setAddFriendInput('')
      setShowAddFriend(false)
      setSearchResults([])
      // Reload friends and pending to show the request
      loadFriends()
      toast.success('Запрос в друзья отправлен!')
    } catch (error: any) {
      console.error('Failed to send friend request:', error)
      toast.error('Не удалось отправить запрос', error?.data?.error)
    }
  }

  const handleVoiceCall = (friendId: string) => {
    const friend = friends.find(f => f.id === friendId)
    if (friend) {
      initiateCall(friendId, friend.username)
    } else {
      navigate(`/video?user=${friendId}&mode=voice`)
    }
  }

  const handleVideoCall = (friendId: string) => {
    const friend = friends.find(f => f.id === friendId)
    if (friend) {
      initiateCall(friendId, friend.username)
    } else {
      navigate(`/video?user=${friendId}&mode=video`)
    }
  }

  const handleSendFile = (friendId: string) => {
    navigate(`/messages?user=${friendId}&action=file`)
  }

  const handleSendGift = (friendId: string) => {
    navigate(`/messages?user=${friendId}&action=gift`)
  }

  const handleReportUser = async (friendId: string, username: string) => {
    const reason = prompt(`Причина жалобы на пользователя ${username}:`)
    if (reason && reason.trim()) {
      try {
        const token = localStorage.getItem('token')
        await fetch('/api/reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            reported_user_id: Number(friendId),
            reason: reason.trim()
          })
        })
        toast.success('Жалоба отправлена. Спасибо!')
      } catch (error) {
        console.error('Failed to report user:', error)
        toast.error('Не удалось отправить жалобу')
      }
    }
  }

  const handleRemoveFriend = (friendId: string) => {
    setConfirmAction({
      title: 'Удаление друга',
      message: 'Удалить друга?',
      onConfirm: async () => {
        try {
          await friendsAPI.removeFriend(friendId)
          setFriends(friends.filter(f => f.id !== friendId))
          toast.success('Друг удалён')
        } catch (error) {
          console.error('Failed to remove friend:', error)
          toast.error('Не удалось удалить друга')
        }
      }
    })
  }

  const handleBlockUser = (friendId: string) => {
    setConfirmAction({
      title: 'Блокировка пользователя',
      message: 'Заблокировать пользователя?',
      onConfirm: async () => {
        try {
          await friendsAPI.blockUser(Number(friendId))
          const friend = friends.find(f => f.id === friendId)
          if (friend) {
            setFriends(friends.filter(f => f.id !== friendId))
            setBlockedUsers([...blockedUsers, friend])
          }
          loadBlockedUsers()
          toast.success('Пользователь заблокирован')
        } catch (error) {
          console.error('Failed to block user:', error)
          toast.error('Не удалось заблокировать пользователя')
        }
      }
    })
  }

  const handleUnblockUser = async (userId: string) => {
    try {
      await friendsAPI.unblockUser(Number(userId))
      setBlockedUsers(blockedUsers.filter(u => u.id !== userId))
    } catch (error) {
      console.error('Failed to unblock user:', error)
    }
  }

  const handleAcceptRequest = async (request: Friend) => {
    if (!request.request_id) return
    try {
      await friendsAPI.respondToFriendRequest(String(request.request_id), 'accept')
      setPendingRequests(pendingRequests.filter(r => r.request_id !== request.request_id))
      setFriends([...friends, { ...request, isFriend: true, isPending: false }])
    } catch (error) {
      console.error('Failed to accept request:', error)
      toast.error('Не удалось принять запрос')
    }
  }

  const handleDeclineRequest = async (request: Friend) => {
    if (!request.request_id) return
    try {
      await friendsAPI.respondToFriendRequest(String(request.request_id), 'decline')
      setPendingRequests(pendingRequests.filter(r => r.request_id !== request.request_id))
    } catch (error) {
      console.error('Failed to decline request:', error)
      toast.error('Не удалось отклонить запрос')
    }
  }

  const handleCancelRequest = async (request: Friend) => {
    if (!request.request_id) return
    try {
      await friendsAPI.cancelFriendRequest(String(request.request_id))
      setPendingRequests(pendingRequests.filter(r => r.request_id !== request.request_id))
    } catch (error) {
      console.error('Failed to cancel friend request:', error)
      toast.error('Не удалось отменить запрос')
    }
  }

  const handleAddFriend = () => {
    if (!addFriendInput.trim()) return
    handleSendFriendRequest(addFriendInput)
  }

  // Context menu items
  const getFriendContextMenuItems = (friend: any): ContextMenuItem[] => {
    return [
      {
        label: t('friends.sendMessage'),
        icon: <MessageSquare className="w-4 h-4" />,
        onClick: () => handleSendMessage(friend.id),
      },
      {
        label: t('friends.voiceCall'),
        icon: <Phone className="w-4 h-4" />,
        onClick: () => handleVoiceCall(friend.id),
      },
      {
        label: t('friends.videoCall'),
        icon: <Video className="w-4 h-4" />,
        onClick: () => handleVideoCall(friend.id),
      },
      { divider: true } as ContextMenuItem,
      {
        label: t('friends.sendFile'),
        icon: <Paperclip className="w-4 h-4" />,
        onClick: () => handleSendFile(friend.id),
      },
      {
        label: t('friends.sendGift'),
        icon: <Gift className="w-4 h-4" />,
        onClick: () => handleSendGift(friend.id),
      },
      { divider: true } as ContextMenuItem,
      {
        label: t('friends.remove'),
        icon: <UserMinus className="w-4 h-4" />,
        onClick: () => handleRemoveFriend(friend.id),
        variant: 'danger' as const,
      },
      {
        label: t('friends.block'),
        icon: <Ban className="w-4 h-4" />,
        onClick: () => handleBlockUser(friend.id),
        variant: 'danger' as const,
      },
      {
        label: t('friends.report'),
        icon: <Flag className="w-4 h-4" />,
        onClick: () => handleReportUser(friend.id, friend.username),
        variant: 'danger' as const,
      },
    ]
  }

  // Filter friends based on tab
  const filteredFriends = friends.filter(f => {
    const matchesSearch = f.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         f.alias?.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (activeTab === 'online') return f.status === 'online'
    return true
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-online'
      case 'away': return 'bg-idle'
      case 'busy': return 'bg-dnd'
      default: return 'bg-offline'
    }
  }

  return (
    <Layout>
      <div className="h-screen flex flex-col animate-rise-in">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-border bg-card sticky top-0 z-10 shrink-0">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between gap-3 mb-4 md:mb-6">
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-display font-bold tracking-[-0.015em] text-graphite-900 mb-1 md:mb-2">{t('friends.title')}</h1>
                <p className="text-sm md:text-base text-muted-foreground hidden sm:block">{t('friends.manageConnections')}</p>
              </div>
              <button
                onClick={() => setShowAddFriend(!showAddFriend)}
                className="bg-primary text-primary-foreground rounded-lg font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 px-3 md:px-6 py-2 md:py-3 flex items-center gap-2 shrink-0"
              >
                <UserPlus className="w-5 h-5" />
                <span className="hidden sm:inline">{t('friends.addFriend')}</span>
              </button>
            </div>

            {/* Add Friend Form */}
            {showAddFriend && (
              <div className="mb-6 p-4 rounded-xl border border-border bg-card shadow-soft animate-rise-in">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={addFriendInput}
                    onChange={(e) => setAddFriendInput(e.target.value)}
                    placeholder={t('friends.addFriendPlaceholder')}
                    className="flex-1 input-field"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddFriend()
                    }}
                  />
                  <button
                    onClick={handleAddFriend}
                    disabled={!addFriendInput.trim()}
                    className="bg-primary text-primary-foreground rounded-lg font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 px-6 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('friends.sendRequestHint')}
                </p>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('friends.searchPlaceholder')}
                className="input-field px-12 py-3"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 md:px-6 border-b border-border bg-card overflow-x-auto hide-scrollbar">
          <div className="max-w-6xl mx-auto flex gap-6 min-w-max">
            {[
              { key: 'all', label: t('friends.all'), count: friends.length },
              { key: 'online', label: t('friends.online'), count: friends.filter(f => f.status === 'online').length },
              { key: 'pending', label: t('friends.pending'), count: pendingRequests.length },
              { key: 'discover', label: t('friends.discover'), count: allUsers.filter(u => u.friendship_status === 'none').length },
              { key: 'blocked', label: t('friends.blocked'), count: blockedUsers.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`pb-2.5 pt-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'text-foreground border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold grid place-items-center">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'all' || activeTab === 'online' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFriends.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <div className="h-20 w-20 mx-auto mb-4 rounded-2xl bg-secondary grid place-items-center animate-rise-in">
                      <Users className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                    </div>
                    <p className="text-lg font-semibold text-graphite-900">
                      {searchQuery ? t('friends.noFriendsFound') : t('friends.noFriends')}
                    </p>
                  </div>
                ) : (
                  filteredFriends.map((friend, index) => (
                    <div
                      key={friend.id}
                      className="rounded-xl border border-border bg-card shadow-soft p-4 hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 transition-all duration-150 animate-rise-in"
                      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                    >
                      {/* Friend Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="relative">
                          <Avatar
                            src={friend.avatar || undefined}
                            alt={friend.username}
                            userId={friend.id}
                            size="md"
                          />
                          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${getStatusColor(friend.status || 'offline')}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{friend.alias || friend.username}</h3>
                          <p className="text-sm text-muted-foreground truncate">@{friend.username}</p>
                        </div>

                        <button
                          onClick={(e) => friendContextMenu.showContextMenu(e, getFriendContextMenuItems(friend))}
                          className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Bio */}
                      {friend.bio && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{friend.bio}</p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendMessage(friend.id)}
                          className="flex-1 px-3 py-2 bg-accent hover:bg-emerald-100 text-accent-foreground rounded-lg transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.97]"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-sm font-medium">{t('friends.message')}</span>
                        </button>
                        <button
                          onClick={() => handleVoiceCall(friend.id)}
                          className="p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-all duration-150 active:scale-[0.97]"
                          title="Voice Call"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleVideoCall(friend.id)}
                          className="p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-all duration-150 active:scale-[0.97]"
                          title="Video Call"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Friend Since */}
                      {friend.created_at && (
                        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {t('friends.friendsSince')} {formatTime(friend.created_at)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : activeTab === 'pending' ? (
              <div className="space-y-4">
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="h-20 w-20 mx-auto mb-4 rounded-2xl bg-secondary grid place-items-center animate-rise-in">
                      <UserCheck className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                    </div>
                    <p className="text-lg font-semibold text-graphite-900">{t('friends.noPendingRequests')}</p>
                  </div>
                ) : (
                  pendingRequests.map((request, index) => (
                    <div
                      key={request.id}
                      className="rounded-xl border border-border bg-card shadow-soft p-4 flex items-center gap-4 animate-rise-in"
                      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                    >
                      <Avatar
                        src={request.avatar || undefined}
                        alt={request.username}
                        userId={request.id}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold">{request.alias || request.username}</h3>
                        <p className="text-sm text-muted-foreground">@{request.username}</p>
                        {request.bio && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">{request.bio}</p>
                        )}
                      </div>

                      {request.isOutgoing ? (
                        <button
                          type="button"
                          onClick={() => handleCancelRequest(request)}
                          className="px-4 py-2 border border-input bg-card text-destructive hover:bg-danger-soft rounded-lg transition-all duration-150 cursor-pointer relative z-10 active:scale-[0.97]"
                        >
                          {t('friends.cancel')}
                        </button>
                      ) : (
                        <div className="flex gap-2 shrink-0 relative z-10">
                          <button
                            type="button"
                            onClick={() => handleAcceptRequest(request)}
                            className="px-4 py-2 bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand rounded-lg transition-all duration-150 flex items-center gap-2 cursor-pointer select-none active:scale-[0.97]"
                          >
                            <UserCheck className="w-4 h-4" />
                            {t('friends.accept')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineRequest(request)}
                            className="px-4 py-2 border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 rounded-lg transition-all duration-150 flex items-center gap-2 cursor-pointer select-none active:scale-[0.97]"
                          >
                            <UserX className="w-4 h-4" />
                            {t('friends.decline')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : activeTab === 'discover' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allUsers.filter(u => u.id !== user?.id && !friends.some(f => f.id === String(u.id)) && !pendingRequests.some(p => p.id === String(u.id))).length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <div className="h-20 w-20 mx-auto mb-4 rounded-2xl bg-secondary grid place-items-center animate-rise-in">
                      <Users className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                    </div>
                    <p className="text-lg font-semibold text-graphite-900">{t('friends.noNewUsers')}</p>
                  </div>
                ) : (
                  allUsers.filter(u => u.id !== user?.id && !friends.some(f => f.id === String(u.id)) && !pendingRequests.some(p => p.id === String(u.id))).map((discoverUser, index) => (
                    <div
                      key={discoverUser.id}
                      className="rounded-xl border border-border bg-card shadow-soft p-4 animate-rise-in"
                      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <Avatar
                          src={discoverUser.avatar || undefined}
                          alt={discoverUser.username}
                          userId={String(discoverUser.id)}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{discoverUser.username}</h3>
                          <p className="text-sm text-muted-foreground truncate">@{discoverUser.username}</p>
                        </div>
                      </div>
                      {discoverUser.bio && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{discoverUser.bio}</p>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleSendFriendRequest(discoverUser.username)
                        }}
                        className="w-full px-4 py-2 border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 rounded-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97]"
                      >
                        <UserPlus className="w-4 h-4" />
                        {t('friends.addFriend')}
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {blockedUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="h-20 w-20 mx-auto mb-4 rounded-2xl bg-secondary grid place-items-center animate-rise-in">
                      <Ban className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                    </div>
                    <p className="text-lg font-semibold text-graphite-900">{t('friends.noBlockedUsers')}</p>
                  </div>
                ) : (
                  blockedUsers.map((blocked, index) => (
                    <div
                      key={blocked.id}
                      className="rounded-xl border border-border bg-card shadow-soft p-4 flex items-center gap-4 animate-rise-in"
                      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                    >
                      <Avatar
                        src={blocked.avatar || undefined}
                        alt={blocked.username}
                        userId={blocked.id}
                        size="md"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold">{blocked.alias || blocked.username}</h3>
                        <p className="text-sm text-muted-foreground">@{blocked.username}</p>
                      </div>

                      <button
                        onClick={() => handleUnblockUser(blocked.id)}
                        className="px-4 py-2 border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 rounded-lg transition-all duration-150 active:scale-[0.97]"
                      >
                        {t('friends.unblock')}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        items={friendContextMenu.contextMenu.items}
        position={friendContextMenu.contextMenu.position}
        visible={friendContextMenu.contextMenu.visible}
        onClose={friendContextMenu.hideContextMenu}
      />

      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          confirmAction?.onConfirm()
          setConfirmAction(null)
        }}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        variant="danger"
      />
    </Layout>
  )
}
