import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'wouter'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Layout } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { NewMessageModal } from '@/components/NewMessageModal'
import { useStore } from '@/lib/store'
import { messagesAPI, uploadAPI, type Message, type User } from '@/lib/api'
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
  Pause
} from 'lucide-react'


export default function MessagesPage() {
  const { user, conversations, fetchConversations, isDemoMode } = useStore()
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
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [playingVoice, setPlayingVoice] = useState<string | null>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  void setTypingUsers

  const startRecording = async () => {
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
      }
    }
  }, [location, realFriends])

  // Context menu hooks
  const messageContextMenu = useContextMenu()
  const conversationContextMenu = useContextMenu()

  useEffect(() => {
    if (!isDemoMode) {
      fetchConversations()
    }
  }, [isDemoMode])

  const loadMessages = async (userId: string) => {
    try {
      setLoading(true)
      const msgs = await messagesAPI.getMessages(userId)
      setMessages(msgs || [])
      // Use setTimeout to ensure DOM is updated before scrolling
      setTimeout(() => scrollToBottom('auto'), 50)
    } catch (error) {
      console.error('Failed to load messages:', error)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectUser = (chatUser: User) => {
    setSelectedUser(chatUser)
    loadMessages(chatUser.id)
  }

  const handleSelectUserFromModal = (friend: any) => {
    const user: User = {
      id: friend.id,
      username: friend.username,
      alias: friend.alias,
      avatar: friend.avatar,
      bio: friend.bio || undefined,
      created_at: new Date().toISOString(),
    }
    setSelectedUser(user)
    loadMessages(user.id) // Load actual messages
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

  const handleReactToMessage = (messageId: string, reaction: string) => {
    console.log('React to message:', messageId, reaction)
    // TODO: Implement reaction functionality
  }

  // Conversation context menu actions
  const handleArchiveConversation = (userId: string) => {
    console.log('Archive conversation:', userId)
    // TODO: Implement archive functionality
  }

  const handleDeleteConversation = async (userId: string) => {
    if (confirm('Delete this conversation?')) {
      console.log('Delete conversation:', userId)
      // TODO: Implement delete functionality
    }
  }

  const handleMuteConversation = (userId: string) => {
    console.log('Mute conversation:', userId)
    // TODO: Implement mute functionality
  }

  const handlePinConversation = (userId: string) => {
    console.log('Pin conversation:', userId)
    // TODO: Implement pin functionality
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
        onClick: () => handleDeleteConversation(chatUser.id),
        variant: 'danger' as const,
      },
    ]
  }

  return (
    <Layout>
      <div className="h-full lg:h-screen flex flex-col lg:flex-row">
        {/* Conversations list */}
        <div className={`${selectedUser ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 bg-card border-r border-border flex-col`}>
          {/* Search and New Message */}
          <div className="p-4 border-b border-border space-y-3">
            {/* New Message Button */}
            <button
              onClick={() => setShowNewMessageModal(true)}
              className="w-full btn-cosmic py-2.5 flex items-center justify-center gap-2"
            >
              <Edit className="w-4 h-4" />
              <span className="font-medium">New Message</span>
            </button>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full px-4 py-2 pl-10 bg-background border border-border rounded-lg
                          text-foreground placeholder:text-muted-foreground
                          focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                          transition-all duration-300 hover:border-primary/50"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {(!conversations || conversations.length === 0) ? (
              <div className="text-center py-12 px-4 animate-fade-in">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center orb-glow">
                  <MessageSquare className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">No conversations yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Start a new chat to see it here</p>
              </div>
            ) : (
              conversations.map((conv, index) => (
                <button
                  key={conv.user.id}
                  onClick={() => handleSelectUser(conv.user)}
                  onContextMenu={(e) => conversationContextMenu.showContextMenu(e, getConversationContextMenuItems(conv.user))}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-accent/10 transition-all duration-300
                             border-b border-border hover:scale-[1.02] animate-slide-in ${
                    selectedUser?.id === conv.user.id ? 'bg-accent/20 border-l-4 border-l-primary' : ''
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <Avatar
                    src={conv.user.avatar}
                    alt={conv.user.username}
                    userId={conv.user.id}
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium truncate">
                        {conv.user.alias || conv.user.username}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(conv.last_message.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.last_message.content}
                    </p>
                  </div>
                  {conv.unread_count > 0 && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground
                                    text-xs flex items-center justify-center font-semibold pulse-call">
                      {conv.unread_count}
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      conversationContextMenu.showContextMenu(e as any, getConversationContextMenuItems(conv.user))
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent/20 rounded transition-opacity"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className={`${selectedUser ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
          {selectedUser ? (
            <>
              {/* Header */}
              <div className="p-3 sm:p-4 border-b border-border bg-card card-cosmic">
                <div className="flex items-center gap-3">
                  {/* Mobile back button */}
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="lg:hidden p-2 -ml-1 hover:bg-accent/20 rounded-lg transition-colors"
                    aria-label="Back to conversations"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <Avatar
                    src={selectedUser.avatar}
                    alt={selectedUser.username}
                    userId={selectedUser.id}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-base sm:text-lg truncate">{selectedUser.alias || selectedUser.username}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">@{selectedUser.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSearch(!showSearch)}
                      className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-primary/20 text-primary' : 'hover:bg-accent/20'}`}
                      title="Search messages"
                    >
                      <Search className="w-5 h-5" />
                    </button>
                    <button
                      onClick={loadPinnedMessages}
                      className={`p-2 rounded-lg transition-colors ${showPinned ? 'bg-primary/20 text-primary' : 'hover:bg-accent/20'}`}
                      title="Pinned messages"
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
                      placeholder="Search in conversation..."
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button onClick={handleSearch} className="btn-cosmic px-4 py-2 text-sm">Search</button>
                  </div>
                )}
                {/* Search results */}
                {showSearch && searchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto bg-background border border-border rounded-lg">
                    {searchResults.map((msg) => (
                      <div key={msg.id} className="p-2 hover:bg-accent/10 cursor-pointer border-b border-border last:border-0 text-sm">
                        <p className="truncate">{msg.content}</p>
                        <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Pinned messages */}
                {showPinned && pinnedMessages.length > 0 && (
                  <div className="mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-1">Закрепленное сообщение</span>
                      <button onClick={() => setShowPinned(false)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
                    </div>
                    {pinnedMessages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className="p-2 bg-background rounded text-sm mb-1 last:mb-0 cursor-pointer hover:bg-accent/10 transition-colors"
                        onClick={() => scrollToMessage(msg.id)}
                      >
                        <p className="truncate opacity-80">{msg.content.substring(0, 100)}{msg.content.length > 100 ? '...' : ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

                  {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
                <div className="flex-1" />
                {loading ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="skeleton-cosmic h-16 w-3/4 mx-auto" />
                    <div className="skeleton-cosmic h-16 w-2/3 mx-auto" />
                    <div className="skeleton-cosmic h-16 w-4/5 mx-auto" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 animate-fade-in">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full gradient-aurora-animated flex items-center justify-center orb-glow">
                      <MessageSquare className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isSent = (message.sender_id || message.from_user_id) === user?.id

                    return (
                      <div
                        key={message.id}
                        ref={el => { if (el) messageRefs.current.set(message.id, el) }}
                        className={`flex ${isSent ? 'justify-end' : 'justify-start'} animate-slide-in`}
                        style={{ animationDelay: `${index * 0.03}s` }}
                      >
                        <div
                          className={`message-hoverable max-w-md px-4 py-3 rounded-2xl transition-all duration-300 hover:scale-[1.02] ${
                            isSent
                              ? 'bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-br-sm'
                              : 'bg-muted text-foreground rounded-bl-sm card-cosmic'
                          }`}
                          onContextMenu={(e) => messageContextMenu.showContextMenu(e, getMessageContextMenuItems(message))}
                        >
                          {/* Quick action buttons - shown on hover */}
                          <div className="message-actions">
                            <button
                              className="message-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                messageContextMenu.showContextMenu(e as any, getMessageContextMenuItems(message));
                              }}
                              title="More"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Forwarded indicator */}
                          {message.forwarded_from_id && (
                            <div className={`flex items-center gap-1 mb-1 text-xs ${isSent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              <Forward className="w-3 h-3" />
                              <span>Forwarded</span>
                            </div>
                          )}

                          {/* Reply reference */}
                          {message.reply_to_id && (() => {
                            const repliedMessage = message.reply_to || messages.find(m => parseInt(m.id) === message.reply_to_id)
                            return (
                              <div className={`mb-2 p-2 rounded border-l-2 ${isSent ? 'bg-white/10 border-white/30' : 'bg-muted border-primary/30'}`}>
                                <p className={`text-xs font-medium ${isSent ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                  {repliedMessage ? (String(repliedMessage.sender_id) === String(user?.id) ? 'You' : selectedUser?.username) : 'Message'}
                                </p>
                                <p className={`text-xs truncate ${isSent ? 'text-primary-foreground/60' : 'text-muted-foreground/80'}`}>
                                  {repliedMessage?.voice_url ? '🎤 Voice message' : (repliedMessage?.content || 'Message not found')}
                                </p>
                              </div>
                            )
                          })()}

                          {/* Pinned indicator */}
                          {message.is_pinned && (
                            <div className={`flex items-center gap-1 mb-1 text-xs ${isSent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              <span>Закреплено</span>
                            </div>
                          )}

                          {/* Voice message */}
                          {message.voice_url ? (
                            <div className="flex items-center gap-2">
                              <button 
                                className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition"
                                onClick={() => {
                                  if (playingVoice === message.id) {
                                    voiceAudioRef.current?.pause()
                                    setPlayingVoice(null)
                                  } else {
                                    if (voiceAudioRef.current) {
                                      voiceAudioRef.current.pause()
                                    }
                                    voiceAudioRef.current = new Audio(message.voice_url!)
                                    voiceAudioRef.current.onended = () => setPlayingVoice(null)
                                    voiceAudioRef.current.play()
                                    setPlayingVoice(message.id)
                                  }
                                }}
                              >
                                {playingVoice === message.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                              <div className="flex-1 h-1 bg-white/20 rounded-full">
                                <div className={`h-full ${playingVoice === message.id ? 'w-1/2 animate-pulse' : 'w-0'} bg-white rounded-full transition-all`}></div>
                              </div>
                              <span className="text-xs">{formatRecordingTime(message.voice_duration || 0)}</span>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          )}

                          <div className="flex items-center gap-1 mt-1">
                            <p className={`text-xs ${isSent ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>
                              {formatTime(message.created_at)}
                            </p>
                            {message.edited && (
                              <span className={`text-xs ${isSent ? 'text-primary-foreground/50' : 'text-muted-foreground/50'}`}>
                                (edited)
                              </span>
                            )}
                            {isSent && (
                              <CheckCheck className="w-3 h-3 text-primary-foreground/70" />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                  <div className="px-4 py-2 flex items-center gap-2 text-muted-foreground text-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>{typingUsers.join(', ')} печатает...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border bg-card">
                {/* Reply/Edit indicator */}
                {(replyingTo || editingMessage) && (
                  <div className="mb-3 p-3 bg-accent/10 border-l-4 border-l-primary rounded-lg flex items-center justify-between">
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
                      className="p-1 hover:bg-accent/20 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                )}

                <div className="flex gap-3 items-center">
                  {isRecording ? (
                    <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500 rounded-lg">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-red-500 font-medium">Запись... {formatRecordingTime(recordingTime)}</span>
                      <div className="flex-1" />
                      <button
                        onClick={stopRecording}
                        className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                    </div>
                  ) : voicePreview ? (
                    <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary rounded-lg">
                      <button
                        onClick={togglePlayVoicePreview}
                        className="p-2 rounded-full bg-primary text-white hover:bg-primary/80 transition"
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
                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition"
                        title="Отменить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={sendVoiceMessage}
                        className="btn-cosmic px-4"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={startRecording}
                        className="p-3 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition"
                        title="Голосовое сообщение"
                      >
                        <Mic className="w-5 h-5" />
                      </button>
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={editingMessage ? 'Edit your message...' : 'Type a message...'}
                        rows={1}
                        className="flex-1 px-4 py-3 bg-background border border-border rounded-lg resize-none
                                  text-foreground placeholder:text-muted-foreground
                                  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                                  transition-all duration-300 hover:border-primary/50"
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
                        className="btn-cosmic px-6"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center animate-fade-in">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full gradient-cosmic-rainbow-animated flex items-center justify-center orb-glow">
                  <MessageSquare className="w-12 h-12 text-white" />
                </div>
                <p className="text-muted-foreground text-lg font-medium mb-2">Welcome to Messages</p>
                <p className="text-muted-foreground/70 text-sm">Select a conversation to start messaging</p>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6 animate-fade-in">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Forward className="w-5 h-5" /> Forward Message
            </h3>
            <p className="text-sm text-muted-foreground mb-4 p-3 bg-muted rounded-lg truncate">
              {forwardingMessage.content}
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {realFriends.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No friends to forward to</p>
              ) : (
                realFriends.map((friend: any) => (
                  <button
                    key={friend.id}
                    onClick={() => handleForwardMessage(friend.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-accent/10 rounded-lg transition-colors"
                  >
                    <Avatar src={friend.avatar} alt={friend.username} size="sm" />
                    <span className="font-medium">{friend.alias || friend.username}</span>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setForwardingMessage(null)}
              className="mt-4 w-full py-2 border border-border rounded-lg hover:bg-accent/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => showDeleteConfirm && handleDeleteMessage(showDeleteConfirm)}
        title="Удалить сообщение?"
        message="Вы уверены, что хотите удалить это сообщение? Это действие нельзя будет отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        variant="danger"
      />
    </Layout>
  )
}
