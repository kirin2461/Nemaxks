import { useState, useRef, useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { useToast } from '@/components/Toast'
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
  { id: '1', title: 'Введение', timestamp: 0, duration: 120, summary: 'Обзор темы' },
  { id: '2', title: 'Ключевые концепции', timestamp: 120, duration: 300, summary: 'Разбор основных идей' },
  { id: '3', title: 'Практические примеры', timestamp: 420, duration: 240, summary: 'Реальные применения' },
  { id: '4', title: 'Продвинутые темы', timestamp: 660, duration: 180, summary: 'Глубокое погружение в детали' },
]

// Demo messages
const DEMO_MESSAGES: Message[] = [
  {
    id: '1',
    type: 'jarvis',
    content: 'Здравствуйте! Я Jarvis, ваш AI-ассистент. Помогу разобраться в этом видео. Спрашивайте о чём угодно!',
    timestamp: new Date(Date.now() - 60000),
  },
]

export default function VideoJarvisPage() {
  const toast = useToast()
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
      audioRef.current.src = `/jarvis-audio/${soundName}.wav`
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
                content: 'Основываясь на текущей сцене, я могу помочь разобраться в обсуждаемых концепциях. Создать краткое содержание или объяснить конкретный фрагмент?',
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
    { icon: FileText, label: 'Краткое содержание', action: () => handleQuickAction('Сделай краткое содержание видео') },
    { icon: BookOpen, label: 'Объясни сцену', action: () => handleQuickAction('Объясни, что происходит сейчас') },
    { icon: Search, label: 'Похожие видео', action: () => handleQuickAction('Найди похожие видео') },
    { icon: Code, label: 'Примеры кода', action: () => handleQuickAction('Покажи примеры кода из видео') },
  ]

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Layout>
      <div className={cn(
        'min-h-screen bg-background flex',
        jarvisFocusMode && 'jarvis-focus-mode'
      )}>
        <audio ref={audioRef} style={{ display: 'none' }} />

        {/* Main Content Area */}
        <div className={cn(
          'flex-1 p-6 transition-all duration-300',
          jarvisFocusMode && 'opacity-30 scale-95'
        )}>
          {/* Video Header */}
          <div className="mb-6 animate-rise-in">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-display font-bold text-graphite-900 mb-2">
                  Продвинутые паттерны React и производительность
                </h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-4 h-4" />
                    {formatTime(duration)}
                  </span>
                  <span>•</span>
                  <span>4 главы</span>
                  {jarvisStatus !== 'Ready' && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
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
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                {jarvisFocusMode ? 'Выйти из' : 'Jarvis'} фокуса
              </button>
            </div>
          </div>

          {/* Video Player */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-soft mb-6 animate-rise-in">
            <div className="relative bg-graphite-950 aspect-video">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-emerald-600 flex items-center justify-center">
                    <Play className="w-12 h-12 text-white" />
                  </div>
                  <p className="text-xs text-graphite-400 mt-1">скоро</p>
                  <p className="text-white/90 text-lg font-medium">Видеоплеер</p>
                  <p className="text-graphite-400 text-sm">Демо-режим — интеграция видео в разработке</p>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-graphite-950/80 p-4">
                <div className="mb-4">
                  <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-150"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-150"
                    >
                      {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
                    </button>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-150"
                    >
                      {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                    </button>
                    <span className="text-white text-sm font-medium font-mono">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:scale-[0.97] transition-all duration-150" onClick={() => playJarvisAudio('welcome_sir')}>
                      <Sparkles className="w-4 h-4" />
                      Спросить Jarvis об этом моменте
                    </button>
                    <button className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-150">
                      <Settings className="w-5 h-5 text-white" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-150">
                      <Maximize className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Chapters Bar */}
          <div className="animate-rise-in" style={{ animationDelay: '80ms' }}>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              Главы, созданные AI
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {DEMO_CHAPTERS.map((chapter, index) => (
                <div
                  key={chapter.id}
                  className="rounded-xl border border-border bg-card shadow-soft px-4 py-3 min-w-[200px] animate-rise-in hover:border-graphite-300 transition-colors duration-150"
                  style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-foreground">{chapter.title}</span>
                    <span className="text-xs font-mono text-primary">{formatTime(chapter.timestamp)}</span>
                  </div>
                  {chapter.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{chapter.summary}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Jarvis AI Panel */}
        {jarvisPanelOpen && (
          <aside className={cn(
            'w-[360px] flex flex-col border-l border-border bg-card animate-slide-in-right',
            jarvisFocusMode && 'opacity-100 scale-100'
          )}>
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform duration-150"
                  onClick={() => playJarvisAudio('rebooted')}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-display font-bold text-graphite-900">Jarvis AI</h2>
                  <div className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-0.5 bg-emerald-100 text-emerald-800">
                    {jarvisStatus}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={cn(
                    'rounded-2xl px-3.5 py-2 max-w-[85%] break-words text-[15px] leading-6 shadow-soft',
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto rounded-br-[6px] animate-msg-send'
                      : 'bg-card border border-border border-l-2 border-l-emerald-600 mr-auto rounded-bl-[6px] animate-msg-receive'
                  )}
                  style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                >
                  {message.isLoading ? (
                    <div className="flex items-center gap-1 py-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-600 animate-typing-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-emerald-600 animate-typing-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-emerald-600 animate-typing-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <span className={cn(
                        'text-[11px] mt-1 block font-mono',
                        message.type === 'user' ? 'text-emerald-100/80' : 'text-muted-foreground'
                      )}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border space-y-3 bg-card">
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={action.label}
                      onClick={action.action}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 transition-all duration-150"
                    >
                      <Icon className="w-3 h-3" />
                      {action.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Спросите Jarvis о чём угодно..."
                  className="input-field flex-1"
                />
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Check file size (50 MB = 52428800 bytes)
                      const MAX_FILE_SIZE = 50 * 1024 * 1024;
                      if (file.size > MAX_FILE_SIZE) {
                        toast.error('Размер файла превышает лимит 50 МБ');
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
                <label htmlFor="file-upload" className="cursor-pointer text-primary underline-offset-4 hover:underline text-xs whitespace-nowrap">
                  📎 Прикрепить (макс. 50 МБ)
                </label>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none shrink-0"
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
