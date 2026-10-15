import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation } from 'wouter'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Layout } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { OnlineIndicator } from '@/components/OnlineIndicator'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { NewMessageModal } from '@/components/NewMessageModal'
import { CallCard, VoiceMessagePlayer } from '@/components/MessageList'
import { useToast } from '@/components/Toast'
import { useStore } from '@/lib/store'
import { useNotifications } from '@/contexts/NotificationContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { messagesAPI, uploadAPI, presenceAPI, groupDMAPI, type Message, type User } from '@/lib/api'
import { formatTime } from '@/lib/utils'
import {
  Search,
  Send,
  MessageSquare,
  Edit3,
  Trash2,
  Reply,
  Pin,
  Copy,
  Heart,
  MoreVertical,
  Archive,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Smile,
  Edit,
  Mic,
  Square,
  Forward,
  Play,
  Pause,
  Phone,
  Video,
  Users
} from 'lucide-react'


export default function MessagesPage() {
  const { user, conversations, fetchConversations, isDemoMode } = useStore()
  const { subscribeToMessages, sendWebSocketMessage, clearMessageNotificationsFromUser, initiateCall } = useNotifications()
  const { t } = useLanguage()
  const toast = useToast()
  const [location] = useLocation()
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [typingUsers, setTypingUsers] = useState<{ username: string; status: string }[]>([])
  const [playingVoice, setPlayingVoice] = useState<string | null>(null)
  const [groupDMs, setGroupDMs] = useState<any[]>([])
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null)
  const [groupMessages, setGroupMessages] = useState<any[]>([])
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([])
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selectedUserRef = useRef<User | null>(null)
  
  useEffect(() => {
    selectedUserRef.current = selectedUser
  }, [selectedUser])

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  const scrollToMessage = (messageId: string) => {
    const element = messageRefs.current.get(messageId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.classList.add('highlight-message')
      setTimeout(() => element.classList.remove('highlight-message'), 2000)
    }
  }

  useEffect(() => {
    if (selectedUser) {
      scrollToBottom('auto')
    }
  }, [selectedUser])

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('smooth')
    }
  }, [messages])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [voicePreview, setVoicePreview] = useState<{ blob: Blob; url: string; duration: number } | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null)

  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null)
  
  void Heart
  void Bell
  void Check
  void audioStreamRef
  void forwardingMessage
  void setForwardingMessage

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const typingRemovalTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const handleWebSocketMessage = useCallback((data: any) => {
    console.log('[Messages] WebSocket message received:', data.type)
    
    switch (data.type) {
      case 'new_message':
      case 'direct_message':
        if (!data.id) {
          console.warn('[Messages] Received message without ID, skipping')
          break
        }
        {
          const fromId = String(data.from_user_id || data.fromUserId || '')
          const toId = String(data.to_user_id || data.toUserId || '')
          const peerId = selectedUserRef.current ? String(selectedUserRef.current.id) : null
          // Сообщение относится к открытому диалогу, если оно от собеседника
          // или это эхо собственного сообщения (например, системная карточка
          // звонка, которую backend шлёт обоим участникам).
          const belongsToOpenChat = peerId !== null &&
            (fromId === peerId || (fromId === String(user?.id) && toId === peerId))
          if (belongsToOpenChat) {
            const newMsg: Message = {
              id: String(data.id),
              content: data.content || '',
              sender_id: data.from_user_id || data.fromUserId,
              receiver_id: toId || user?.id || '',
              created_at: data.created_at || new Date().toISOString(),
              read: false,
              voice_url: data.voice_url,
              voice_duration: data.voice_duration,
              reply_to_id: data.reply_to_id,
              type: data.message_type,
              message_type: data.message_type,
            }
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
            // Диалог открыт — сразу помечаем сообщение прочитанным,
            // чтобы бейдж непрочитанных не рос во время переписки
            if (fromId === peerId && peerId) {
              messagesAPI.markConversationRead(peerId)
                .then(() => fetchConversations())
                .catch(() => {})
            }
          }
        }
        fetchConversations()
        break
      case 'typing':
      case 'recording_voice':
        if (selectedUserRef.current && 
            String(data.from_user_id || data.user_id) === String(selectedUserRef.current.id)) {
          const username = data.username
          if (!username) break
          
          const existingTimer = typingRemovalTimersRef.current.get(username)
          if (existingTimer) {
            clearTimeout(existingTimer)
          }
          
          setTypingUsers(prev => {
            if (!prev.some(u => u.username === username)) {
              return [...prev, { username, status: data.type }]
            }
            return prev.map(u => u.username === username ? { ...u, status: data.type } : u)
          })
          
          const newTimer = setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u.username !== username))
            typingRemovalTimersRef.current.delete(username)
          }, 3000)
          typingRemovalTimersRef.current.set(username, newTimer)
        }
        break
      case 'stopped':
        if (selectedUserRef.current && 
            String(data.from_user_id || data.user_id) === String(selectedUserRef.current.id)) {
          const username = data.username
          if (username) {
            setTypingUsers(prev => prev.filter(u => u.username !== username))
            const timer = typingRemovalTimersRef.current.get(username)
            if (timer) {
              clearTimeout(timer)
              typingRemovalTimersRef.current.delete(username)
            }
          }
        }
        break
      case 'message_read':
        if (data.message_id) {
          setMessages(prev => prev.map(m => 
            m.id === String(data.message_id) ? { ...m, read: true } : m
          ))
        }
        break
      case 'messages-read':
        if (data.reader_id && selectedUserRef.current) {
          if (String(data.reader_id) === String(selectedUserRef.current.id)) {
            setMessages(prev => prev.map(m => 
              String(m.sender_id) === String(user?.id) ? { ...m, read: true } : m
            ))
          }
        }
        break
    }
    if (data.type === 'group_dm_message') {
      if (selectedGroup && data.data?.group_id === selectedGroup.id) {
        setGroupMessages(prev => [...prev, data.data])
        setTimeout(() => scrollToBottom('smooth'), 100)
      }
      loadGroupDMs()
    }
  }, [user?.id, fetchConversations])

  useEffect(() => {
    const unsubscribe = subscribeToMessages(handleWebSocketMessage)
    return () => {
      unsubscribe()
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      typingRemovalTimersRef.current.forEach(timer => clearTimeout(timer))
      typingRemovalTimersRef.current.clear()
    }
  }, [subscribeToMessages, handleWebSocketMessage])

  const sendTypingIndicator = useCallback((status: 'typing' | 'recording_voice' | 'stopped' = 'typing') => {
    if (selectedUser && user) {
      presenceAPI.sendTyping(undefined, String(selectedUser.id), status).catch(() => {})
    }
  }, [selectedUser, user])

  // На старом HTTP-адресе браузер не выдаёт navigator.mediaDevices —
  // подсказываем пользователю HTTPS-адрес, где звонки и голосовые работают.
  const showHttpsHint = useCallback(() => {
    toast.warning(
      'Звонки и голосовые требуют HTTPS',
      'Откройте https://82.114.226.204.sslip.io'
    )
  }, [toast])

  const isMediaDevicesAvailable = () =>
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  // Звонок собеседнику из шапки диалога. Режим (аудио/видео) передаётся
  // на страницу звонка через sessionStorage — VideoCallPage читает outgoingCallMode.
  const startCall = (mode: 'audio' | 'video') => {
    if (!selectedUser) return
    if (!isMediaDevicesAvailable()) {
      showHttpsHint()
      return
    }
    sessionStorage.setItem('outgoingCallMode', mode)
    initiateCall(String(selectedUser.id), selectedUser.username)
  }

  const startRecording = async () => {
    if (!isMediaDevicesAvailable()) {
      showHttpsHint()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const audioUrl = URL.createObjectURL(audioBlob)
        setVoicePreview({ blob: audioBlob, url: audioUrl, duration: recordingTime })
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      sendTypingIndicator('recording_voice')
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      sendTypingIndicator('stopped')
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  const cancelVoicePreview = () => {
    if (voicePreview) {
      URL.revokeObjectURL(voicePreview.url)
      setVoicePreview(null)
    }
    setPlayingVoice(null)
  }

  const togglePlayVoicePreview = () => {
    if (!voicePreview) return
    
    if (playingVoice === 'preview') {
      voiceAudioRef.current?.pause()
      setPlayingVoice(null)
    } else {
      if (!voiceAudioRef.current) {
        voiceAudioRef.current = new Audio(voicePreview.url)
        voiceAudioRef.current.onended = () => setPlayingVoice(null)
      }
      voiceAudioRef.current.play()
      setPlayingVoice('preview')
    }
  }

  const sendVoiceMessage = async () => {
    if (!voicePreview || !selectedUser) return
    
    try {
      // Upload the audio file
      const file = new File([voicePreview.blob], 'voice_message.webm', { type: 'audio/webm' })
      const uploadResult = await uploadAPI.uploadFile(file, 'audio')
      
      // Send message with voice URL
      const msg = await messagesAPI.sendMessage(String(selectedUser.id), '', {
        voiceUrl: uploadResult.url,
        voiceDuration: voicePreview.duration
      })
      setMessages([...messages, msg])
      cancelVoicePreview()
    } catch (error) {
      console.error('Failed to send voice message:', error)
    }
  }

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const [realFriends, setRealFriends] = useState<any[]>([])

  useEffect(() => {
    const loadFriends = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch('/api/friends', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          setRealFriends(data ? data.filter((f: any) => f.isFriend) : [])
        } else {
          setRealFriends([])
        }
      } catch (error) {
        console.error('Failed to load friends:', error)
        setRealFriends([])
      }
    }
    loadFriends()
  }, [])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const userId = searchParams.get('user')
    
    if (userId && realFriends.length > 0) {
      const friend = realFriends.find((f: any) => f.id === userId || String(f.id) === userId)
      if (friend) {
        const userToSelect: User = {
          id: friend.id,
          username: friend.username,
          alias: friend.alias,
          avatar: friend.avatar,
          bio: friend.bio || undefined,
          created_at: new Date().toISOString(),
        }
        setSelectedUser(userToSelect)
        loadMessages(friend.id)
        clearMessageNotificationsFromUser(String(friend.id))
      }
    }
  }, [location, realFriends, clearMessageNotificationsFromUser])

  // Context menu hooks
  const messageContextMenu = useContextMenu()
  const conversationContextMenu = useContextMenu()

  const loadGroupDMs = useCallback(async () => {
    try {
      const groups = await groupDMAPI.getGroups()
      setGroupDMs(groups || [])
    } catch (error) {
      console.error('Failed to load group DMs:', error)
    }
  }, [])

  const selectGroup = async (group: any) => {
    setSelectedGroup(group)
    setSelectedUser(null)
    setLoading(true)
    try {
      const msgs = await groupDMAPI.getMessages(String(group.id))
      setGroupMessages(msgs || [])
    } catch (error) {
      console.error('Failed to load group messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendGroupMessage = async () => {
    if (!newMessage.trim() || !selectedGroup) return
    try {
      const msg = await groupDMAPI.sendMessage(String(selectedGroup.id), newMessage.trim(), replyingTo?.id ? Number(replyingTo.id) : undefined)
      setGroupMessages(prev => [...prev, msg])
      setNewMessage('')
      setReplyingTo(null)
      setTimeout(() => scrollToBottom('smooth'), 100)
    } catch (error) {
      console.error('Failed to send group message:', error)
    }
  }

  const createGroupDM = async () => {
    if (!newGroupName.trim() || selectedParticipants.length === 0) return
    try {
      await groupDMAPI.createGroup(newGroupName.trim(), selectedParticipants)
      setShowCreateGroup(false)
      setNewGroupName('')
      setSelectedParticipants([])
      loadGroupDMs()
    } catch (error) {
      console.error('Failed to create group:', error)
    }
  }

  useEffect(() => {
    if (!isDemoMode) {
      fetchConversations()
      loadGroupDMs()
    }
  }, [isDemoMode, loadGroupDMs])

  const loadMessages = async (userId: string) => {
    try {
      setLoading(true)
      const msgs = await messagesAPI.getMessages(userId)
      // API возвращает сообщения в порядке DESC (новые первыми) —
      // разворачиваем, чтобы новые были ВНИЗУ, как во всех мессенджерах
      setMessages((msgs || []).slice().reverse())
      // Помечаем входящие сообщения прочитанными и сбрасываем бейдж
      messagesAPI.markConversationRead(String(userId))
        .then(() => fetchConversations())
        .catch(() => {})
      // Use setTimeout to ensure DOM is updated before scrolling
      setTimeout(() => scrollToBottom('auto'), 50)
    } catch (error) {
      console.error('Failed to load messages:', error)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  const clearTypingIndicators = useCallback(() => {
    typingRemovalTimersRef.current.forEach(timer => clearTimeout(timer))
    typingRemovalTimersRef.current.clear()
    setTypingUsers([])
  }, [])

  const handleSelectUser = (chatUser: User) => {
    clearTypingIndicators()
    setSelectedUser(chatUser)
    setSelectedGroup(null)
    loadMessages(chatUser.id)
    clearMessageNotificationsFromUser(String(chatUser.id))
  }

  const handleSelectUserFromModal = (friend: any) => {
    clearTypingIndicators()
    const friendUser: User = {
      id: friend.id,
      username: friend.username,
      alias: friend.alias,
      avatar: friend.avatar,
      bio: friend.bio || undefined,
      created_at: new Date().toISOString(),
    }
    setSelectedUser(friendUser)
    loadMessages(friendUser.id)
    clearMessageNotificationsFromUser(String(friendUser.id))
    setShowNewMessageModal(false)
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return

    try {
      if (editingMessage) {
        const updated = await messagesAPI.updateMessage(editingMessage.id, newMessage.trim())
        setMessages(messages.map(m => m.id === editingMessage.id ? { ...m, content: updated.content, edited: true } : m))
      } else {
        const message = await messagesAPI.sendMessage(String(selectedUser.id), newMessage.trim(), {
          replyToId: replyingTo ? parseInt(replyingTo.id) : undefined
        })
        setMessages([...messages, message])
      }
      setNewMessage('')
      setReplyingTo(null)
      setEditingMessage(null)
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleForwardMessage = async (toUserId: string) => {
    if (!forwardingMessage) return
    try {
      await messagesAPI.forwardMessage(parseInt(forwardingMessage.id), toUserId)
      setForwardingMessage(null)
    } catch (error) {
      console.error('Failed to forward message:', error)
    }
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Message[]>([])
  const [showSearch, setShowSearch] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      const results = await messagesAPI.searchMessages(searchQuery, selectedUser?.id)
      setSearchResults(results || [])
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    }
  }

  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([])
  const [showPinned, setShowPinned] = useState(false)

  const loadPinnedMessages = async () => {
    if (!selectedUser) return
    try {
      const pinned = await messagesAPI.getPinnedMessages(selectedUser.id)
      setPinnedMessages(pinned || [])
      setShowPinned(true)
    } catch (error) {
      console.error('Failed to load pinned messages:', error)
    }
  }

  // Message context menu actions
  const handleEditMessage = (message: Message) => {
    setEditingMessage(message)
    setNewMessage(message.content)
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await messagesAPI.deleteMessage(messageId)
      setMessages(messages.filter(m => m.id !== messageId))
      setShowDeleteConfirm(null)
    } catch (error) {
      console.error('Failed to delete message:', error)
    }
  }

  const handleReplyToMessage = (message: Message) => {
    setReplyingTo(message)
  }

  const handlePinMessage = async (messageId: string) => {
    try {
      const updatedMessage = await messagesAPI.pinMessage(messageId)
      setMessages(messages.map(m => m.id === messageId ? { ...m, is_pinned: updatedMessage.is_pinned } : m))
      // Automatically show pinned messages when a new one is pinned
      if (updatedMessage.is_pinned) {
        loadPinnedMessages()
      }
    } catch (error) {
      console.error('Failed to pin message:', error)
    }
  }

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleReactToMessage = async (messageId: string, reaction: string) => {
    if (isDemoMode) {
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = (msg as any).reactions || []
          return { ...msg, reactions: [...reactions, { emoji: reaction, user_id: user?.id }] }
        }
        return msg
      }))
      return
    }

    try {
      await messagesAPI.addReaction(messageId, reaction)
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = (msg as any).reactions || []
          return { ...msg, reactions: [...reactions, { emoji: reaction, user_id: user?.id }] }
        }
        return msg
      }))
    } catch (error) {
      console.error('Failed to add reaction:', error)
    }
  }

  // Conversation context menu actions
  const handleArchiveConversation = (userId: string) => {
    const archivedKey = `archived_conversations_${user?.id}`
    const archived = JSON.parse(localStorage.getItem(archivedKey) || '[]')
    if (!archived.includes(userId)) {
      archived.push(userId)
      localStorage.setItem(archivedKey, JSON.stringify(archived))
    }
    if (selectedUser?.id === userId) {
      setSelectedUser(null)
    }
    fetchConversations()
  }

  const [showDeleteConversationConfirm, setShowDeleteConversationConfirm] = useState<string | null>(null)

  const handleDeleteConversation = async (userId: string) => {
    if (isDemoMode) {
      if (selectedUser?.id === userId) {
        setSelectedUser(null)
        setMessages([])
      }
      fetchConversations()
      return
    }

    try {
      const messagesToDelete = messages.filter(m => 
        (m.from_user_id === userId || m.to_user_id === userId) ||
        (m.sender_id === userId || (m as any).recipient_id === userId)
      )
      
      for (const msg of messagesToDelete) {
        await messagesAPI.deleteMessage(msg.id)
      }
      
      if (selectedUser?.id === userId) {
        setSelectedUser(null)
        setMessages([])
      }
      fetchConversations()
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const handleMuteConversation = (userId: string) => {
    const mutedKey = `muted_conversations_${user?.id}`
    const muted = JSON.parse(localStorage.getItem(mutedKey) || '[]')
    const index = muted.indexOf(userId)
    if (index === -1) {
      muted.push(userId)
    } else {
      muted.splice(index, 1)
    }
    localStorage.setItem(mutedKey, JSON.stringify(muted))
  }

  const handlePinConversation = (userId: string) => {
    const pinnedKey = `pinned_conversations_${user?.id}`
    const pinned = JSON.parse(localStorage.getItem(pinnedKey) || '[]')
    const index = pinned.indexOf(userId)
    if (index === -1) {
      pinned.push(userId)
    } else {
      pinned.splice(index, 1)
    }
    localStorage.setItem(pinnedKey, JSON.stringify(pinned))
    fetchConversations()
  }

  // Generate message context menu items
  const getMessageContextMenuItems = (message: Message): ContextMenuItem[] => {
    const isSent = (message.sender_id || message.from_user_id) === user?.id

    return [
      {
        label: 'Reply',
        icon: <Reply className="w-4 h-4" />,
        onClick: () => handleReplyToMessage(message),
      },
      {
        label: 'React',
        icon: <Smile className="w-4 h-4" />,
        onClick: () => handleReactToMessage(message.id, '❤️'),
      },
      ...(isSent ? [
        {
          label: 'Edit',
          icon: <Edit3 className="w-4 h-4" />,
          onClick: () => handleEditMessage(message),
        },
      ] : []),
      {
        label: 'Copy',
        icon: <Copy className="w-4 h-4" />,
        onClick: () => handleCopyMessage(message.content),
      },
      {
        label: 'Forward',
        icon: <Forward className="w-4 h-4" />,
        onClick: () => setForwardingMessage(message),
      },
      {
        label: 'Pin',
        icon: <Pin className="w-4 h-4" />,
        onClick: () => handlePinMessage(message.id),
      },
      { divider: true } as ContextMenuItem,
      ...(isSent ? [
        {
          label: 'Delete',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => setShowDeleteConfirm(message.id),
          variant: 'danger' as const,
        },
      ] : []),
    ]
  }

  // Generate conversation context menu items
  const getConversationContextMenuItems = (chatUser: User): ContextMenuItem[] => {
    return [
      {
        label: 'Pin',
        icon: <Pin className="w-4 h-4" />,
        onClick: () => handlePinConversation(chatUser.id),
      },
      {
        label: 'Mute',
        icon: <BellOff className="w-4 h-4" />,
        onClick: () => handleMuteConversation(chatUser.id),
      },
      {
        label: 'Archive',
        icon: <Archive className="w-4 h-4" />,
        onClick: () => handleArchiveConversation(chatUser.id),
      },
      { divider: true } as ContextMenuItem,
      {
        label: 'Delete',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => setShowDeleteConversationConfirm(chatUser.id),
        variant: 'danger' as const,
      },
    ]
  }

  return (
    <Layout>
      <div className="h-full flex flex-col lg:flex-row animate-rise-in">
        {/* Conversations list */}
        <div className={`${selectedUser ? 'hidden lg:flex' : 'flex'} w-full lg:w-[340px] bg-card border-r border-border flex-col`}>
          {/* Search and New Message */}
          <div className="p-4 border-b border-border space-y-3">
            {/* New Message Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewMessageModal(true)}
                className="flex-1 bg-primary text-primary-foreground rounded-lg font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none h-10 flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                <span className="font-medium">{t('messages.newMessage')}</span>
              </button>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="h-10 w-10 grid place-items-center text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-all duration-150"
                title="Создать группу"
              >
                <Users className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('messages.searchConversations')}
                className="input-field pl-10 h-9"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {(!conversations || conversations.length === 0) ? (
              <div className="flex flex-col items-center text-center py-16 px-6 animate-rise-in">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center">
                  <MessageSquare className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                </div>
                <p className="text-lg font-semibold text-graphite-900 mt-4">{t('messages.noConversations')}</p>
                <p className="text-sm text-muted-foreground max-w-[320px] mt-1">{t('messages.startNewChat')}</p>
              </div>
            ) : (
              conversations.map((conv, index) => {
                const isSelected = selectedUser?.id === conv.user.id
                return (
                <button
                  key={conv.user.id}
                  onClick={() => handleSelectUser(conv.user)}
                  onContextMenu={(e) => conversationContextMenu.showContextMenu(e, getConversationContextMenuItems(conv.user))}
                  className={`group relative h-[72px] px-3 py-2.5 mx-2 flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-150 animate-rise-in ${
                    isSelected
                      ? 'bg-accent'
                      : 'hover:bg-accent/60'
                  }`}
                  style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />
                  )}
                  <div className="relative">
                    <Avatar
                      src={conv.user.avatar}
                      alt={conv.user.username}
                      userId={conv.user.id}
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 border-2 border-card rounded-full">
                      <OnlineIndicator 
                        isOnline={conv.user.is_online} 
                        lastSeen={conv.user.last_seen}
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-semibold text-foreground' : 'font-medium'}`}>
                          {conv.user.alias || conv.user.username}
                        </p>
                      </div>
                      <span className="text-xs text-graphite-400">
                        {formatTime(conv.last_message.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.last_message.type === 'call' || conv.last_message.message_type === 'call'
                        ? '📞 Звонок'
                        : conv.last_message.voice_url
                          ? '🎤 Голосовое сообщение'
                          : conv.last_message.content}
                    </p>
                  </div>
                  {conv.unread_count > 0 && (
                    <div className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold grid place-items-center">
                      {conv.unread_count}
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      conversationContextMenu.showContextMenu(e as any, getConversationContextMenuItems(conv.user))
                    }}
                    className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 p-1 rounded-lg transition-all duration-150 text-muted-foreground hover:bg-emerald-100 hover:text-accent-foreground"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </button>
                )
              })
            )}
            {groupDMs.length > 0 && (
              <div className="mt-4">
                <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Групповые чаты</div>
                {groupDMs.map((group: any) => (
                  <div
                    key={`group-${group.id}`}
                    onClick={() => selectGroup(group)}
                    className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                      selectedGroup?.id === group.id ? 'bg-accent border-l-[3px] border-l-primary' : 'hover:bg-accent/60'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-graphite-700 flex items-center justify-center text-white font-semibold text-sm">
                      {group.name?.charAt(0)?.toUpperCase() || 'G'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{group.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {group.participants?.length || 0} участников
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className={`${selectedUser || selectedGroup ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
          {selectedGroup ? (
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-3 border-b border-border bg-card">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedGroup(null)}
                    className="lg:hidden h-8 w-8 grid place-items-center -ml-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-all duration-150"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="w-10 h-10 rounded-full bg-graphite-700 flex items-center justify-center text-white font-semibold">
                    {selectedGroup.name?.charAt(0)?.toUpperCase() || 'G'}
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedGroup.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedGroup.participants?.length || 0} участников</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {groupMessages.map((msg: any) => (
                  <div key={msg.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-graphite-700 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {msg.sender?.username?.charAt(0)?.toUpperCase() || msg.sender_username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{msg.sender?.username || msg.sender_username}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                      </div>
                      <p className="text-sm text-foreground/90 mt-0.5 break-words">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-border bg-card">
                <div className="flex items-center gap-2 bg-secondary rounded-xl px-4 py-2 transition-all duration-150 focus-within:ring-4 focus-within:ring-emerald-600/10">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendGroupMessage()}
                    placeholder={`Написать в ${selectedGroup.name}...`}
                    className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={sendGroupMessage}
                    disabled={!newMessage.trim()}
                    className="p-1.5 hover:bg-accent rounded-lg transition-all duration-150 disabled:opacity-50"
                  >
                    <Send className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          ) : selectedUser ? (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-border bg-card">
                <div className="flex items-center gap-3">
                  {/* Mobile back button */}
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="lg:hidden h-8 w-8 grid place-items-center -ml-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-all duration-150"
                    aria-label="Back to conversations"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="relative">
                    <Avatar
                      src={selectedUser.avatar}
                      alt={selectedUser.username}
                      userId={selectedUser.id}
                      size="md"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 border-2 border-card rounded-full">
                      <OnlineIndicator 
                        isOnline={selectedUser.is_online} 
                        lastSeen={selectedUser.last_seen}
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{selectedUser.alias || selectedUser.username}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs sm:text-sm text-muted-foreground">@{selectedUser.username}</p>
                      <span className="text-xs">•</span>
                      <OnlineIndicator 
                        isOnline={selectedUser.is_online} 
                        lastSeen={selectedUser.last_seen}
                        showText
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startCall('audio')}
                      className="h-8 w-8 grid place-items-center rounded-lg transition-all duration-150 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      title="Аудиозвонок"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => startCall('video')}
                      className="h-8 w-8 grid place-items-center rounded-lg transition-all duration-150 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      title="Видеозвонок"
                    >
                      <Video className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setShowSearch(!showSearch)}
                      className={`h-8 w-8 grid place-items-center rounded-lg transition-all duration-150 ${showSearch ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
                      title={t('messages.searchMessages')}
                    >
                      <Search className="w-5 h-5" />
                    </button>
                    <button
                      onClick={loadPinnedMessages}
                      className={`h-8 w-8 grid place-items-center rounded-lg transition-all duration-150 ${showPinned ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
                      title={t('messages.pinnedMessages')}
                    >
                      <Pin className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {/* Search bar */}
                {showSearch && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder={t('messages.searchInConversation')}
                      className="input-field flex-1 text-sm"
                    />
                    <button onClick={handleSearch} className="bg-primary text-primary-foreground rounded-lg font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 px-4 py-2 text-sm">{t('messages.search')}</button>
                  </div>
                )}
                {/* Search results */}
                {showSearch && searchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto bg-card border border-border rounded-xl shadow-soft custom-scrollbar">
                    {searchResults.map((msg) => (
                      <div key={msg.id} className="p-2 hover:bg-accent cursor-pointer border-b border-border last:border-0 text-sm transition-colors duration-150">
                        <p className="truncate">{msg.content}</p>
                        <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Pinned messages */}
                {showPinned && pinnedMessages.length > 0 && (
                  <div className="mt-2 bg-warning-soft border border-warning/30 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-1">{t('messages.pinnedMessage')}</span>
                      <button onClick={() => setShowPinned(false)} className="text-xs text-muted-foreground hover:text-foreground">{t('messages.close')}</button>
                    </div>
                    {pinnedMessages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className="p-2 bg-card rounded-lg text-sm mb-1 last:mb-0 cursor-pointer hover:bg-accent transition-colors duration-150"
                        onClick={() => scrollToMessage(msg.id)}
                      >
                        <p className="truncate opacity-80">{msg.content.substring(0, 100)}{msg.content.length > 100 ? '...' : ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

                  {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col custom-scrollbar">
                <div className="flex-1" />
                {loading ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="bg-[linear-gradient(90deg,hsl(var(--graphite-100))_25%,hsl(var(--graphite-200))_50%,hsl(var(--graphite-100))_75%)] bg-[length:200%_100%] animate-shimmer-sweep rounded-2xl h-16 w-3/4 mx-auto" />
                    <div className="bg-[linear-gradient(90deg,hsl(var(--graphite-100))_25%,hsl(var(--graphite-200))_50%,hsl(var(--graphite-100))_75%)] bg-[length:200%_100%] animate-shimmer-sweep rounded-2xl h-16 w-2/3 mx-auto" />
                    <div className="bg-[linear-gradient(90deg,hsl(var(--graphite-100))_25%,hsl(var(--graphite-200))_50%,hsl(var(--graphite-100))_75%)] bg-[length:200%_100%] animate-shimmer-sweep rounded-2xl h-16 w-4/5 mx-auto" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center text-center py-16 px-6 animate-rise-in">
                    <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center">
                      <MessageSquare className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                    </div>
                    <p className="text-muted-foreground">{t('messages.startConversation')}</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isSent = (message.sender_id || message.from_user_id) === user?.id
                    const isCallCard = message.type === 'call' || message.message_type === 'call'

                    // Системная карточка звонка — по центру, muted-стиль, без пузыря
                    if (isCallCard) {
                      return (
                        <div
                          key={message.id}
                          ref={el => { if (el) messageRefs.current.set(message.id, el) }}
                          className="flex justify-center animate-rise-in"
                          style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
                        >
                          <div className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-full bg-secondary text-muted-foreground">
                            <CallCard content={message.content} />
                            <span className="text-[11px] text-muted-foreground">{formatTime(message.created_at)}</span>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={message.id}
                        ref={el => { if (el) messageRefs.current.set(message.id, el) }}
                        className={`flex ${isSent ? 'justify-end animate-msg-send [transform-origin:bottom_right]' : 'justify-start animate-msg-receive [transform-origin:bottom_left]'}`}
                        style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
                      >
                        <div
                          className={`group relative max-w-[65%] px-3.5 py-2 rounded-2xl shadow-soft text-[15px] leading-6 ${
                            isSent
                              ? 'bg-primary text-primary-foreground rounded-br-[6px]'
                              : 'bg-card border border-border text-card-foreground rounded-bl-[6px]'
                          }`}
                          onContextMenu={(e) => messageContextMenu.showContextMenu(e, getMessageContextMenuItems(message))}
                        >
                          {/* Quick action buttons - shown on hover */}
                          <div className="absolute -top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <button
                              className="h-7 w-7 grid place-items-center rounded-lg border border-border bg-card shadow-soft text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
                              onClick={(e) => {
                                e.stopPropagation();
                                messageContextMenu.showContextMenu(e as any, getMessageContextMenuItems(message));
                              }}
                              title={t('messages.more')}
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Forwarded indicator */}
                          {message.forwarded_from_id && (
                            <div className={`flex items-center gap-1 mb-1 text-xs ${isSent ? 'text-emerald-100/80' : 'text-muted-foreground'}`}>
                              <Forward className="w-3 h-3" />
                              <span>{t('messages.forwarded')}</span>
                            </div>
                          )}

                          {/* Reply reference */}
                          {message.reply_to_id && (() => {
                            const repliedMessage = message.reply_to || messages.find(m => parseInt(m.id) === message.reply_to_id)
                            return (
                              <div className={`mb-2 p-2 rounded-lg border-l-2 ${isSent ? 'bg-white/10 border-white/30' : 'bg-accent/50 border-primary'}`}>
                                <p className={`text-xs font-medium ${isSent ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                                  {repliedMessage ? (String(repliedMessage.sender_id) === String(user?.id) ? 'You' : selectedUser?.username) : 'Message'}
                                </p>
                                <p className={`text-xs truncate ${isSent ? 'text-emerald-100/60' : 'text-muted-foreground'}`}>
                                  {repliedMessage?.voice_url
                                    ? '🎤 Voice message'
                                    : repliedMessage?.type === 'call' || repliedMessage?.message_type === 'call'
                                      ? '📞 Звонок'
                                      : (repliedMessage?.content || 'Message not found')}
                                </p>
                              </div>
                            )
                          })()}

                          {/* Pinned indicator */}
                          {message.is_pinned && (
                            <div className={`flex items-center gap-1 mb-1 text-xs ${isSent ? 'text-emerald-100/80' : 'text-muted-foreground'}`}>
                              <span>{t('messages.pinned')}</span>
                            </div>
                          )}

                          {/* Voice message */}
                          {message.voice_url ? (
                            <VoiceMessagePlayer url={message.voice_url} duration={message.voice_duration} />
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          )}

                          <div className="flex items-center gap-1 mt-1">
                            <p className={`text-[11px] ${isSent ? 'text-emerald-100/80' : 'text-muted-foreground'}`}>
                              {formatTime(message.created_at)}
                            </p>
                            {message.edited && (
                              <span className={`text-[11px] ${isSent ? 'text-emerald-100/60' : 'text-muted-foreground'}`}>
                                (edited)
                              </span>
                            )}
                            {isSent && (
                              <CheckCheck className="w-3 h-3 text-emerald-300" />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                {/* Typing/Recording indicator */}
                {typingUsers.length > 0 && (
                  <div className="px-4 py-2 flex items-center gap-2 text-muted-foreground text-sm">
                    {typingUsers.some(u => u.status === 'recording_voice') ? (
                      <Mic className="w-4 h-4 text-destructive animate-pulse" />
                    ) : (
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-graphite-400 rounded-full animate-typing-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-graphite-400 rounded-full animate-typing-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-graphite-400 rounded-full animate-typing-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                    <span>
                      {typingUsers.map(u => u.username).join(', ')}
                      {typingUsers.some(u => u.status === 'recording_voice')
                        ? ' записывает голосовое...'
                        : ' печатает...'}
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border bg-card">
                {/* Reply/Edit indicator */}
                {(replyingTo || editingMessage) && (
                  <div className="mb-3 px-3 py-1.5 bg-accent/50 border-l-2 border-primary rounded-r-lg flex items-center justify-between animate-rise-in text-sm">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {editingMessage ? (
                          <Edit3 className="w-4 h-4 text-primary" />
                        ) : (
                          <Reply className="w-4 h-4 text-primary" />
                        )}
                        <span className="text-sm font-medium text-primary">
                          {editingMessage ? 'Editing message' : 'Replying to'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {(replyingTo || editingMessage)?.content}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setReplyingTo(null)
                        setEditingMessage(null)
                        setNewMessage('')
                      }}
                      className="p-1 hover:bg-accent rounded transition-colors duration-150"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                )}

                <div className="flex gap-3 items-center">
                  {isRecording ? (
                    <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-danger-soft border border-destructive/30 rounded-lg">
                      <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                      <span className="text-destructive font-medium">{t('messages.recording')} {formatRecordingTime(recordingTime)}</span>
                      <div className="flex-1" />
                      <button
                        onClick={stopRecording}
                        className="p-2 rounded-full bg-destructive text-destructive-foreground hover:bg-[hsl(0_72%_38%)] transition-all duration-150 active:scale-[0.97]"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                    </div>
                  ) : voicePreview ? (
                    <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-accent border border-emerald-200 rounded-lg">
                      <button
                        onClick={togglePlayVoicePreview}
                        className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-emerald-800 transition-all duration-150 active:scale-[0.97]"
                      >
                        {playingVoice === 'preview' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <div className="flex-1">
                        <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: '100%' }} />
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">{formatRecordingTime(voicePreview.duration)}</span>
                      </div>
                      <button
                        onClick={cancelVoicePreview}
                        className="p-2 rounded-lg hover:bg-danger-soft text-destructive transition-all duration-150"
                        title={t('messages.cancel')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={sendVoiceMessage}
                        className="bg-primary text-primary-foreground rounded-lg font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 px-4 py-2"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={startRecording}
                        className="p-3 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150"
                        title={t('messages.voiceMessage')}
                      >
                        <Mic className="w-5 h-5" />
                      </button>
                      <textarea
                        value={newMessage}
                        onChange={(e) => {
                          setNewMessage(e.target.value)
                          if (typingTimeoutRef.current) {
                            clearTimeout(typingTimeoutRef.current)
                          }
                          sendTypingIndicator()
                          typingTimeoutRef.current = setTimeout(() => {
                            typingTimeoutRef.current = null
                          }, 2000)
                        }}
                        placeholder={editingMessage ? 'Edit your message...' : 'Type a message...'}
                        rows={1}
                        className="flex-1 px-4 py-3 bg-secondary border-0 rounded-xl resize-none min-h-[44px] max-h-[160px]
                                  text-foreground placeholder:text-graphite-400
                                  focus:outline-none focus:ring-4 focus:ring-emerald-600/10
                                  transition-all duration-150"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage()
                          }
                        }}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        className="bg-primary text-primary-foreground rounded-lg font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none px-6 py-2.5"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center text-center py-16 px-6 animate-rise-in">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center">
                  <MessageSquare className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                </div>
                <p className="text-lg font-semibold text-graphite-900 mt-4">{t('messages.welcome')}</p>
                <p className="text-sm text-muted-foreground max-w-[320px] mt-1">{t('messages.selectConversation')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context Menus */}
      <ContextMenu
        items={messageContextMenu.contextMenu.items}
        position={messageContextMenu.contextMenu.position}
        visible={messageContextMenu.contextMenu.visible}
        onClose={messageContextMenu.hideContextMenu}
      />
      <ContextMenu
        items={conversationContextMenu.contextMenu.items}
        position={conversationContextMenu.contextMenu.position}
        visible={conversationContextMenu.contextMenu.visible}
        onClose={conversationContextMenu.hideContextMenu}
      />

      {/* New Message Modal */}
      <NewMessageModal
        isOpen={showNewMessageModal}
        onClose={() => setShowNewMessageModal(false)}
        onSelectUser={handleSelectUserFromModal}
        friends={realFriends}
      />

      {/* Forward Message Modal */}
      {forwardingMessage && (
        <div className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] z-50 flex items-center justify-center p-4 animate-fade-in-soft">
          <div className="rounded-2xl border border-border bg-card shadow-pop max-w-md w-full p-6 animate-scale-in">
            <h3 className="text-lg font-semibold tracking-tight mb-4 flex items-center gap-2">
              <Forward className="w-5 h-5 text-primary" /> Forward Message
            </h3>
            <p className="text-sm text-muted-foreground mb-4 p-3 bg-secondary rounded-xl truncate">
              {forwardingMessage.content}
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {realFriends.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">{t('messages.noFriendsToForward')}</p>
              ) : (
                realFriends.map((friend: any) => (
                  <button
                    key={friend.id}
                    onClick={() => handleForwardMessage(friend.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-accent rounded-xl transition-all duration-150"
                  >
                    <Avatar src={friend.avatar} alt={friend.username} size="sm" />
                    <span className="font-medium">{friend.alias || friend.username}</span>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setForwardingMessage(null)}
              className="mt-4 w-full py-2 border border-input bg-card rounded-xl hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 transition-all duration-150"
            >
              {t('messages.cancelDelete')}
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => showDeleteConfirm && handleDeleteMessage(showDeleteConfirm)}
        title={t('messages.deleteTitle')}
        message={t('messages.deleteConfirm')}
        confirmText={t('messages.confirmDelete')}
        cancelText={t('messages.cancelDelete')}
        variant="danger"
      />
      <ConfirmDialog
        isOpen={!!showDeleteConversationConfirm}
        onClose={() => setShowDeleteConversationConfirm(null)}
        onConfirm={() => {
          if (showDeleteConversationConfirm) {
            handleDeleteConversation(showDeleteConversationConfirm)
            setShowDeleteConversationConfirm(null)
          }
        }}
        title={t('messages.deleteTitle')}
        message="Удалить этот диалог? Все сообщения будут удалены безвозвратно."
        confirmText={t('messages.confirmDelete')}
        cancelText={t('messages.cancelDelete')}
        variant="danger"
      />
      {showCreateGroup && (
        <div className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] z-50 flex items-center justify-center p-4 animate-fade-in-soft">
          <div className="rounded-2xl border border-border bg-card shadow-pop w-full max-w-md p-6 animate-scale-in">
            <h3 className="text-lg font-semibold tracking-tight mb-4">Создать групповой чат</h3>
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Название группы"
              className="input-field text-sm mb-4"
            />
            <div className="text-sm text-muted-foreground mb-2">Выберите участников:</div>
            <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
              {conversations.map((conv: any) => (
                <label key={conv.user.id} className="flex items-center gap-3 p-2 hover:bg-accent rounded-lg cursor-pointer transition-colors duration-150">
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(conv.user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedParticipants(prev => [...prev, conv.user.id])
                      } else {
                        setSelectedParticipants(prev => prev.filter(id => id !== conv.user.id))
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{conv.user.username || conv.user.display_name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowCreateGroup(false); setNewGroupName(''); setSelectedParticipants([]) }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={createGroupDM}
                disabled={!newGroupName.trim() || selectedParticipants.length === 0}
                className="px-4 py-2 bg-primary hover:bg-emerald-800 hover:shadow-lg-brand text-primary-foreground text-sm rounded-lg font-medium shadow-soft transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
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
