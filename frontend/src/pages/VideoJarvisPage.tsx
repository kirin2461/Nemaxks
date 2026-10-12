import { useState, useRef, useEffect } from 'react'
import { Layout } from '@/components/Layout'
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
                <h1 className="text-3xl font-bold gradient-brand-text mb-2">
                  Продвинутые паттерны React и производительность
                </h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatTime(duration)}
                  </span>
                  <span>•</span>
                  <span>4 главы</span>
                  {jarvisStatus !== 'Ready' && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/25 animate-pulse">
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
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg gradient-brand text-primary-foreground font-medium shadow-soft hover:brightness-110 transition-all disabled:opacity-50"
              >
                <Zap className="w-4 h-4 mr-2" />
                {jarvisFocusMode ? 'Выйти из' : 'Jarvis'} фокуса
              </button>
            </div>
          </div>

          {/* Video Player */}
          <div className="glass rounded-2xl overflow-hidden shadow-glow mb-6 animate-slide-in">
            <div className="relative bg-black aspect-video">
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/10">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-brand flex items-center justify-center glow">
                    <Play className="w-12 h-12 text-white" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">скоро</p>
                  <p className="text-foreground/90 text-lg font-medium">Видеоплеер</p>
                  <p className="text-muted-foreground text-sm">Демо-режим — интеграция видео в разработке</p>
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
                    <button className="inline-flex items-center px-3 py-1.5 rounded-lg gradient-brand text-primary-foreground text-sm font-medium shadow-soft hover:brightness-110 transition-all pulse-call" onClick={() => playJarvisAudio('welcome_sir')}>
                      <Sparkles className="w-4 h-4 mr-1" />
                      Спросить Jarvis об этом моменте
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
              Главы, созданные AI
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {DEMO_CHAPTERS.map((chapter, index) => (
                <div
                  key={chapter.id}
                  className="glass rounded-xl px-4 py-3 min-w-[200px] animate-slide-in hover:border-accent/40 transition-colors"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-foreground">{chapter.title}</span>
                    <span className="text-xs text-accent">{formatTime(chapter.timestamp)}</span>
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
            'w-96 flex flex-col border-l border-border glass slide-in-right',
            jarvisFocusMode && 'opacity-100 scale-100'
          )}>
            <div className="p-6 border-b border-border/30">
              <div className="flex items-center gap-4 mb-4">
                <div 
                  className="w-16 h-16 rounded-full bg-gradient-brand flex items-center justify-center glow cursor-pointer"
                  onClick={() => playJarvisAudio('rebooted')}
                >
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold gradient-brand-text">Jarvis AI</h2>
                  <div className="inline-flex px-2.5 py-0.5 rounded-full text-xs mt-1 bg-accent/15 text-accent border border-accent/25">
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
                    'rounded-2xl px-4 py-2 max-w-[85%] break-words animate-slide-in',
                    message.type === 'user' ? 'bg-gradient-brand text-primary-foreground ml-auto shadow-soft' : 'glass mr-auto'
                  )}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-accent/40 animate-pulse" />
                      <div className="h-4 w-32 rounded bg-accent/20 animate-pulse" />
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs glass hover:bg-accent/15 hover:text-accent transition-colors"
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
                        alert('Размер файла превышает лимит 50 МБ');
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
                <label htmlFor="file-upload" className="cursor-pointer text-accent hover:text-accent/80 text-sm mt-2 inline-block">
                  📎 Прикрепить файл (макс. 50 МБ)
                </label>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg gradient-brand text-primary-foreground font-medium shadow-soft hover:brightness-110 transition-all disabled:opacity-50 !px-4"
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
