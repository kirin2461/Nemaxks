import { useState, useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { useStore } from '@/lib/store'
import { formatTime } from '@/lib/utils'
import { friendsAPI } from '@/lib/api'

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

  const loadFriends = async () => {
    setIsLoading(true)
    try {
      const friendsList = await friendsAPI.getFriends()
      setFriends((friendsList || []).filter((f: Friend) => f.isFriend))
      setPendingRequests((friendsList || []).filter((f: Friend) => f.isPending))
    } catch (error) {
      console.error('Failed to load friends:', error)
      setFriends([])
      setPendingRequests([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadBlockedUsers = async () => {
    try {
      const blocked = await friendsAPI.getBlockedUsers()
      setBlockedUsers((blocked || []).map(b => ({
        id: String(b.user_id),
        username: b.username,
        avatar: b.avatar,
        created_at: b.created_at
      })))
    } catch (error) {
      console.error('Failed to load blocked users:', error)
      setBlockedUsers([])
    }
  }

  const loadAllUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/users/all', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const users = await response.json()
        setAllUsers(users || [])
      } else {
        setAllUsers([])
      }
    } catch (error) {
      console.error('Failed to load all users:', error)
      setAllUsers([])
    }
  }

  useEffect(() => {
    if (!isDemoMode) {
      loadFriends()
      loadAllUsers()
      loadBlockedUsers()
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
      alert('Запрос в друзья отправлен!')
    } catch (error: any) {
      console.error('Failed to send friend request:', error)
      alert(error?.data?.error || 'Не удалось отправить запрос')
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
        alert('Жалоба отправлена. Спасибо!')
      } catch (error) {
        console.error('Failed to report user:', error)
        alert('Не удалось отправить жалобу')
      }
    }
  }

  const handleRemoveFriend = async (friendId: string) => {
    if (confirm('Удалить друга?')) {
      try {
        await friendsAPI.removeFriend(friendId)
        setFriends(friends.filter(f => f.id !== friendId))
      } catch (error) {
        console.error('Failed to remove friend:', error)
      }
    }
  }

  const handleBlockUser = async (friendId: string) => {
    if (confirm('Заблокировать пользователя?')) {
      try {
        await friendsAPI.blockUser(Number(friendId))
        const friend = friends.find(f => f.id === friendId)
        if (friend) {
          setFriends(friends.filter(f => f.id !== friendId))
          setBlockedUsers([...blockedUsers, friend])
        }
        loadBlockedUsers()
      } catch (error) {
        console.error('Failed to block user:', error)
      }
    }
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
      alert('Не удалось принять запрос')
    }
  }

  const handleDeclineRequest = async (request: Friend) => {
    if (!request.request_id) return
    try {
      await friendsAPI.respondToFriendRequest(String(request.request_id), 'decline')
      setPendingRequests(pendingRequests.filter(r => r.request_id !== request.request_id))
    } catch (error) {
      console.error('Failed to decline request:', error)
      alert('Не удалось отклонить запрос')
    }
  }

  const handleCancelRequest = async (request: Friend) => {
    if (!request.request_id) return
    try {
      await friendsAPI.cancelFriendRequest(String(request.request_id))
      setPendingRequests(pendingRequests.filter(r => r.request_id !== request.request_id))
    } catch (error) {
      console.error('Failed to cancel friend request:', error)
      alert('Не удалось отменить запрос')
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
        label: 'Send Message',
        icon: <MessageSquare className="w-4 h-4" />,
        onClick: () => handleSendMessage(friend.id),
      },
      {
        label: 'Voice Call',
        icon: <Phone className="w-4 h-4" />,
        onClick: () => handleVoiceCall(friend.id),
      },
      {
        label: 'Video Call',
        icon: <Video className="w-4 h-4" />,
        onClick: () => handleVideoCall(friend.id),
      },
      { divider: true } as ContextMenuItem,
      {
        label: 'Send File',
        icon: <Paperclip className="w-4 h-4" />,
        onClick: () => handleSendFile(friend.id),
      },
      {
        label: 'Send Gift',
        icon: <Gift className="w-4 h-4" />,
        onClick: () => handleSendGift(friend.id),
      },
      { divider: true } as ContextMenuItem,
      {
        label: 'Remove Friend',
        icon: <UserMinus className="w-4 h-4" />,
        onClick: () => handleRemoveFriend(friend.id),
        variant: 'danger' as const,
      },
      {
        label: 'Block User',
        icon: <Ban className="w-4 h-4" />,
        onClick: () => handleBlockUser(friend.id),
        variant: 'danger' as const,
      },
      {
        label: 'Report User',
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
      case 'online': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      case 'busy': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <Layout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold gradient-text mb-2">Friends</h1>
                <p className="text-muted-foreground">Manage your friends and connections</p>
              </div>
              <button
                onClick={() => setShowAddFriend(!showAddFriend)}
                className="btn-cosmic px-6 py-3 flex items-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Add Friend
              </button>
            </div>

            {/* Add Friend Form */}
            {showAddFriend && (
              <div className="mb-6 p-4 bg-accent/10 border border-border rounded-lg animate-slide-in">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={addFriendInput}
                    onChange={(e) => setAddFriendInput(e.target.value)}
                    placeholder="Enter username or email..."
                    className="flex-1 input-cosmic"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddFriend()
                    }}
                  />
                  <button
                    onClick={handleAddFriend}
                    disabled={!addFriendInput.trim()}
                    className="btn-cosmic px-6"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Send a friend request by entering their username or email address
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
                placeholder="Search friends..."
                className="w-full px-12 py-3 bg-background border border-border rounded-lg
                          text-foreground placeholder:text-muted-foreground
                          focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                          transition-all duration-300"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-border bg-card/30 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto flex gap-2">
            {[
              { key: 'all', label: 'All Friends', count: friends.length },
              { key: 'online', label: 'Online', count: friends.filter(f => f.status === 'online').length },
              { key: 'pending', label: 'Pending', count: pendingRequests.length },
              { key: 'discover', label: 'Discover', count: allUsers.filter(u => u.friendship_status === 'none').length },
              { key: 'blocked', label: 'Blocked', count: blockedUsers.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`px-4 py-2 rounded-lg transition-all duration-300 flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/10 text-muted-foreground'
                }`}
              >
                <span className="font-medium">{tab.label}</span>
                {tab.count > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'all' || activeTab === 'online' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFriends.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full gradient-aurora-animated flex items-center justify-center orb-glow">
                      <Users className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-muted-foreground">
                      {searchQuery ? 'No friends found' : 'No friends yet. Start by adding some!'}
                    </p>
                  </div>
                ) : (
                  filteredFriends.map((friend, index) => (
                    <div
                      key={friend.id}
                      className="card-cosmic p-4 hover:scale-[1.02] transition-all duration-300 animate-slide-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
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
                          className="p-1 hover:bg-accent/20 rounded transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-muted-foreground" />
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
                          className="flex-1 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-sm font-medium">Message</span>
                        </button>
                        <button
                          onClick={() => handleVoiceCall(friend.id)}
                          className="p-2 bg-accent/10 hover:bg-accent/20 rounded-lg transition-all"
                          title="Voice Call"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleVideoCall(friend.id)}
                          className="p-2 bg-accent/10 hover:bg-accent/20 rounded-lg transition-all"
                          title="Video Call"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Friend Since */}
                      {friend.created_at && (
                        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          Friends since {formatTime(friend.created_at)}
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
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full gradient-aurora-animated flex items-center justify-center orb-glow">
                      <UserCheck className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-muted-foreground">No pending friend requests</p>
                  </div>
                ) : (
                  pendingRequests.map((request, index) => (
                    <div
                      key={request.id}
                      className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 animate-slide-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
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
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all cursor-pointer relative z-10"
                        >
                          Отменить
                        </button>
                      ) : (
                        <div className="flex gap-2 shrink-0 relative z-10">
                          <button
                            type="button"
                            onClick={() => handleAcceptRequest(request)}
                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all flex items-center gap-2 cursor-pointer select-none"
                          >
                            <UserCheck className="w-4 h-4" />
                            Принять
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineRequest(request)}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all flex items-center gap-2 cursor-pointer select-none"
                          >
                            <UserX className="w-4 h-4" />
                            Отклонить
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
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full gradient-aurora-animated flex items-center justify-center orb-glow">
                      <Users className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-muted-foreground">Нет новых пользователей</p>
                  </div>
                ) : (
                  allUsers.filter(u => u.id !== user?.id && !friends.some(f => f.id === String(u.id)) && !pendingRequests.some(p => p.id === String(u.id))).map((discoverUser, index) => (
                    <div
                      key={discoverUser.id}
                      className="card-cosmic p-4 animate-slide-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
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
                        className="w-full px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        Добавить в друзья
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {blockedUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full gradient-aurora-animated flex items-center justify-center orb-glow">
                      <Ban className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-muted-foreground">No blocked users</p>
                  </div>
                ) : (
                  blockedUsers.map((blocked, index) => (
                    <div
                      key={blocked.id}
                      className="card-cosmic p-4 flex items-center gap-4 animate-slide-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
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
                        className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all"
                      >
                        Unblock
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
    </Layout>
  )
}
