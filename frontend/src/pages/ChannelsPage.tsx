import { useState, useEffect, useCallback, useRef } from 'react'
import { Layout } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { cn } from '@/lib/utils'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { VoiceChannel } from '@/components/VoiceChannel'
import { VoiceStatusBar } from '@/components/VoiceStatusBar'
import { CreateChannelModal } from '@/components/CreateChannelModal'
import { InviteModal } from '@/components/InviteModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useStore } from '@/lib/store'
import { useNotifications } from '@/contexts/NotificationContext'
import { useVoice } from '@/contexts/VoiceContext'
import { guildsAPI, channelsAPI, presenceAPI, messagesAPI } from '@/lib/api'
import { formatTime } from '@/lib/utils'
import {
  Hash,
  Volume2,
  Users,
  Settings,
  Plus,
  Search,
  Send,
  Bell,
  BellOff,
  LogOut,
  UserPlus,
  Edit3,
  Trash2,
  Pin,
  Copy,
  MoreVertical,
  Lock,
  Globe,
  Reply,
  Smile,
  ChevronDown,
  ChevronRight,
  X,
  Shield,
  Crown,
  AtSign,
  Eye,
  MessageSquare,
  Mic,
  MicOff,
  Video,
  Circle
} from 'lucide-react'

type Guild = {
  id: string
  name: string
  icon: string | null
  owner_id: number
  channels: Array<{ id: string; name: string; type: string; category: string }>
}

type MessageReaction = {
  emoji: string
  count: number
  users: string[]
}

type ChannelMessage = {
  id: string
  channel_id: string
  author_id: string
  author: { id: string; username: string; avatar: string | undefined }
  content: string
  created_at: string
  reactions?: MessageReaction[]
}

export default function ChannelsPage() {
  const { user } = useStore()
  const { subscribeToMessages } = useNotifications()
  const { state: voiceState, voiceChannelUsers, joinChannel: joinVoiceChannel, leaveChannel: leaveVoiceChannel } = useVoice()
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<{ id: string; name: string; type: string; category: string } | null>(null)
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [members, setMembers] = useState<Array<{ id: string; username: string; role: string; status: string; avatar: string | null }>>([])
  const [roles, setRoles] = useState<Array<{ id: string; name: string; color: string; permissions: string[] }>>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const [showMembersPanel, setShowMembersPanel] = useState(true)
  const [showChannelSettings, setShowChannelSettings] = useState(false)
  const [showRolesModal, setShowRolesModal] = useState(false)
  const [showCreateServerModal, setShowCreateServerModal] = useState(false)
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteGuildId, setInviteGuildId] = useState<string | null>(null)
  const [newServerName, setNewServerName] = useState('')
  const [channelName, setChannelName] = useState('')
  const [channelDescription, setChannelDescription] = useState('')
  const [slowMode, setSlowMode] = useState('off')
  const [isNsfw, setIsNsfw] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [roleName, setRoleName] = useState('')
  const [roleColor, setRoleColor] = useState('#3b82f6')
  const [rolePermissions, setRolePermissions] = useState<string[]>([])
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    variant?: 'danger' | 'warning' | 'info'
    confirmText?: string
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} })
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [typingUsers, setTypingUsers] = useState<Map<string, { username: string; timestamp: number }>>(new Map())
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set())
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingSentRef = useRef<number>(0)
  
  void leaveVoiceChannel

  void Search
  void Bell
  void Lock
  void Globe
  void AtSign
  void Eye
  void MessageSquare
  void Mic
  void Video
  void setRoles
  void loading
  void Circle

  const handleWebSocketMessage = useCallback((data: any) => {
    if (data.type === 'channel-message') {
      const channelId = String(data.channel_id)
      const msg = data.message
      
      if (selectedChannel && channelId === String(selectedChannel.id)) {
        setMessages(prev => {
          if (prev.some(m => String(m.id) === String(msg.id || msg.ID))) return prev
          return [...prev, {
            id: String(msg.id || msg.ID),
            channel_id: String(msg.channel_id || msg.ChannelID),
            author_id: String(msg.author_id || msg.AuthorID),
            author: msg.author || msg.Author || { id: String(msg.author_id || msg.AuthorID), username: 'User', avatar: undefined },
            content: msg.content || msg.Content,
            created_at: msg.created_at || msg.CreatedAt
          }]
        })
      } else {
        setUnreadChannels(prev => new Set(prev).add(channelId))
      }
    }
    
    if (data.type === 'typing' && selectedChannel && String(data.channel_id) === String(selectedChannel.id)) {
      const userId = String(data.user_id)
      const username = data.username || 'Someone'
      if (userId !== String(user?.id)) {
        setTypingUsers(prev => {
          const newMap = new Map(prev)
          newMap.set(userId, { username, timestamp: Date.now() })
          return newMap
        })
      }
    }

    if (data.type === 'reaction_add' || data.type === 'reaction-add') {
      const messageId = String(data.message_id)
      const emoji = data.emoji
      const reactUserId = String(data.user_id)
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m
        const reactions = m.reactions || []
        const existingReaction = reactions.find(r => r.emoji === emoji)
        if (existingReaction) {
          if (!existingReaction.users.includes(reactUserId)) {
            return {
              ...m,
              reactions: reactions.map(r =>
                r.emoji === emoji
                  ? { ...r, count: r.count + 1, users: [...r.users, reactUserId] }
                  : r
              )
            }
          }
          return m
        }
        return {
          ...m,
          reactions: [...reactions, { emoji, count: 1, users: [reactUserId] }]
        }
      }))
    }

    if (data.type === 'reaction_remove' || data.type === 'reaction-remove') {
      const messageId = String(data.message_id)
      const emoji = data.emoji
      const reactUserId = String(data.user_id)
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m
        const reactions = m.reactions || []
        return {
          ...m,
          reactions: reactions
            .map(r =>
              r.emoji === emoji
                ? { ...r, count: r.count - 1, users: r.users.filter(u => u !== reactUserId) }
                : r
            )
            .filter(r => r.count > 0)
        }
      }))
    }
  }, [selectedChannel, user?.id])

  useEffect(() => {
    const unsubscribe = subscribeToMessages(handleWebSocketMessage)
    return unsubscribe
  }, [subscribeToMessages, handleWebSocketMessage])

  useEffect(() => {
    if (selectedChannel && selectedChannel.type !== 'voice') {
      loadChannelMessages(selectedChannel.id)
      setUnreadChannels(prev => {
        const newSet = new Set(prev)
        newSet.delete(selectedChannel.id)
        return newSet
      })
    } else {
      setMessages([])
    }
    setTypingUsers(new Map())
  }, [selectedChannel])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setTypingUsers(prev => {
        const newMap = new Map()
        prev.forEach((value, key) => {
          if (now - value.timestamp < 3000) {
            newMap.set(key, value)
          }
        })
        return newMap.size !== prev.size ? newMap : prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  const sendTypingIndicator = useCallback(() => {
    if (!selectedChannel || selectedChannel.type === 'voice') return
    const now = Date.now()
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now
      presenceAPI.sendTyping(selectedChannel.id).catch(() => {})
    }
  }, [selectedChannel])

  const loadChannelMessages = async (channelId: string) => {
    try {
      const msgs = await channelsAPI.getMessages(channelId)
      if (msgs) {
        setMessages(msgs.map((m: any) => ({
          id: String(m.id || m.ID),
          channel_id: String(m.channel_id || m.ChannelID),
          author_id: String(m.author_id || m.AuthorID),
          author: m.author || m.Author || { id: String(m.author_id || m.AuthorID), username: 'User', avatar: undefined },
          content: m.content || m.Content,
          created_at: m.created_at || m.CreatedAt,
          reactions: m.reactions || m.Reactions || []
        })))
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  useEffect(() => {
    loadGuilds()
    loadMembers()
  }, [])

  const loadMembers = async () => {
    try {
      const usersData = await guildsAPI.getMembers()
      if (usersData && usersData.length > 0) {
        const membersList = usersData.map((u: any) => ({
          id: String(u.id),
          username: u.username || u.alias || 'User',
          role: u.role || 'member',
          status: u.is_online ? 'online' : 'offline',
          avatar: u.avatar || null
        }))
        setMembers(membersList)
      }
    } catch (error) {
      console.error('Failed to load members:', error)
    }
  }

  const loadGuilds = async () => {
    setLoading(true)
    try {
      const guildsData = await guildsAPI.getGuilds()
      if (guildsData && guildsData.length > 0) {
        const guildsWithChannels = await Promise.all(
          guildsData.map(async (g: any) => {
            const channels = await channelsAPI.getChannels(String(g.id))
            return {
              id: String(g.id),
              name: g.name,
              icon: g.icon,
              owner_id: g.owner_id,
              channels: (channels || []).map((c: any) => ({
                id: String(c.id),
                name: c.name,
                type: c.type || 'text',
                category: c.category || 'Общее'
              }))
            }
          })
        )
        setGuilds(guildsWithChannels)
        if (guildsWithChannels.length > 0) {
          setSelectedGuild(guildsWithChannels[0])
          if (guildsWithChannels[0].channels.length > 0) {
            setSelectedChannel(guildsWithChannels[0].channels[0])
          }
        }
      }
    } catch (error) {
      console.error('Failed to load guilds:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateServer = async () => {
    if (!newServerName.trim()) return
    try {
      const newGuild = await guildsAPI.createGuild(newServerName.trim())
      if (newGuild) {
        const channels = await channelsAPI.getChannels(String(newGuild.id))
        const guildWithChannels = {
          id: String(newGuild.id),
          name: newGuild.name,
          icon: null,
          owner_id: newGuild.owner_id,
          channels: (channels || []).map((c: any) => ({
            id: String(c.id),
            name: c.name,
            type: c.type || 'text',
            category: c.category || 'Общее'
          }))
        }
        setGuilds([...guilds, guildWithChannels])
        setSelectedGuild(guildWithChannels)
        if (guildWithChannels.channels.length > 0) {
          setSelectedChannel(guildWithChannels.channels[0])
        }
        setNewServerName('')
        setShowCreateServerModal(false)
      }
    } catch (error) {
      console.error('Failed to create server:', error)
    }
  }

  const handleCreateChannel = async (channelData: { name: string; type: 'text' | 'voice'; isPrivate: boolean }) => {
    if (!selectedGuild) return
    try {
      const newChannel = await channelsAPI.createChannel(
        selectedGuild.id,
        channelData.name,
        channelData.type
      )
      if (newChannel) {
        const updatedGuild = {
          ...selectedGuild,
          channels: [...selectedGuild.channels, {
            id: String(newChannel.id),
            name: newChannel.name,
            type: newChannel.type || channelData.type,
            category: 'General'
          }]
        }
        setGuilds(guilds.map(g => g.id === selectedGuild.id ? updatedGuild : g))
        setSelectedGuild(updatedGuild)
        setSelectedChannel({
          id: String(newChannel.id),
          name: newChannel.name,
          type: newChannel.type || channelData.type,
          category: 'General'
        })
      }
    } catch (error) {
      console.error('Failed to create channel:', error)
    }
  }

  // Context menu hooks
  const channelContextMenu = useContextMenu()
  const messageContextMenu = useContextMenu()
  const guildContextMenu = useContextMenu()

  // Channel actions
  const handleEditChannel = (channel: any) => {
    console.log('Edit channel:', channel)
  }

  const handleDeleteChannel = (channelId: string, channelName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Удалить канал',
      message: `Вы уверены, что хотите удалить канал "${channelName}"? Все сообщения в канале будут удалены безвозвратно.`,
      confirmText: 'Удалить',
      variant: 'danger',
      onConfirm: async () => {
        setDeleteLoading(true)
        try {
          await channelsAPI.deleteChannel(channelId)
          if (selectedGuild) {
            const updatedGuild = {
              ...selectedGuild,
              channels: selectedGuild.channels.filter(c => c.id !== channelId)
            }
            setGuilds(guilds.map(g => g.id === selectedGuild.id ? updatedGuild : g))
            setSelectedGuild(updatedGuild)
            if (selectedChannel?.id === channelId) {
              setSelectedChannel(null)
            }
          }
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Failed to delete channel:', error)
        } finally {
          setDeleteLoading(false)
        }
      }
    })
  }

  const handleInviteToChannel = (channelId: string) => {
    console.log('Invite to channel:', channelId)
  }

  const handleMuteChannel = (channelId: string) => {
    console.log('Mute channel:', channelId)
  }

  const handleLeaveChannel = (channelId: string, channelName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Покинуть канал',
      message: `Вы уверены, что хотите покинуть канал "${channelName}"?`,
      confirmText: 'Покинуть',
      variant: 'warning',
      onConfirm: () => {
        console.log('Leave channel:', channelId)
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  // Message actions
  const handleReplyToMessage = (message: any) => {
    setReplyingTo(message)
  }

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleDeleteMessage = (messageId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Удалить сообщение',
      message: 'Вы уверены, что хотите удалить это сообщение?',
      confirmText: 'Удалить',
      variant: 'danger',
      onConfirm: async () => {
        setDeleteLoading(true)
        try {
          await messagesAPI.deleteMessage(messageId)
          setMessages(prev => prev.filter(m => m.id !== messageId))
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Failed to delete message:', error)
        } finally {
          setDeleteLoading(false)
        }
      }
    })
  }

  const handleStartEditMessage = (message: ChannelMessage) => {
    setEditingMessageId(message.id)
    setEditingContent(message.content)
  }

  const handleCancelEditMessage = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const handleSaveEditMessage = async () => {
    if (!editingMessageId || !editingContent.trim()) return
    const msgId = editingMessageId
    const newContent = editingContent.trim()
    try {
      await messagesAPI.updateMessage(msgId, newContent)
      setMessages(prev => prev.map(m => 
        m.id === msgId 
          ? { ...m, content: newContent }
          : m
      ))
      setEditingMessageId(null)
      setEditingContent('')
    } catch (error) {
      console.error('Failed to update message:', error)
    }
  }

  const handlePinMessage = (messageId: string) => {
    console.log('Pin message:', messageId)
  }

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥']

  const handleAddReaction = async (messageId: string, emoji: string) => {
    try {
      await messagesAPI.addReaction(messageId, emoji)
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m
        const reactions = m.reactions || []
        const existingReaction = reactions.find(r => r.emoji === emoji)
        if (existingReaction) {
          if (!existingReaction.users.includes(user?.id?.toString() || '')) {
            return {
              ...m,
              reactions: reactions.map(r =>
                r.emoji === emoji
                  ? { ...r, count: r.count + 1, users: [...r.users, user?.id?.toString() || ''] }
                  : r
              )
            }
          }
          return m
        }
        return {
          ...m,
          reactions: [...reactions, { emoji, count: 1, users: [user?.id?.toString() || ''] }]
        }
      }))
      setShowReactionPicker(null)
    } catch (error) {
      console.error('Failed to add reaction:', error)
    }
  }

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    try {
      await messagesAPI.removeReaction(messageId, emoji)
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m
        const reactions = m.reactions || []
        return {
          ...m,
          reactions: reactions
            .map(r =>
              r.emoji === emoji
                ? { ...r, count: r.count - 1, users: r.users.filter(u => u !== user?.id?.toString()) }
                : r
            )
            .filter(r => r.count > 0)
        }
      }))
    } catch (error) {
      console.error('Failed to remove reaction:', error)
    }
  }

  // Guild actions
  const handleLeaveGuild = (guildId: string, guildName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Покинуть сервер',
      message: `Вы уверены, что хотите покинуть сервер "${guildName}"?`,
      confirmText: 'Покинуть',
      variant: 'warning',
      onConfirm: () => {
        console.log('Leave guild:', guildId)
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  const handleMuteGuild = (guildId: string) => {
    console.log('Mute guild:', guildId)
  }

  const handleGuildSettings = (guildId: string) => {
    console.log('Guild settings:', guildId)
  }

  const handleOpenChannelSettings = () => {
    if (selectedChannel) {
      setChannelName(selectedChannel.name)
      setChannelDescription('')
      setSlowMode('off')
      setIsNsfw(false)
      setShowChannelSettings(true)
    }
  }

  const handleSaveChannelSettings = async () => {
    if (selectedChannel && selectedGuild) {
      try {
        await channelsAPI.updateChannel(selectedChannel.id, { 
          name: channelName || selectedChannel.name 
        })
      } catch (err) {
        console.log('API update failed, using local state')
      }
      
      const updatedChannel = {
        ...selectedChannel,
        name: channelName || selectedChannel.name
      }
      const updatedGuild = {
        ...selectedGuild,
        channels: selectedGuild.channels.map(c => 
          c.id === selectedChannel.id ? updatedChannel : c
        )
      }
      setGuilds(guilds.map(g => g.id === selectedGuild.id ? updatedGuild : g))
      setSelectedGuild(updatedGuild)
      setSelectedChannel(updatedChannel)
      setShowChannelSettings(false)
      alert('Настройки канала сохранены!')
    }
  }

  const handleDeleteChannelFromSettings = () => {
    if (selectedChannel && selectedGuild) {
      setConfirmDialog({
        isOpen: true,
        title: 'Удалить канал',
        message: `Вы уверены, что хотите удалить канал "${selectedChannel.name}"? Все сообщения будут удалены безвозвратно.`,
        confirmText: 'Удалить',
        variant: 'danger',
        onConfirm: async () => {
          setDeleteLoading(true)
          try {
            await channelsAPI.deleteChannel(selectedChannel.id)
          } catch (err) {
            console.log('API delete failed, using local state')
          }
          
          const remainingChannels = selectedGuild.channels.filter(c => c.id !== selectedChannel.id)
          const updatedGuild = {
            ...selectedGuild,
            channels: remainingChannels
          }
          setGuilds(guilds.map(g => g.id === selectedGuild.id ? updatedGuild : g))
          setSelectedGuild(updatedGuild)
          setSelectedChannel(remainingChannels.length > 0 ? remainingChannels[0] : null)
          setShowChannelSettings(false)
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
          setDeleteLoading(false)
        }
      })
    }
  }

  const handleCreateRole = () => {
    const newRole = {
      id: `role_${Date.now()}`,
      name: 'Новая роль',
      color: '#3b82f6',
      permissions: []
    }
    setRoles([...roles, newRole])
    setSelectedRole(newRole.id)
    setRoleName(newRole.name)
    setRoleColor(newRole.color)
    setRolePermissions([])
  }

  const handleSelectRole = (roleId: string) => {
    const role = roles.find(r => r.id === roleId)
    if (role) {
      setSelectedRole(roleId)
      setRoleName(role.name)
      setRoleColor(role.color)
      setRolePermissions(role.permissions)
    }
  }

  const handleTogglePermission = (permission: string) => {
    if (rolePermissions.includes(permission)) {
      setRolePermissions(rolePermissions.filter(p => p !== permission))
    } else {
      setRolePermissions([...rolePermissions, permission])
    }
  }

  const handleSaveRole = () => {
    if (selectedRole) {
      setRoles(roles.map(r => 
        r.id === selectedRole 
          ? { ...r, name: roleName, color: roleColor, permissions: rolePermissions }
          : r
      ))
      alert('Роль сохранена!')
    }
    setShowRolesModal(false)
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel) return
    
    const content = newMessage.trim()
    setNewMessage('')
    setReplyingTo(null)

    try {
      await channelsAPI.sendMessage(selectedChannel.id, content)
    } catch (error) {
      console.error('Failed to send message:', error)
      setNewMessage(content)
    }
  }

  // Context menu items
  const getChannelContextMenuItems = (channel: any): ContextMenuItem[] => {
    const isGuildOwner = selectedGuild && user && String(selectedGuild.owner_id) === String(user.id)
    
    const items: ContextMenuItem[] = [
      {
        label: 'Mute Channel',
        icon: <BellOff className="w-4 h-4" />,
        onClick: () => handleMuteChannel(channel.id),
      },
      {
        label: 'Invite People',
        icon: <UserPlus className="w-4 h-4" />,
        onClick: () => handleInviteToChannel(channel.id),
      },
    ]
    
    if (isGuildOwner) {
      items.push({
        label: 'Edit Channel',
        icon: <Edit3 className="w-4 h-4" />,
        onClick: () => handleEditChannel(channel),
      })
    }
    
    items.push({ divider: true } as ContextMenuItem)
    items.push({
      label: 'Leave Channel',
      icon: <LogOut className="w-4 h-4" />,
      onClick: () => handleLeaveChannel(channel.id, channel.name),
      variant: 'danger' as const,
    })
    
    if (isGuildOwner) {
      items.push({
        label: 'Delete Channel',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => handleDeleteChannel(channel.id, channel.name),
        variant: 'danger' as const,
      })
    }
    
    return items
  }

  const getMessageContextMenuItems = (message: any): ContextMenuItem[] => {
    const isOwn = String(message.author_id) === String(user?.id)

    return [
      {
        label: 'Ответить',
        icon: <Reply className="w-4 h-4" />,
        onClick: () => handleReplyToMessage(message),
      },
      {
        label: 'Реакция',
        icon: <Smile className="w-4 h-4" />,
        onClick: () => setShowReactionPicker(message.id),
      },
      {
        label: 'Копировать',
        icon: <Copy className="w-4 h-4" />,
        onClick: () => handleCopyMessage(message.content),
      },
      {
        label: 'Закрепить',
        icon: <Pin className="w-4 h-4" />,
        onClick: () => handlePinMessage(message.id),
      },
      ...(isOwn ? [
        { divider: true } as ContextMenuItem,
        {
          label: 'Редактировать',
          icon: <Edit3 className="w-4 h-4" />,
          onClick: () => handleStartEditMessage(message),
        },
        {
          label: 'Удалить',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleDeleteMessage(message.id),
          variant: 'danger' as const,
        },
      ] : []),
    ]
  }

  const handleOpenInviteModal = (guildId: string) => {
    setInviteGuildId(guildId)
    setShowInviteModal(true)
  }

  const getGuildContextMenuItems = (guild: any): ContextMenuItem[] => {
    return [
      {
        label: 'Пригласить людей',
        icon: <UserPlus className="w-4 h-4" />,
        onClick: () => handleOpenInviteModal(guild.id),
      },
      {
        label: 'Настройки сервера',
        icon: <Settings className="w-4 h-4" />,
        onClick: () => handleGuildSettings(guild.id),
      },
      {
        label: 'Mute Server',
        icon: <BellOff className="w-4 h-4" />,
        onClick: () => handleMuteGuild(guild.id),
      },
      { divider: true } as ContextMenuItem,
      {
        label: 'Leave Server',
        icon: <LogOut className="w-4 h-4" />,
        onClick: () => handleLeaveGuild(guild.id, guild.name),
        variant: 'danger' as const,
      },
    ]
  }

  // Group channels by category
  const channelsByCategory = selectedGuild?.channels.reduce((acc, channel) => {
    const category = channel.category || 'Uncategorized'
    if (!acc[category]) acc[category] = []
    acc[category].push(channel)
    return acc
  }, {} as Record<string, any[]>) || {}

  const filteredMessages = messages.filter(m => m.channel_id === selectedChannel?.id)

  if (!selectedGuild || !selectedChannel) {
    return (
      <Layout>
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <Hash className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Нет доступных каналов</h2>
            <p className="text-muted-foreground">Создайте или присоединитесь к серверу</p>
            <button 
              onClick={() => setShowCreateServerModal(true)}
              className="mt-4 px-6 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto"
            >
              <Plus className="w-5 h-5" />
              Создать сервер
            </button>
          </div>
        </div>

        {/* Create Server Modal */}
        {showCreateServerModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-card rounded-2xl w-full max-w-md mx-4 shadow-2xl border border-border overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Plus className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-xl font-bold mb-2">Создать сервер</h2>
                <p className="text-muted-foreground text-sm">Создайте свой сервер и пригласите друзей</p>
              </div>
              <div className="px-6 pb-4">
                <label className="text-sm font-medium text-muted-foreground">Название сервера</label>
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="Мой сервер"
                  className="w-full mt-1 px-4 py-3 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <button 
                  onClick={() => {
                    setShowCreateServerModal(false)
                    setNewServerName('')
                  }}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleCreateServer}
                  disabled={!newServerName.trim()}
                  className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  Создать
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="h-full lg:h-screen flex flex-col lg:flex-row">
        {/* Guild Sidebar */}
        <div className="hidden lg:flex w-20 bg-card border-r border-border flex-col items-center gap-2 py-3 shrink-0">
          {guilds.map((guild) => (
            <button
              key={guild.id}
              onClick={() => {
                setSelectedGuild(guild)
                if (guild.channels.length > 0) {
                  setSelectedChannel(guild.channels[0])
                }
              }}
              onContextMenu={(e) => guildContextMenu.showContextMenu(e, getGuildContextMenuItems(guild))}
              className={`w-12 h-12 rounded-2xl transition-all duration-300 flex items-center justify-center
                         hover:rounded-xl group relative ${
                selectedGuild?.id === guild.id
                  ? 'bg-gradient-to-br from-primary to-accent rounded-xl'
                  : 'bg-muted hover:bg-accent'
              }`}
            >
              {guild.icon ? (
                <img src={guild.icon} alt={guild.name} className="w-full h-full rounded-2xl group-hover:rounded-xl" />
              ) : (
                <span className="text-lg font-bold">
                  {guild.name.slice(0, 2).toUpperCase()}
                </span>
              )}

              {/* Active indicator */}
              {selectedGuild?.id === guild.id && (
                <div className="absolute -left-2 w-1 h-8 bg-foreground rounded-r-full" />
              )}
            </button>
          ))}

          {/* Add server button */}
          <button 
            onClick={() => setShowCreateServerModal(true)}
            className="w-12 h-12 rounded-2xl bg-muted hover:bg-green-500/20 hover:rounded-xl transition-all duration-300 flex items-center justify-center group"
          >
            <Plus className="w-6 h-6 text-muted-foreground group-hover:text-green-500" />
          </button>
        </div>

        {/* Mobile Guild Selector */}
        <div className="lg:hidden flex overflow-x-auto gap-2 p-2 border-b border-border bg-card/50 shrink-0">
          {guilds.map((guild) => (
            <button
              key={guild.id}
              onClick={() => {
                setSelectedGuild(guild)
                if (guild.channels.length > 0) {
                  setSelectedChannel(guild.channels[0])
                }
              }}
              className={`shrink-0 w-10 h-10 rounded-xl transition-all duration-300 flex items-center justify-center ${
                selectedGuild?.id === guild.id
                  ? 'bg-gradient-to-br from-primary to-accent'
                  : 'bg-muted hover:bg-accent'
              }`}
            >
              {guild.icon ? (
                <img src={guild.icon} alt={guild.name} className="w-full h-full rounded-xl" />
              ) : (
                <span className="text-sm font-bold">
                  {guild.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </button>
          ))}
          <button 
            onClick={() => setShowCreateServerModal(true)}
            className="shrink-0 w-10 h-10 rounded-xl bg-muted hover:bg-green-500/20 transition-all duration-300 flex items-center justify-center"
          >
            <Plus className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Channels Sidebar */}
        <div className="hidden lg:flex w-60 bg-card/50 backdrop-blur-sm border-r border-border flex-col shrink-0">
          {/* Guild Header */}
          <div className="border-b border-border">
            <button
              className="w-full p-4 hover:bg-accent/10 transition-all flex items-center justify-between group"
              onContextMenu={(e) => guildContextMenu.showContextMenu(e, getGuildContextMenuItems(selectedGuild))}
            >
              <h2 className="font-semibold truncate">{selectedGuild?.name}</h2>
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
            </button>
            <button
              onClick={() => setShowCreateChannelModal(true)}
              className="w-full px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Создать канал
            </button>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto p-2">
            {Object.entries(channelsByCategory).map(([category, channels]) => {
              const isCollapsed = collapsedCategories.has(category)
              const hasUnread = channels.some((c: any) => unreadChannels.has(c.id))
              
              return (
                <div key={category} className="mb-2">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full px-1 mb-1 flex items-center gap-1 group hover:text-foreground transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span className={cn(
                      "text-xs font-semibold uppercase tracking-wider flex-1 text-left",
                      hasUnread ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {category}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowCreateChannelModal(true)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent/20 rounded transition-opacity cursor-pointer"
                      title="Создать канал"
                    >
                      <Plus className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    </span>
                  </button>

                  {!isCollapsed && channels.map((channel: any) => {
                    const isUnread = unreadChannels.has(channel.id)
                    const isActive = selectedChannel?.id === channel.id
                    const isVoiceConnected = voiceState.isConnected && voiceState.channelId === channel.id
                    
                    const getChannelIcon = () => {
                      switch (channel.type) {
                        case 'voice':
                          return <Volume2 className={cn("w-4 h-4 flex-shrink-0", isVoiceConnected && "text-[#23a559]")} />
                        case 'video':
                          return <Video className="w-4 h-4 flex-shrink-0" />
                        default:
                          return <Hash className="w-4 h-4 flex-shrink-0" />
                      }
                    }
                    
                    return (
                      <div key={channel.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedChannel(channel)
                            if ((channel.type === 'voice' || channel.type === 'video') && selectedGuild) {
                              setActiveVoiceChannel(channel.id)
                              joinVoiceChannel(
                                channel.id,
                                channel.name,
                                selectedGuild.id,
                                selectedGuild.name
                              )
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              setSelectedChannel(channel)
                              if ((channel.type === 'voice' || channel.type === 'video') && selectedGuild) {
                                setActiveVoiceChannel(channel.id)
                                joinVoiceChannel(
                                  channel.id,
                                  channel.name,
                                  selectedGuild.id,
                                  selectedGuild.name
                                )
                              }
                            }
                          }}
                          onContextMenu={(e) => channelContextMenu.showContextMenu(e, getChannelContextMenuItems(channel))}
                          className={cn(
                            "w-full px-2 py-1.5 rounded-md flex items-center gap-2 group transition-all cursor-pointer relative",
                            isActive
                              ? 'bg-[#3f4147] text-white'
                              : isUnread
                                ? 'text-white hover:bg-[#35373c]'
                                : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                          )}
                        >
                          {isUnread && !isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 bg-white rounded-r-full" />
                          )}
                          {getChannelIcon()}
                          <span className={cn(
                            "text-sm truncate flex-1",
                            isUnread || isActive ? "font-semibold" : "font-medium"
                          )}>{channel.name}</span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              channelContextMenu.showContextMenu(e as any, getChannelContextMenuItems(channel))
                            }}
                            className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#404249] rounded"
                          >
                            <Settings className="w-3.5 h-3.5 text-[#b5bac1]" />
                          </button>
                        </div>
                    
                        {/* Voice channel users */}
                        {(channel.type === 'voice' || channel.type === 'video') && (voiceChannelUsers[channel.id]?.length || 0) > 0 && (
                          <div className="ml-6 mt-1 space-y-0.5 mb-2">
                            {voiceChannelUsers[channel.id]?.map((voiceUser: { id: string; username: string; avatar?: string; isMuted?: boolean; isSpeaking?: boolean }) => (
                              <div
                                key={voiceUser.id}
                                className={`flex items-center gap-2 px-2 py-1 rounded text-sm group/user ${
                                  voiceUser.isSpeaking ? 'text-white' : 'text-[#949ba4] hover:text-[#dbdee1]'
                                }`}
                              >
                                <div className="relative">
                                  <div className={cn(
                                    "w-6 h-6 rounded-full bg-[#5865f2] flex items-center justify-center text-[10px] font-medium transition-all duration-200",
                                    voiceUser.isSpeaking && "ring-2 ring-[#23a559] ring-offset-1 ring-offset-[#2b2d31]"
                                  )}>
                                    {voiceUser.avatar ? (
                                      <img src={voiceUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                      voiceUser.username.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  {voiceUser.isMuted && (
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#2b2d31] rounded-full flex items-center justify-center">
                                      <MicOff className="w-2 h-2 text-[#da373c]" />
                                    </div>
                                  )}
                                </div>
                                <span className="truncate flex-1">{voiceUser.username}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Voice Status Bar */}
          <VoiceStatusBar />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel Header */}
          <div className="p-4 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-3">
            {selectedChannel.type === 'voice' ? (
              <Volume2 className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Hash className="w-5 h-5 text-muted-foreground" />
            )}
            <div className="flex-1">
              <h2 className="font-semibold">{selectedChannel.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenChannelSettings}
                className="p-2 rounded-lg hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
                title="Настройки канала"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowMembersPanel(!showMembersPanel)}
                className={`p-2 rounded-lg transition-colors ${showMembersPanel ? 'bg-accent/20 text-foreground' : 'hover:bg-accent/20 text-muted-foreground hover:text-foreground'}`}
                title="Участники"
              >
                <Users className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages or Voice Call Content */}
          {selectedChannel.type === 'voice' ? (
            <div className="flex-1 overflow-hidden bg-[#313338]">
              <VoiceChannel
                channelId={parseInt(selectedChannel.id) || 1}
                channelName={selectedChannel.name}
                guildName={selectedGuild?.name || 'Guild'}
                onDisconnect={() => {}}
              />
            </div>
          ) : (
            <>
              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {filteredMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full gradient-aurora-animated flex items-center justify-center orb-glow">
                      <Hash className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="font-semibold mb-2">Welcome to #{selectedChannel.name}</h3>
                    <p className="text-sm text-muted-foreground">This is the start of the channel.</p>
                  </div>
                ) : (
                  filteredMessages.map((message) => (
                    <div
                      key={message.id}
                      className="message-hoverable flex gap-3 px-3 py-2 rounded-lg -mx-3 group"
                      onContextMenu={(e) => messageContextMenu.showContextMenu(e, getMessageContextMenuItems(message))}
                    >
                      <Avatar
                        src={message.author.avatar || undefined}
                        alt={message.author.username}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-sm">{message.author.username}</span>
                          <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
                        </div>
                        {editingMessageId === message.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditMessage()
                                if (e.key === 'Escape') handleCancelEditMessage()
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:ring-2 focus:ring-primary"
                              autoFocus
                            />
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>escape для отмены</span>
                              <span>•</span>
                              <span>enter для сохранения</span>
                              <button
                                onClick={handleSaveEditMessage}
                                className="ml-auto px-2 py-1 bg-primary text-white rounded text-xs hover:bg-primary/90"
                              >
                                Сохранить
                              </button>
                              <button
                                onClick={handleCancelEditMessage}
                                className="px-2 py-1 bg-muted rounded text-xs hover:bg-muted/80"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            {message.reactions && message.reactions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {message.reactions.map((reaction) => {
                                  const hasReacted = reaction.users.includes(user?.id?.toString() || '')
                                  return (
                                    <button
                                      key={reaction.emoji}
                                      onClick={() => hasReacted ? handleRemoveReaction(message.id, reaction.emoji) : handleAddReaction(message.id, reaction.emoji)}
                                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                        hasReacted ? 'bg-primary/20 border border-primary/50' : 'bg-accent/30 hover:bg-accent/50'
                                      }`}
                                    >
                                      <span>{reaction.emoji}</span>
                                      <span className="text-muted-foreground">{reaction.count}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      
                      {editingMessageId !== message.id && (
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1 relative">
                          <button className="p-1 hover:bg-accent rounded" onClick={() => handleReplyToMessage(message)}>
                            <Reply className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button 
                            className="p-1 hover:bg-accent rounded" 
                            onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                          >
                            <Smile className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {showReactionPicker === message.id && (
                            <div className="absolute top-8 right-0 z-50 bg-card border border-border rounded-lg shadow-lg p-2 flex gap-1">
                              {commonEmojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleAddReaction(message.id, emoji)}
                                  className="text-xl hover:bg-accent p-1 rounded transition-all hover:scale-110"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                          {String(message.author_id) === String(user?.id) && (
                            <button className="p-1 hover:bg-accent rounded" onClick={() => handleStartEditMessage(message)}>
                              <Edit3 className="w-4 h-4 text-muted-foreground" />
                            </button>
                          )}
                          <button className="p-1 hover:bg-accent rounded" onClick={() => messageContextMenu.showContextMenu(null as any, getMessageContextMenuItems(message))}>
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Typing Indicator */}
              {typingUsers.size > 0 && (
                <div className="px-4 py-1 text-xs text-muted-foreground flex items-center gap-2">
                  <div className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>
                    {Array.from(typingUsers.values()).map(u => u.username).join(', ')}
                    {typingUsers.size === 1 ? ' печатает...' : ' печатают...'}
                  </span>
                </div>
              )}

              {/* Message Input */}
              <div className="p-4 bg-card/30 backdrop-blur-md">
                {replyingTo && (
                  <div className="mb-2 px-3 py-2 bg-accent/10 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <Reply className="w-3 h-3 text-primary" />
                      <span className="text-muted-foreground">Ответ на</span>
                      <span className="font-semibold">{replyingTo.author.username}</span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-accent/20 rounded">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value)
                      sendTypingIndicator()
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={`Сообщение в #${selectedChannel.name}`}
                    className="w-full bg-accent/10 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/50 transition-all pr-12"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Members Panel */}
        {showMembersPanel && (
          <div className="w-60 bg-[#2b2d31] flex flex-col shrink-0 border-l border-[#1e1f22]">
            <div className="p-4 border-b border-[#1e1f22]">
              <h3 className="font-semibold text-xs text-[#949ba4] uppercase tracking-wider">Участники — {members.length}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {['online', 'idle', 'offline'].map(status => {
                const statusMembers = members.filter(m => m.status === status)
                if (statusMembers.length === 0) return null
                return (
                  <div key={status} className="mb-4">
                    <p className="text-[11px] font-semibold text-[#949ba4] uppercase px-2 mb-1">
                      {status === 'online' ? 'В сети' : status === 'idle' ? 'Неактивен' : 'Не в сети'} — {statusMembers.length}
                    </p>
                    {statusMembers.map(member => (
                      <div key={member.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-[#35373c] transition-colors cursor-pointer group">
                        <div className="relative">
                          <Avatar
                            src={member.avatar || undefined}
                            alt={member.username}
                            userId={member.id}
                            size="sm"
                          />
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-[#2b2d31] ${
                            status === 'online' ? 'bg-[#23a559]' : status === 'idle' ? 'bg-[#f0b232]' : 'bg-[#80848e]'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1.5 text-[#949ba4] group-hover:text-[#dbdee1]">
                            {member.username}
                            {member.role === 'owner' && <Crown className="w-3.5 h-3.5 text-[#f0b232]" />}
                            {member.role === 'admin' && <Shield className="w-3.5 h-3.5 text-[#f23f43]" />}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Channel Settings Modal */}
      {showChannelSettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-card rounded-2xl w-full max-w-lg mx-4 shadow-2xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold">Настройки канала</h2>
              <button onClick={() => setShowChannelSettings(false)} className="p-2 rounded-lg hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Название канала</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full mt-1 px-4 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Описание</label>
                <textarea
                  value={channelDescription}
                  onChange={(e) => setChannelDescription(e.target.value)}
                  placeholder="Добавьте описание канала..."
                  className="w-full mt-1 px-4 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary focus:border-transparent resize-none h-20"
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Медленный режим</p>
                  <p className="text-sm text-muted-foreground">Ограничить частоту сообщений</p>
                </div>
                <select 
                  value={slowMode}
                  onChange={(e) => setSlowMode(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-background border border-border"
                >
                  <option value="off">Выкл</option>
                  <option value="5">5 сек</option>
                  <option value="10">10 сек</option>
                  <option value="30">30 сек</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">NSFW канал</p>
                  <p className="text-sm text-muted-foreground">Контент для взрослых</p>
                </div>
                <button 
                  onClick={() => setIsNsfw(!isNsfw)}
                  className={`w-11 h-6 rounded-full relative transition-colors ${isNsfw ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isNsfw ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-between">
              <button 
                onClick={handleDeleteChannelFromSettings}
                className="px-4 py-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
              >
                Удалить канал
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowChannelSettings(false)} className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80">
                  Отмена
                </button>
                <button 
                  onClick={handleSaveChannelSettings}
                  className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Roles Modal */}
      {showRolesModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-card rounded-2xl w-full max-w-2xl mx-4 shadow-2xl border border-border overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Управление ролями
              </h2>
              <button onClick={() => setShowRolesModal(false)} className="p-2 rounded-lg hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-48 border-r border-border p-2 overflow-y-auto">
                <button 
                  onClick={handleCreateRole}
                  className="w-full px-3 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-left flex items-center gap-2 mb-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Создать роль</span>
                </button>
                {roles.map(role => (
                  <button
                    key={role.id}
                    onClick={() => handleSelectRole(role.id)}
                    className={`w-full px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-colors ${selectedRole === role.id ? 'bg-accent/20' : 'hover:bg-accent/10'}`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
                    <span className="text-sm">{role.name}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                {selectedRole ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Название роли</label>
                      <input
                        type="text"
                        value={roleName}
                        onChange={(e) => setRoleName(e.target.value)}
                        className="w-full mt-1 px-4 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Цвет роли</label>
                      <div className="flex gap-2 mt-1">
                        {['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'].map(color => (
                          <button
                            key={color}
                            onClick={() => setRoleColor(color)}
                            className={`w-8 h-8 rounded-lg border-2 transition-colors ${roleColor === color ? 'border-white' : 'border-transparent hover:border-white/50'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <h3 className="font-medium mb-3">Разрешения</h3>
                      <div className="space-y-2">
                        {[
                          { id: 'manage_channels', name: 'Управлять каналами', desc: 'Создавать, редактировать и удалять каналы' },
                          { id: 'manage_messages', name: 'Управлять сообщениями', desc: 'Удалять и закреплять сообщения' },
                          { id: 'kick_members', name: 'Кикать участников', desc: 'Удалять участников с сервера' },
                          { id: 'ban_members', name: 'Банить участников', desc: 'Блокировать участников навсегда' },
                        ].map(perm => (
                          <div key={perm.id} className="flex items-center justify-between py-2">
                            <div>
                              <p className="text-sm font-medium">{perm.name}</p>
                              <p className="text-xs text-muted-foreground">{perm.desc}</p>
                            </div>
                            <button 
                              onClick={() => handleTogglePermission(perm.id)}
                              className={`w-11 h-6 rounded-full relative transition-colors ${rolePermissions.includes(perm.id) ? 'bg-primary' : 'bg-muted'}`}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${rolePermissions.includes(perm.id) ? 'left-6' : 'left-1'}`} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>Выберите роль или создайте новую</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2 shrink-0">
              <button onClick={() => setShowRolesModal(false)} className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80">
                Отмена
              </button>
              <button 
                onClick={handleSaveRole}
                disabled={!selectedRole}
                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Server Modal */}
      {showCreateServerModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-card rounded-2xl w-full max-w-md mx-4 shadow-2xl border border-border overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Plus className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-bold mb-2">Создать сервер</h2>
              <p className="text-muted-foreground text-sm">Создайте свой сервер и пригласите друзей</p>
            </div>
            <div className="px-6 pb-4">
              <label className="text-sm font-medium text-muted-foreground">Название сервера</label>
              <input
                type="text"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="Мой сервер"
                className="w-full mt-1 px-4 py-3 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button 
                onClick={() => {
                  setShowCreateServerModal(false)
                  setNewServerName('')
                }}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
              >
                Отмена
              </button>
              <button 
                onClick={handleCreateServer}
                disabled={!newServerName.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateChannelModal && (
        <CreateChannelModal
          category="General"
          onClose={() => setShowCreateChannelModal(false)}
          onCreate={handleCreateChannel}
        />
      )}

      {showInviteModal && inviteGuildId && selectedGuild && (
        <InviteModal
          guildId={inviteGuildId}
          guildName={selectedGuild.name}
          onClose={() => {
            setShowInviteModal(false)
            setInviteGuildId(null)
          }}
        />
      )}

      <ContextMenu 
        items={channelContextMenu.contextMenu.items} 
        position={channelContextMenu.contextMenu.position}
        visible={channelContextMenu.contextMenu.visible}
        onClose={channelContextMenu.hideContextMenu}
      />
      <ContextMenu 
        items={messageContextMenu.contextMenu.items} 
        position={messageContextMenu.contextMenu.position}
        visible={messageContextMenu.contextMenu.visible}
        onClose={messageContextMenu.hideContextMenu}
      />
      <ContextMenu 
        items={guildContextMenu.contextMenu.items} 
        position={guildContextMenu.contextMenu.position}
        visible={guildContextMenu.contextMenu.visible}
        onClose={guildContextMenu.hideContextMenu}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        loading={deleteLoading}
      />
    </Layout>
  )
}
