import { useState, useEffect, useCallback, useRef } from 'react'
import { Layout } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { cn } from '@/lib/utils'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { MarkdownText } from '@/components/MarkdownText'
import { useTranslation } from 'react-i18next'
import { VoiceChannel } from '@/components/VoiceChannel'
import { VoiceStatusBar } from '@/components/VoiceStatusBar'
import { CreateChannelModal } from '@/components/CreateChannelModal'
import { InviteModal } from '@/components/InviteModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { useStore } from '@/lib/store'
import { useNotifications } from '@/contexts/NotificationContext'
import { useVoice } from '@/contexts/VoiceContext'
import { guildsAPI, channelsAPI, presenceAPI, messagesAPI, toolsAPI, APIError, type ChannelTool } from '@/lib/api'
import { useLocation } from 'wouter'
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
  MessageCircle,
  Megaphone,
  Mic,
  MicOff,
  Video,
  Circle,
  Presentation,
  FileText,
  LayoutGrid
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
  author: { id: string; username: string; avatar: string | undefined; display_name?: string | null }
  content: string
  created_at: string
  reactions?: MessageReaction[]
  parent_id?: number | null
  reply_count?: number
}

// Автор канального сообщения: прокидываем display_name (может быть null),
// fallback для отображения — username
const mapMessageAuthor = (
  raw: any,
  fallback: { id: string; username: string; avatar: string | undefined }
): ChannelMessage['author'] => {
  const a = raw || {}
  return {
    id: String(a.id ?? a.ID ?? fallback.id),
    username: a.username ?? a.Username ?? fallback.username,
    avatar: a.avatar ?? a.Avatar ?? fallback.avatar,
    display_name: a.display_name ?? a.DisplayName ?? null
  }
}

type MyChannelPermissions = {
  can_post: boolean
  can_manage: boolean
  role: string
  channel_type: string
}

export default function ChannelsPage() {
  const { t } = useTranslation()
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
  const [isSending, setIsSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const [showMembersPanel, setShowMembersPanel] = useState(false)
  const [showMobileChannels, setShowMobileChannels] = useState(false)
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
  const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean; channelId: string; name: string }>({ isOpen: false, channelId: '', name: '' })
  const [renameLoading, setRenameLoading] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [typingUsers, setTypingUsers] = useState<Map<string, { username: string; timestamp: number; status?: string }>>(new Map())
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set())
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null)
  const [myPerms, setMyPerms] = useState<MyChannelPermissions | null>(null)
  const [showToolsPanel, setShowToolsPanel] = useState(false)
  const [channelTools, setChannelTools] = useState<ChannelTool[]>([])
  const [toolsLoading, setToolsLoading] = useState(false)
  const [newToolTitle, setNewToolTitle] = useState('')
  const [newToolType, setNewToolType] = useState<'board' | 'notebook'>('board')
  const [toolCreating, setToolCreating] = useState(false)
  const [, navigate] = useLocation()
  const toast = useToast()
  const [openThread, setOpenThread] = useState<ChannelMessage | null>(null)
  const [threadReplies, setThreadReplies] = useState<ChannelMessage[]>([])
  const [threadInput, setThreadInput] = useState('')
  const [threadLoading, setThreadLoading] = useState(false)
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
      const parentId = msg && (msg.parent_id ?? msg.ParentID ?? null)

      if (selectedChannel && channelId === String(selectedChannel.id)) {
        if (parentId) {
          // Ответ в треде: append в открытый тред или инкремент reply_count у родителя
          if (openThread && String(openThread.id) === String(parentId)) {
            setThreadReplies(prev => {
              if (prev.some(m => String(m.id) === String(msg.id || msg.ID))) return prev
              return [...prev, {
                id: String(msg.id || msg.ID),
                channel_id: String(msg.channel_id || msg.ChannelID),
                author_id: String(msg.author_id || msg.AuthorID),
                author: mapMessageAuthor(msg.author || msg.Author, { id: String(msg.author_id || msg.AuthorID), username: 'User', avatar: undefined }),
                content: msg.content || msg.Content,
                created_at: msg.created_at || msg.CreatedAt,
                parent_id: parentId,
                reply_count: 0
              }]
            })
          } else {
            setMessages(prev => prev.map(m =>
              String(m.id) === String(parentId)
                ? { ...m, reply_count: (m.reply_count ?? 0) + 1 }
                : m
            ))
          }
        } else {
          setMessages(prev => {
            if (prev.some(m => String(m.id) === String(msg.id || msg.ID))) return prev
            return [...prev, {
              id: String(msg.id || msg.ID),
              channel_id: String(msg.channel_id || msg.ChannelID),
              author_id: String(msg.author_id || msg.AuthorID),
              author: mapMessageAuthor(msg.author || msg.Author, { id: String(msg.author_id || msg.AuthorID), username: 'User', avatar: undefined }),
              content: msg.content || msg.Content,
              created_at: msg.created_at || msg.CreatedAt,
              parent_id: null,
              reply_count: msg.reply_count ?? msg.ReplyCount ?? 0
            }]
          })
        }
      } else {
        setUnreadChannels(prev => new Set(prev).add(channelId))
      }
    }
    
    // Удаление сообщения канала (broadcast после DELETE
    // /api/channels/:channel_id/messages/:message_id)
    if (data.type === 'channel-message-deleted') {
      const messageId = String(data.message_id)
      setMessages(prev => prev.filter(m => String(m.id) !== messageId))
      setThreadReplies(prev => prev.filter(m => String(m.id) !== messageId))
      setOpenThread(prev => (prev && String(prev.id) === messageId ? null : prev))
    }

    if ((data.type === 'typing' || data.type === 'recording_voice') && selectedChannel && String(data.channel_id) === String(selectedChannel.id)) {
      const userId = String(data.user_id)
      const username = data.username || 'Someone'
      if (userId !== String(user?.id)) {
        setTypingUsers(prev => {
          const newMap = new Map(prev)
          newMap.set(userId, { username, timestamp: Date.now(), status: data.type })
          return newMap
        })
      }
    }
    
    if (data.type === 'stopped' && selectedChannel && String(data.channel_id) === String(selectedChannel.id)) {
      const userId = String(data.user_id)
      setTypingUsers(prev => {
        const newMap = new Map(prev)
        newMap.delete(userId)
        return newMap
      })
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
  }, [selectedChannel, user?.id, openThread])

  useEffect(() => {
    const unsubscribe = subscribeToMessages(handleWebSocketMessage)
    return unsubscribe
  }, [subscribeToMessages, handleWebSocketMessage])

  // Сброс бейджа непрочитанных каналов при входе на страницу каналов
  useEffect(() => {
    useStore.getState().clearNotification('channels')
  }, [])

  // Публикуем id открытого канала, чтобы NotificationContext не инкрементировал
  // бейдж для канала, который пользователь сейчас просматривает
  useEffect(() => {
    (window as any).__nebulaOpenChannelId = selectedChannel ? String(selectedChannel.id) : null
    return () => { (window as any).__nebulaOpenChannelId = null }
  }, [selectedChannel])

  useEffect(() => {
    setOpenThread(null)
    setThreadReplies([])
    setThreadInput('')
    setMyPerms(null)
    setShowToolsPanel(false)
    if (selectedChannel && selectedChannel.type !== 'voice') {
      loadChannelMessages(selectedChannel.id)
      channelsAPI.getMyPermissions(selectedChannel.id)
        .then((perms) => { if (perms) setMyPerms(perms) })
        .catch(() => {})
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
          author: mapMessageAuthor(m.author || m.Author, { id: String(m.author_id || m.AuthorID), username: 'User', avatar: undefined }),
          content: m.content || m.Content,
          created_at: m.created_at || m.CreatedAt,
          reactions: m.reactions || m.Reactions || [],
          parent_id: m.parent_id ?? m.ParentID ?? null,
          reply_count: m.reply_count ?? m.ReplyCount ?? 0
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

  const handleCreateChannel = async (channelData: { name: string; type: 'text' | 'voice' | 'announcement'; isPrivate: boolean; template?: string }) => {
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

        if (channelData.template && newChannel?.id) {
          try {
            const token = localStorage.getItem('token')
            await fetch(`/api/templates/educational/${channelData.template}/apply`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                channel_id: newChannel.id,
                name: channelData.name
              })
            })
          } catch (err) {
            console.error('Failed to apply template:', err)
          }
        }
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
  const handleOpenRenameChannel = (channel: any) => {
    setRenameDialog({ isOpen: true, channelId: String(channel.id), name: channel.name })
  }

  const handleRenameChannel = async () => {
    const newName = renameDialog.name.trim()
    if (!newName || !renameDialog.channelId) return
    setRenameLoading(true)
    try {
      await channelsAPI.updateChannel(renameDialog.channelId, { name: newName })
      if (selectedGuild) {
        const updatedGuild = {
          ...selectedGuild,
          channels: selectedGuild.channels.map(c =>
            c.id === renameDialog.channelId ? { ...c, name: newName } : c
          )
        }
        setGuilds(guilds.map(g => g.id === selectedGuild.id ? updatedGuild : g))
        setSelectedGuild(updatedGuild)
        if (selectedChannel?.id === renameDialog.channelId) {
          setSelectedChannel(prev => prev ? { ...prev, name: newName } : prev)
        }
      }
      setRenameDialog({ isOpen: false, channelId: '', name: '' })
    } catch (error) {
      console.error('Failed to rename channel:', error)
    } finally {
      setRenameLoading(false)
    }
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
        if (!selectedChannel) return
        setDeleteLoading(true)
        try {
          // Сообщения канала удаляются через channel-эндпоинт
          // (/messages/delete/:id работает только для DirectMessage).
          await channelsAPI.deleteMessage(selectedChannel.id, messageId)
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
    if (!editingMessageId || !editingContent.trim() || !selectedChannel) return
    const msgId = editingMessageId
    const newContent = editingContent.trim()
    try {
      // FE-8: сообщения канала редактируются через channel-эндпоинт.
      // Раньше использовался messagesAPI.updateMessage (/messages/update/:id),
      // который обновляет только DirectMessage и для канальных сообщений
      // молча падал с 404 — правка не сохранялась.
      await channelsAPI.updateMessage(selectedChannel.id, msgId, newContent)
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
    if (!newMessage.trim() || !selectedChannel || isSending) return
    setIsSending(true)

    const content = newMessage.trim()
    setNewMessage('')
    setReplyingTo(null)

    try {
      const response = await channelsAPI.sendMessage(selectedChannel.id, content) as any
      if (response) {
        setMessages(prev => {
          if (prev.some(m => String(m.id) === String(response.id))) return prev
          return [...prev, {
            id: String(response.id),
            channel_id: String(response.channel_id || selectedChannel.id),
            author_id: String(response.author_id || response.user_id || user?.id),
            author: mapMessageAuthor(response.author || response.user, { id: String(user?.id), username: user?.username || 'User', avatar: user?.avatar }),
            content: response.content,
            created_at: response.created_at
          }]
        })
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setNewMessage(content)
    } finally {
      setIsSending(false)
    }
  }

  const pluralComments = (n: number): string => {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return 'комментарий'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'комментария'
    return 'комментариев'
  }

  const handleOpenThread = async (message: ChannelMessage) => {
    if (!selectedChannel) return
    setOpenThread(message)
    setThreadReplies([])
    setThreadInput('')
    setThreadLoading(true)
    try {
      const replies = await channelsAPI.getThread(selectedChannel.id, String(message.id))
      if (replies) {
        setThreadReplies(replies.map((m: any) => ({
          id: String(m.id || m.ID),
          channel_id: String(m.channel_id || m.ChannelID || selectedChannel.id),
          author_id: String(m.author_id || m.AuthorID),
          author: mapMessageAuthor(m.author || m.Author, { id: String(m.author_id || m.AuthorID), username: 'User', avatar: undefined }),
          content: m.content || m.Content,
          created_at: m.created_at || m.CreatedAt,
          reactions: m.reactions || m.Reactions || [],
          parent_id: m.parent_id ?? m.ParentID ?? null,
          reply_count: m.reply_count ?? m.ReplyCount ?? 0
        })))
      }
    } catch (error) {
      console.error('Failed to load thread:', error)
    } finally {
      setThreadLoading(false)
    }
  }

  const handleSendThreadReply = async () => {
    if (!threadInput.trim() || !selectedChannel || !openThread || isSending) return
    setIsSending(true)
    const content = threadInput.trim()
    const threadId = String(openThread.id)
    setThreadInput('')

    try {
      const response = await channelsAPI.sendMessage(selectedChannel.id, content, Number(openThread.id)) as any
      if (response) {
        setThreadReplies(prev => {
          if (prev.some(m => String(m.id) === String(response.id))) return prev
          return [...prev, {
            id: String(response.id),
            channel_id: String(response.channel_id || selectedChannel.id),
            author_id: String(response.author_id || response.user_id || user?.id),
            author: mapMessageAuthor(response.author || response.user, { id: String(user?.id), username: user?.username || 'User', avatar: user?.avatar }),
            content: response.content,
            created_at: response.created_at,
            parent_id: Number(openThread.id),
            reply_count: 0
          }]
        })
        setMessages(prev => prev.map(m =>
          String(m.id) === threadId
            ? { ...m, reply_count: (m.reply_count ?? 0) + 1 }
            : m
        ))
        setOpenThread(prev =>
          prev && String(prev.id) === threadId
            ? { ...prev, reply_count: (prev.reply_count ?? 0) + 1 }
            : prev
        )
      }
    } catch (error) {
      console.error('Failed to send thread reply:', error)
      setThreadInput(content)
    } finally {
      setIsSending(false)
    }
  }

  // Context menu items
  const getChannelContextMenuItems = (channel: any): ContextMenuItem[] => {
    const isGuildOwner = selectedGuild && user && String(selectedGuild.owner_id) === String(user.id)
    
    const items: ContextMenuItem[] = [
      {
        label: t('channels.muteChannel'),
        icon: <BellOff className="w-4 h-4" />,
        onClick: () => handleMuteChannel(channel.id),
      },
      {
        label: t('channels.invitePeople'),
        icon: <UserPlus className="w-4 h-4" />,
        onClick: () => handleInviteToChannel(channel.id),
      },
    ]

    if (isGuildOwner) {
      items.push({
        label: t('channels.renameChannel'),
        icon: <Edit3 className="w-4 h-4" />,
        onClick: () => handleOpenRenameChannel(channel),
      })
    }

    items.push({ divider: true } as ContextMenuItem)
    items.push({
      label: t('channels.leaveChannel'),
      icon: <LogOut className="w-4 h-4" />,
      onClick: () => handleLeaveChannel(channel.id, channel.name),
      variant: 'danger' as const,
    })

    if (isGuildOwner) {
      items.push({
        label: t('channels.deleteChannel'),
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

  // --- Инструменты канала (доски/блокноты) ---
  const loadChannelTools = useCallback(async (channelId: string) => {
    setToolsLoading(true)
    try {
      const tools = await toolsAPI.list(channelId)
      setChannelTools(tools)
    } catch (error) {
      console.error('Failed to load channel tools:', error)
    } finally {
      setToolsLoading(false)
    }
  }, [])

  const handleOpenToolsPanel = () => {
    const next = !showToolsPanel
    setShowToolsPanel(next)
    if (next && selectedChannel) {
      loadChannelTools(selectedChannel.id)
    }
  }

  const handleCreateTool = async () => {
    if (!selectedChannel || !newToolTitle.trim() || toolCreating) return
    setToolCreating(true)
    try {
      const tool = await toolsAPI.create(selectedChannel.id, newToolType, newToolTitle.trim())
      setChannelTools(prev => [tool, ...prev])
      setNewToolTitle('')
      navigate(`/tools/${tool.id}`)
    } catch (error) {
      console.error('Failed to create tool:', error)
      if (error instanceof APIError && error.status === 403 && error.data?.required_plan) {
        const planName = error.data.required_plan === 'premium' ? 'Premium' : 'Pro'
        const toolName = newToolType === 'board' ? 'доски' : 'блокнота'
        toast.show({
          type: 'warning',
          title: `Для создания ${toolName} нужен тариф ${planName}`,
          action: { label: 'Подробнее', onClick: () => navigate('/premium') },
          duration: 8000,
        })
      } else {
        toast.error('Не удалось создать инструмент')
      }
    } finally {
      setToolCreating(false)
    }
  }

  const handleDeleteTool = (tool: ChannelTool) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Удалить инструмент',
      message: `Вы уверены, что хотите удалить ${tool.tool_type === 'board' ? 'доску' : 'блокнот'} "${tool.title}"? Всё содержимое будет удалено безвозвратно.`,
      confirmText: 'Удалить',
      variant: 'danger',
      onConfirm: async () => {
        setDeleteLoading(true)
        try {
          await toolsAPI.delete(tool.id)
          setChannelTools(prev => prev.filter(t => t.id !== tool.id))
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Failed to delete tool:', error)
        } finally {
          setDeleteLoading(false)
        }
      }
    })
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

  const isAnnouncementChannel = selectedChannel?.type === 'announcement'
  const filteredMessages = messages.filter(m => m.channel_id === selectedChannel?.id && !m.parent_id)

  if (!selectedGuild || !selectedChannel) {
    return (
      <Layout>
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="h-20 w-20 mx-auto mb-4 rounded-2xl bg-secondary grid place-items-center animate-rise-in">
              <Hash className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-semibold text-graphite-900 mb-2">Нет доступных каналов</h2>
            <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">Создайте или присоединитесь к серверу</p>
            <button
              onClick={() => setShowCreateServerModal(true)}
              className="mt-4 px-6 py-2 rounded-xl bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all flex items-center gap-2 mx-auto"
            >
              <Plus className="w-5 h-5" />
              Создать сервер
            </button>
          </div>
        </div>

        {/* Create Server Modal */}
        {showCreateServerModal && (
          <div className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] flex items-center justify-center z-50 animate-fade-in-soft">
            <div className="rounded-2xl border border-border bg-card shadow-pop animate-scale-in w-full max-w-md mx-4 overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-accent flex items-center justify-center">
                  <Plus className="w-10 h-10 text-emerald-700" strokeWidth={1.75} />
                </div>
                <h2 className="text-xl font-bold tracking-tight mb-2">Создать сервер</h2>
                <p className="text-muted-foreground text-sm">Создайте свой сервер и пригласите друзей</p>
              </div>
              <div className="px-6 pb-4">
                <label className="text-sm font-medium text-muted-foreground">Название сервера</label>
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="Мой сервер"
                  className="input-field mt-1 py-3"
                />
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowCreateServerModal(false)
                    setNewServerName('')
                  }}
                  className="px-4 py-2 rounded-lg bg-secondary hover:bg-graphite-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateServer}
                  disabled={!newServerName.trim()}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand disabled:opacity-50 transition-all"
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
      <div className="h-full flex flex-col lg:flex-row">
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
                  ? 'bg-primary rounded-xl shadow-lg-brand text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {guild.icon ? (
                <img src={guild.icon} alt={guild.name} className="w-full h-full object-cover rounded-2xl group-hover:rounded-xl" />
              ) : (
                <span className="text-lg font-bold">
                  {guild.name.slice(0, 2).toUpperCase()}
                </span>
              )}

              {/* Active indicator */}
              {selectedGuild?.id === guild.id && (
                <div className="absolute -left-2 w-1 h-8 rounded-r-full bg-primary" />
              )}
            </button>
          ))}

          {/* Add server button */}
          <button 
            onClick={() => setShowCreateServerModal(true)}
            className="w-12 h-12 rounded-2xl bg-secondary hover:bg-accent hover:rounded-xl transition-all duration-300 flex items-center justify-center group"
          >
            <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
          </button>
        </div>

        {/* Mobile Guild Selector */}
        <div className="lg:hidden flex overflow-x-auto gap-2 p-2 border-b border-border bg-card shrink-0">
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
                  ? 'bg-primary shadow-lg-brand text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
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
            className="shrink-0 w-10 h-10 rounded-xl bg-secondary hover:bg-accent transition-all duration-300 flex items-center justify-center"
          >
            <Plus className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Channels Sidebar */}
        <div className="hidden lg:flex w-60 bg-card border-r border-border flex-col shrink-0">
          {/* Guild Header */}
          <div className="border-b border-border">
            <button
              className="w-full p-4 hover:bg-accent transition-all flex items-center justify-between group"
              onContextMenu={(e) => guildContextMenu.showContextMenu(e, getGuildContextMenuItems(selectedGuild))}
            >
              <h2 className="font-semibold tracking-tight truncate">{selectedGuild?.name}</h2>
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
            </button>
            <button
              onClick={() => setShowCreateChannelModal(true)}
              className="w-full px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Plus className="w-4 h-4" />
              Создать канал
            </button>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
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
                      className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 p-0.5 hover:bg-accent rounded transition-opacity cursor-pointer"
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
                          return <Volume2 className={cn("w-4 h-4 flex-shrink-0", isVoiceConnected && "text-emerald-600")} />
                        case 'video':
                          return <Video className="w-4 h-4 flex-shrink-0" />
                        case 'announcement':
                          return <Megaphone className="w-4 h-4 flex-shrink-0" />
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
                            "w-full px-2 py-1.5 rounded-lg flex items-center gap-2 group transition-colors cursor-pointer relative",
                            isActive
                              ? 'bg-accent text-accent-foreground'
                              : isUnread
                                ? 'text-foreground hover:bg-accent'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          )}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary" />
                          )}
                          {isUnread && !isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 rounded-r-full bg-primary" />
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
                            className="ml-auto opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 p-0.5 hover:bg-accent rounded"
                          >
                            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                    
                        {/* Voice channel users */}
                        {(channel.type === 'voice' || channel.type === 'video') && (voiceChannelUsers[channel.id]?.length || 0) > 0 && (
                          <div className="ml-6 mt-1 space-y-0.5 mb-2">
                            {voiceChannelUsers[channel.id]?.map((voiceUser: { id: string; username: string; avatar?: string; isMuted?: boolean; isSpeaking?: boolean }) => (
                              <div
                                key={voiceUser.id}
                                className={`flex items-center gap-2 px-2 py-1 rounded text-sm group/user ${
                                  voiceUser.isSpeaking ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <div className="relative">
                                  <div className={cn(
                                    "w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-medium transition-all duration-200",
                                    voiceUser.isSpeaking && "ring-2 ring-emerald-500 ring-offset-1 ring-offset-secondary"
                                  )}>
                                    {voiceUser.avatar ? (
                                      <img src={voiceUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                      voiceUser.username.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  {voiceUser.isMuted && (
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-secondary rounded-full flex items-center justify-center">
                                      <MicOff className="w-2 h-2 text-destructive" />
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

        {/* Mobile Channels Drawer */}
        {showMobileChannels && (
          <>
            <div 
              className="lg:hidden fixed inset-0 bg-graphite-950/40 z-40"
              onClick={() => setShowMobileChannels(false)}
            />
            <div className="lg:hidden fixed left-0 top-0 bottom-0 w-64 bg-card z-50 flex flex-col animate-slide-in-left border-r border-border">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold tracking-tight truncate">{selectedGuild?.name}</h2>
                <button
                  onClick={() => setShowMobileChannels(false)}
                  className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {Object.entries(channelsByCategory).map(([category, channels]) => {
                  const isCollapsed = collapsedCategories.has(category)
                  return (
                    <div key={category} className="mb-2">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full px-1 mb-1 flex items-center gap-1 group"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {category}
                        </span>
                      </button>
                      {!isCollapsed && channels.map((channel: any) => (
                        <button
                          key={channel.id}
                          onClick={() => {
                            setSelectedChannel(channel)
                            setShowMobileChannels(false)
                          }}
                          className={cn(
                            "w-full px-2 py-2 rounded-lg flex items-center gap-2 text-left transition-colors",
                            selectedChannel?.id === channel.id
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          )}
                        >
                          {channel.type === 'voice' ? (
                            <Volume2 className="w-4 h-4 flex-shrink-0" />
                          ) : channel.type === 'announcement' ? (
                            <Megaphone className="w-4 h-4 flex-shrink-0" />
                          ) : (
                            <Hash className="w-4 h-4 flex-shrink-0" />
                          )}
                          <span className="truncate">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
              <div className="p-2 border-t border-border">
                <button
                  onClick={() => {
                    setShowCreateChannelModal(true)
                    setShowMobileChannels(false)
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-accent hover:bg-emerald-100 text-foreground flex items-center gap-2 text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Создать канал
                </button>
              </div>
            </div>
          </>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel Header */}
          <div className="h-16 px-4 border-b border-border bg-card flex items-center gap-2 md:gap-3 sticky top-0 z-10 shrink-0">
            <button
              onClick={() => setShowMobileChannels(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <Hash className="w-5 h-5" />
            </button>
            {selectedChannel.type === 'voice' ? (
              <Volume2 className="hidden lg:block w-5 h-5 text-muted-foreground" />
            ) : selectedChannel.type === 'announcement' ? (
              <Megaphone className="hidden lg:block w-5 h-5 text-muted-foreground" />
            ) : (
              <Hash className="hidden lg:block w-5 h-5 text-muted-foreground" />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold tracking-tight truncate text-sm md:text-base">{selectedChannel.name}</h2>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <button
                onClick={handleOpenToolsPanel}
                className={`p-2 rounded-lg transition-colors ${showToolsPanel ? 'bg-accent text-accent-foreground' : 'hover:bg-accent text-muted-foreground hover:text-foreground'}`}
                title="Инструменты"
              >
                <Presentation className="w-5 h-5" />
              </button>
              <button
                onClick={handleOpenChannelSettings}
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Настройки канала"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowMembersPanel(!showMembersPanel)}
                className={`flex p-2 rounded-lg transition-colors ${showMembersPanel ? 'bg-accent text-accent-foreground' : 'hover:bg-accent text-muted-foreground hover:text-foreground'}`}
                title="Участники"
              >
                <Users className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages or Voice Call Content */}
          {selectedChannel.type === 'voice' ? (
            <div className="flex-1 overflow-hidden bg-background">
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
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {filteredMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="h-20 w-20 mx-auto mb-4 rounded-2xl bg-secondary grid place-items-center animate-rise-in">
                      <Hash className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-semibold tracking-tight mb-2">{t('channels.welcomeTo', { name: selectedChannel.name })}</h3>
                    <p className="text-sm text-muted-foreground">{t('channels.channelStart')}</p>
                  </div>
                ) : (
                  filteredMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "group",
                        isAnnouncementChannel
                          ? "rounded-xl border border-border bg-card/60 px-4 py-3"
                          : "message-hoverable -mx-3 rounded-xl hover:bg-accent/50 transition-colors"
                      )}
                      onContextMenu={(e) => messageContextMenu.showContextMenu(e, getMessageContextMenuItems(message))}
                    >
                    <div className={cn("flex gap-3", !isAnnouncementChannel && "px-3 py-2")}>
                      <Avatar
                        src={message.author.avatar || undefined}
                        alt={message.author.username}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-sm">{message.author.display_name || message.author.username}</span>
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
                              className="input-field text-sm"
                              autoFocus
                            />
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>escape для отмены</span>
                              <span>•</span>
                              <span>enter для сохранения</span>
                              <button
                                onClick={handleSaveEditMessage}
                                className="ml-auto px-2 py-1 bg-primary text-primary-foreground rounded-lg text-xs hover:bg-emerald-800 hover:shadow-lg-brand transition-all"
                              >
                                Сохранить
                              </button>
                              <button
                                onClick={handleCancelEditMessage}
                                className="px-2 py-1 bg-secondary rounded-lg text-xs hover:bg-graphite-200 transition-colors"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <MarkdownText text={message.content} className="text-sm" />
                            {message.reactions && message.reactions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {message.reactions.map((reaction) => {
                                  const hasReacted = reaction.users.includes(user?.id?.toString() || '')
                                  return (
                                    <button
                                      key={reaction.emoji}
                                      onClick={() => hasReacted ? handleRemoveReaction(message.id, reaction.emoji) : handleAddReaction(message.id, reaction.emoji)}
                                      className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                                        hasReacted ? 'bg-accent border border-emerald-200 text-emerald-800' : 'bg-card border border-border hover:bg-accent'
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
                        <div className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 flex gap-1 relative">
                          <button className="p-1.5 hover:bg-accent rounded-lg transition-colors" onClick={() => handleReplyToMessage(message)}>
                            <Reply className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button
                            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                            onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                          >
                            <Smile className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {showReactionPicker === message.id && (
                            <div className="absolute top-8 right-0 z-50 rounded-xl border border-border bg-popover p-1 shadow-pop animate-pop-menu flex gap-1">
                              {commonEmojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleAddReaction(message.id, emoji)}
                                  className="text-xl hover:bg-accent p-1 rounded-lg transition-all hover:scale-110"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                          {String(message.author_id) === String(user?.id) && (
                            <button className="p-1.5 hover:bg-accent rounded-lg transition-colors" onClick={() => handleStartEditMessage(message)}>
                              <Edit3 className="w-4 h-4 text-muted-foreground" />
                            </button>
                          )}
                          <button className="p-1.5 hover:bg-accent rounded-lg transition-colors" onClick={() => messageContextMenu.showContextMenu(null as any, getMessageContextMenuItems(message))}>
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isAnnouncementChannel && editingMessageId !== message.id && (
                      <div className="mt-2 ml-11">
                        <button
                          onClick={() => handleOpenThread(message)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          {(message.reply_count ?? 0) > 0
                            ? `${message.reply_count} ${pluralComments(message.reply_count ?? 0)}`
                            : 'Комментировать'}
                        </button>
                      </div>
                    )}
                    </div>
                  ))
                )}
              </div>

              {/* Typing/Recording Indicator */}
              {typingUsers.size > 0 && (
                <div className="px-4 py-1 text-xs text-muted-foreground flex items-center gap-2">
                  {Array.from(typingUsers.values()).some(u => u.status === 'recording_voice') ? (
                    <Mic className="w-3 h-3 text-destructive animate-pulse" />
                  ) : (
                    <div className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 bg-graphite-400 rounded-full animate-typing-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-graphite-400 rounded-full animate-typing-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-graphite-400 rounded-full animate-typing-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                  <span>
                    {Array.from(typingUsers.values()).map(u => u.username).join(', ')}
                    {Array.from(typingUsers.values()).some(u => u.status === 'recording_voice')
                      ? (typingUsers.size === 1 ? ' записывает голосовое...' : ' записывают голосовое...')
                      : (typingUsers.size === 1 ? ' печатает...' : ' печатают...')}
                  </span>
                </div>
              )}

              {/* Message Input */}
              <div className="p-4 border-t border-border bg-card shrink-0 sticky bottom-16 lg:bottom-0 z-10">
                {isAnnouncementChannel && myPerms?.can_post === false ? (
                  <div className="px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-muted-foreground flex items-center gap-2">
                    <Megaphone className="w-4 h-4 shrink-0" />
                    Только администраторы могут публиковать в этом канале
                  </div>
                ) : (
                <>
                {replyingTo && (
                  <div className="mb-2 px-3 py-1.5 bg-accent/50 border-l-2 border-primary rounded-r-lg flex items-center justify-between animate-rise-in text-sm">
                    <div className="flex items-center gap-2 text-xs">
                      <Reply className="w-3 h-3 text-primary" />
                      <span className="text-muted-foreground">Ответ на</span>
                      <span className="font-semibold">{replyingTo.author.display_name || replyingTo.author.username}</span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-accent rounded transition-colors">
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
                    className="w-full bg-card border border-border rounded-xl py-3 px-4 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/60 transition-all"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-primary-foreground shadow-soft disabled:opacity-50 disabled:pointer-events-none hover:bg-emerald-800 hover:shadow-lg-brand transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Members Panel backdrop for mobile */}
        {showMembersPanel && (
          <div 
            className="md:hidden fixed inset-0 bg-graphite-950/40 z-[55]"
            onClick={() => setShowMembersPanel(false)}
          />
        )}
        {/* Members Panel */}
        {showMembersPanel && (
          <div className="fixed inset-y-0 right-0 w-64 md:static md:w-60 bg-card flex flex-col shrink-0 border-l border-border z-[60] md:z-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Участники — {members.length}</h3>
              <button onClick={() => setShowMembersPanel(false)} className="md:hidden p-1 rounded hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {['online', 'idle', 'offline'].map(status => {
                const statusMembers = members.filter(m => m.status === status)
                if (statusMembers.length === 0) return null
                return (
                  <div key={status} className="mb-4">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase px-2 mb-1">
                      {status === 'online' ? 'В сети' : status === 'idle' ? 'Неактивен' : 'Не в сети'} — {statusMembers.length}
                    </p>
                    {statusMembers.map(member => (
                      <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer group">
                        <div className="relative">
                          <Avatar
                            src={member.avatar || undefined}
                            alt={member.username}
                            userId={member.id}
                            size="sm"
                          />
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-card ${
                            status === 'online' ? 'bg-online' : status === 'idle' ? 'bg-idle' : 'bg-muted-foreground'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground">
                            {member.username}
                            {member.role === 'owner' && <Crown className="w-3.5 h-3.5 text-warning" />}
                            {member.role === 'admin' && <Shield className="w-3.5 h-3.5 text-destructive" />}
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

        {/* Tools Panel backdrop for mobile */}
        {showToolsPanel && (
          <div
            className="md:hidden fixed inset-0 bg-graphite-950/40 z-[55]"
            onClick={() => setShowToolsPanel(false)}
          />
        )}
        {/* Tools Panel */}
        {showToolsPanel && (
          <div className="fixed inset-y-0 right-0 w-72 md:static md:w-72 bg-card flex flex-col shrink-0 border-l border-border z-[60] md:z-auto">
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Presentation className="w-4 h-4" />
                Инструменты — {channelTools.length}
              </h3>
              <button onClick={() => setShowToolsPanel(false)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Create tool form */}
            <div className="p-3 border-b border-border space-y-2 shrink-0">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setNewToolType('board')}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors border",
                    newToolType === 'board'
                      ? 'bg-accent border-primary/50 text-foreground'
                      : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Доска
                </button>
                <button
                  onClick={() => setNewToolType('notebook')}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors border",
                    newToolType === 'notebook'
                      ? 'bg-accent border-primary/50 text-foreground'
                      : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Блокнот
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={newToolTitle}
                  onChange={(e) => setNewToolTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTool()}
                  placeholder={newToolType === 'board' ? 'Название доски...' : 'Название блокнота...'}
                  className="w-full bg-card/60 border border-border rounded-lg py-2 px-3 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
                <button
                  onClick={handleCreateTool}
                  disabled={!newToolTitle.trim() || toolCreating}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary text-primary-foreground shadow-soft disabled:opacity-50 disabled:pointer-events-none hover:bg-emerald-800 hover:shadow-lg-brand transition-all"
                  title="Создать"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tools list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {toolsLoading ? (
                <p className="text-xs text-muted-foreground text-center py-6">Загрузка...</p>
              ) : channelTools.filter(t => t.tool_type === newToolType).length === 0 ? (
                <div className="text-center py-8 px-3">
                  <Presentation className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">
                    {newToolType === 'board' ? 'В этом канале пока нет досок' : 'В этом канале пока нет блокнотов'}
                  </p>
                </div>
              ) : (
                channelTools.filter(t => t.tool_type === newToolType).map((tool) => {
                  const isOwner = user && String(tool.owner_id) === String(user.id)
                  return (
                    <div
                      key={tool.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/tools/${tool.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') navigate(`/tools/${tool.id}`)
                      }}
                      className="w-full rounded-xl bg-secondary/40 border border-border p-3 hover:border-primary/40 hover:bg-accent transition-colors cursor-pointer group text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          tool.tool_type === 'board' ? 'bg-accent text-primary' : 'bg-accent/15 text-accent'
                        )}>
                          {tool.tool_type === 'board' ? (
                            <LayoutGrid className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tool.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {tool.tool_type === 'board' ? 'Доска' : 'Блокнот'}
                          </p>
                        </div>
                        {isOwner && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteTool(tool)
                            }}
                            className="p-1.5 rounded-lg hover:bg-danger-soft text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Thread Panel backdrop for mobile */}
        {openThread && (
          <div
            className="md:hidden fixed inset-0 bg-graphite-950/40 z-[55]"
            onClick={() => setOpenThread(null)}
          />
        )}
        {/* Thread Panel */}
        {openThread && (
          <div className="fixed inset-y-0 right-0 w-80 md:static md:w-80 bg-card flex flex-col shrink-0 border-l border-border z-[60] md:z-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Комментарии{typeof openThread.reply_count === 'number' && openThread.reply_count > 0 ? ` — ${openThread.reply_count}` : ''}
              </h3>
              <button
                onClick={() => setOpenThread(null)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Parent post */}
            <div className="p-3 border-b border-border bg-secondary">
              <div className="flex items-center gap-2 mb-1">
                <Avatar
                  src={openThread.author.avatar || undefined}
                  alt={openThread.author.username}
                  size="sm"
                />
                <span className="font-semibold text-sm truncate">{openThread.author.display_name || openThread.author.username}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatTime(openThread.created_at)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{openThread.content}</p>
            </div>

            {/* Replies list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {threadLoading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Загрузка...</p>
              ) : threadReplies.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Пока нет комментариев. Будьте первым!</p>
              ) : (
                threadReplies.map((reply) => (
                  <div key={reply.id} className="flex gap-2">
                    <Avatar
                      src={reply.author.avatar || undefined}
                      alt={reply.author.username}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-xs truncate">{reply.author.display_name || reply.author.username}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(reply.created_at)}</span>
                      </div>
                      <MarkdownText text={reply.content} className="text-sm" />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Thread composer */}
            <div className="p-3 border-t border-border shrink-0">
              <div className="relative">
                <input
                  type="text"
                  value={threadInput}
                  onChange={(e) => setThreadInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendThreadReply()}
                  placeholder="Комментарий..."
                  className="w-full bg-secondary border-0 rounded-xl py-2.5 px-3 pr-10 text-sm text-foreground placeholder:text-graphite-400 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 transition-all duration-150"
                />
                <button
                  onClick={handleSendThreadReply}
                  disabled={!threadInput.trim() || isSending}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary text-primary-foreground shadow-soft disabled:opacity-50 disabled:pointer-events-none hover:bg-emerald-800 hover:shadow-lg-brand transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Channel Settings Modal */}
      {showChannelSettings && (
        <div className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] flex items-center justify-center z-50 animate-fade-in-soft">
          <div className="rounded-2xl border border-border bg-card shadow-pop animate-scale-in w-full max-w-lg mx-4 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Настройки канала</h2>
              <button onClick={() => setShowChannelSettings(false)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
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
                  className="input-field mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Описание</label>
                <textarea
                  value={channelDescription}
                  onChange={(e) => setChannelDescription(e.target.value)}
                  placeholder="Добавьте описание канала..."
                  className="input-field mt-1 resize-none h-20"
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
                  className="px-3 py-1.5 rounded-lg bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                className="px-4 py-2 rounded-lg text-destructive hover:bg-danger-soft transition-colors"
              >
                Удалить канал
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowChannelSettings(false)} className="px-4 py-2 rounded-lg bg-secondary hover:bg-graphite-200 transition-colors">
                  Отмена
                </button>
                <button
                  onClick={handleSaveChannelSettings}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all"
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
        <div className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] flex items-center justify-center z-50 animate-fade-in-soft">
          <div className="rounded-2xl border border-border bg-card shadow-pop animate-scale-in w-full max-w-2xl mx-4 overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Управление ролями
              </h2>
              <button onClick={() => setShowRolesModal(false)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-48 border-r border-border p-2 overflow-y-auto custom-scrollbar">
                <button
                  onClick={handleCreateRole}
                  className="w-full px-3 py-2 rounded-lg bg-accent hover:bg-accent text-left flex items-center gap-2 mb-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Создать роль</span>
                </button>
                {roles.map(role => (
                  <button
                    key={role.id}
                    onClick={() => handleSelectRole(role.id)}
                    className={`w-full px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-colors ${selectedRole === role.id ? 'bg-accent' : 'hover:bg-accent'}`}
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
                        className="input-field mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Цвет роли</label>
                      <div className="flex gap-2 mt-1">
                        {['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'].map(color => (
                          <button
                            key={color}
                            onClick={() => setRoleColor(color)}
                            className={`w-8 h-8 rounded-lg border-2 transition-colors ${roleColor === color ? 'border-foreground' : 'border-transparent hover:border-foreground/50'}`}
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
              <button onClick={() => setShowRolesModal(false)} className="px-4 py-2 rounded-lg bg-secondary hover:bg-graphite-200 transition-colors">
                Отмена
              </button>
              <button
                onClick={handleSaveRole}
                disabled={!selectedRole}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand disabled:opacity-50 transition-all"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Server Modal */}
      {showCreateServerModal && (
        <div className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] flex items-center justify-center z-50 animate-fade-in-soft">
          <div className="rounded-2xl border border-border bg-card shadow-pop animate-scale-in w-full max-w-md mx-4 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-accent flex items-center justify-center">
                <Plus className="w-10 h-10 text-emerald-700" strokeWidth={1.75} />
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-2">Создать сервер</h2>
              <p className="text-muted-foreground text-sm">Создайте свой сервер и пригласите друзей</p>
            </div>
            <div className="px-6 pb-4">
              <label className="text-sm font-medium text-muted-foreground">Название сервера</label>
              <input
                type="text"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="Мой сервер"
                className="input-field mt-1 py-3"
              />
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateServerModal(false)
                  setNewServerName('')
                }}
                className="px-4 py-2 rounded-lg bg-secondary hover:bg-graphite-200 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateServer}
                disabled={!newServerName.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand disabled:opacity-50 transition-all"
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

      {/* Rename Channel Dialog */}
      {renameDialog.isOpen && (
        <div className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] flex items-center justify-center z-50 animate-fade-in-soft">
          <div className="rounded-2xl border border-border bg-card shadow-pop animate-scale-in w-full max-w-sm mx-4 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">{t('channels.renameChannel')}</h2>
              <button
                onClick={() => setRenameDialog({ isOpen: false, channelId: '', name: '' })}
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleRenameChannel()
              }}
              className="p-4 space-y-4"
            >
              <input
                type="text"
                value={renameDialog.name}
                onChange={(e) => setRenameDialog(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('channels.channelName')}
                className="input-field"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setRenameDialog({ isOpen: false, channelId: '', name: '' })}
                  className="px-4 py-2 rounded-lg bg-secondary hover:bg-graphite-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!renameDialog.name.trim() || renameLoading}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all disabled:opacity-50"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
