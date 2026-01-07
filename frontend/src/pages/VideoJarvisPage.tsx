import { useState, useRef, useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { useStore } from '@/lib/store'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  Send,
  Sparkles,
  Zap,
  Clock,
  BookOpen,
  Search,
  FileText,
  Code
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Chapter {
  id: string
  title: string
  timestamp: number
  duration: number
  summary?: string
}

interface Message {
  id: string
  type: 'user' | 'jarvis'
  content: string
  timestamp: Date
  isLoading?: boolean
}

// Demo chapters
const DEMO_CHAPTERS: Chapter[] = [
  { id: '1', title: 'Introduction', timestamp: 0, duration: 120, summary: 'Overview of the topic' },
  { id: '2', title: 'Core Concepts', timestamp: 120, duration: 300, summary: 'Main ideas explained' },
  { id: '3', title: 'Practical Examples', timestamp: 420, duration: 240, summary: 'Real-world applications' },
  { id: '4', title: 'Advanced Topics', timestamp: 660, duration: 180, summary: 'Deep dive into details' },
]

// Demo messages
const DEMO_MESSAGES: Message[] = [
  {
    id: '1',
    type: 'jarvis',
    content: 'Hello! I\'m Jarvis, your AI assistant. I\'m here to help you understand this video better. Ask me anything!',
    timestamp: new Date(Date.now() - 60000),
  },
]

export default function VideoJarvisPage() {
  const { _user } = useStore()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, _setCurrentTime] = useState(0)
  const [duration] = useState(840) // 14 minutes
  const [jarvisStatus, setJarvisStatus] = useState<'Listening' | 'Analyzing' | 'Ready'>('Ready')
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES)
  const [inputMessage, setInputMessage] = useState('')
  const [jarvisPanelOpen, _setJarvisPanelOpen] = useState(true)
  const [jarvisFocusMode, setJarvisFocusMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-delete messages after 21 days
  useEffect(() => {
    const twentyOneDaysInMs = 21 * 24 * 60 * 60 * 1000;
    const interval = setInterval(() => {
      const now = Date.now();
      const filteredMessages = messages.filter(msg => {
        const messageAge = now - new Date(msg.timestamp).getTime();
        return messageAge < twentyOneDaysInMs;
      });
      if (filteredMessages.length < messages.length) {
        setMessages(filteredMessages);
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [messages])
  

  const playJarvisAudio = (soundName: string) => {
    if (audioRef.current) {
      audioRef.current.src = `/audio/jarvis/${soundName}.wav`
      audioRef.current.play().catch(e => console.log('Audio play failed:', e))
    }
  }

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
    }

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'jarvis',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    }

    setMessages([...messages, userMessage, loadingMessage])
    setInputMessage('')
    setJarvisStatus('Analyzing')
    playJarvisAudio('at_your_service')

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev =>
        prev.map(msg =>
          msg.isLoading
            ? {
                ...msg,
                content: 'Based on the current scene, I can help you understand the key concepts being discussed. Would you like me to create a summary or explain any specific part?',
                isLoading: false,
              }
            : msg
        )
      )
      setJarvisStatus('Ready')
    }, 2000)
  }

  const handleQuickAction = (prompt: string) => {
    setInputMessage(prompt)
    setTimeout(() => handleSendMessage(), 100)
  }

  const quickActions = [
    { icon: FileText, label: 'Summarize', action: () => handleQuickAction('Please summarize this video') },
    { icon: BookOpen, label: 'Explain Scene', action: () => handleQuickAction('Explain what\'s happening now') },
    { icon: Search, label: 'Find Similar', action: () => handleQuickAction('Find similar videos') },
    { icon: Code, label: 'Code Examples', action: () => handleQuickAction('Show code examples from this video') },
  ]

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Layout>
      <div className={cn(
        'min-h-screen bg-nebula stars-cosmic flex',
        jarvisFocusMode && 'jarvis-focus-mode'
      )}>
        <audio ref={audioRef} style={{ display: 'none' }} />
        
        {/* Main Content Area */}
        <div className={cn(
          'flex-1 p-6 transition-all duration-500',
          jarvisFocusMode && 'opacity-30 scale-95'
        )}>
          {/* Video Header */}
          <div className="mb-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold gradient-text mb-2">
                  Advanced React Patterns & Performance
                </h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatTime(duration)}
                  </span>
                  <span>•</span>
                  <span>4 chapters</span>
                  {jarvisStatus !== 'Ready' && (
                    <>
                      <span>•</span>
                      <span className="badge-cosmic flex items-center gap-1 animate-pulse">
                        <Sparkles className="w-3 h-3" />
                        AI {jarvisStatus}...
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setJarvisFocusMode(!jarvisFocusMode)
                  playJarvisAudio('system_diagnostic')
                }}
                className="btn-cosmic"
              >
                <Zap className="w-4 h-4 mr-2" />
                {jarvisFocusMode ? 'Exit' : 'Jarvis'} Focus
              </button>
            </div>
          </div>

          {/* Video Player */}
          <div className="card-cosmic glass-cosmic glow-cosmic rounded-2xl overflow-hidden gradient-border mb-6 animate-slide-in">
            <div className="relative bg-black aspect-video">
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-blue-900/50">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full gradient-aurora-animated flex items-center justify-center orb-glow">
                    <Play className="w-12 h-12 text-white" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">comming soon</p>
                  <p className="text-white/90 text-lg font-medium">Video Player</p>
                  <p className="text-white/60 text-sm">Demo mode - actual video integration pending</p>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="mb-4">
                  <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                    >
                      {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
                    </button>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                    >
                      {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                    </button>
                    <span className="text-white text-sm font-medium">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn-cosmic text-sm pulse-call" onClick={() => playJarvisAudio('welcome_sir')}>
                      <Sparkles className="w-4 h-4 mr-1" />
                      Ask Jarvis about this moment
                    </button>
                    <button className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
                      <Settings className="w-5 h-5 text-white" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
                      <Maximize className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Chapters Bar */}
          <div className="animate-slide-in" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI-Generated Chapters
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {DEMO_CHAPTERS.map((chapter, index) => (
                <div
                  key={chapter.id}
                  className="pill-card gradient-aurora shimmer-cosmic min-w-[200px] animate-slide-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-white">{chapter.title}</span>
                    <span className="text-xs text-white/70">{formatTime(chapter.timestamp)}</span>
                  </div>
                  {chapter.summary && (
                    <p className="text-xs text-white/80 line-clamp-1">{chapter.summary}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Jarvis AI Panel */}
        {jarvisPanelOpen && (
          <aside className={cn(
            'discord-sidebar slide-in-right glass-cosmic-dark',
            jarvisFocusMode && 'opacity-100 scale-100'
          )}>
            <div className="p-6 border-b border-border/30">
              <div className="flex items-center gap-4 mb-4">
                <div 
                  className="w-16 h-16 rounded-full gradient-cosmic-rainbow-animated flex items-center justify-center orb-glow cursor-pointer"
                  onClick={() => playJarvisAudio('rebooted')}
                >
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold gradient-text">Jarvis AI</h2>
                  <div className="badge-cosmic text-xs mt-1">
                    {jarvisStatus}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={cn(
                    'telegram-message message-in',
                    message.type === 'user' ? 'sent' : 'received'
                  )}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="skeleton-cosmic h-4 w-4 rounded-full" />
                      <div className="skeleton-cosmic h-4 w-32" />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <span className={cn(
                        'text-xs mt-1 block',
                        message.type === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground/70'
                      )}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border/30 space-y-3">
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={action.label}
                      onClick={action.action}
                      className="badge-cosmic flex items-center gap-1"
                    >
                      <Icon className="w-3 h-3" />
                      {action.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask Jarvis anything..."
                  className="input-cosmic flex-1"
                />
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Check file size (50 MB = 52428800 bytes)
                      const MAX_FILE_SIZE = 50 * 1024 * 1024;
                      if (file.size > MAX_FILE_SIZE) {
                        alert('File size exceeds 50 MB limit');
                      } else {
                        // You can add file upload logic here
                        console.log('File ready to upload:', file.name, file.size);
                      }
                    }
                  }}
                  className="hidden"
                  id="file-upload"
                  accept="*"
                />
                <label htmlFor="file-upload" className="cursor-pointer text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">
                  📎 Attach File (Max 50 MB)
                </label>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="btn-cosmic px-4"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </Layout>
  )
}
