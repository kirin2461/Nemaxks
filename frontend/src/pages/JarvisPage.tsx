import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'wouter'
import { Layout } from '@/components/Layout'
import { premiumAPI, type JarvisQuota } from '@/lib/api'
import {
  Send,
  Sparkles,
  FileText,
  Code,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  History,
  Trash2,
  Copy,
  RefreshCw,
  Bot,
  User,
  Lightbulb,
  BookOpen,
  Calculator,
  Globe,
  Zap,
  Activity,
  Radio,
  Crown
} from 'lucide-react'
import { cn } from '@/lib/utils'

type JarvisLanguage = 'en' | 'ru'

const JARVIS_AUDIO_FILES = {
  // FIXED (per requirements): welcome greeting
  greetings: [
    '/jarvis-audio/Мы работаем над проектом сэр 2.wav',
  ],
  acknowledgments: [
    '/jarvis-audio/Да сэр.wav',
    '/jarvis-audio/Да сэр(второй).wav',
    '/jarvis-audio/Есть.wav',
    '/jarvis-audio/Как пожелаете .wav',
  ],
  thinking: [
    '/jarvis-audio/Загружаю сэр.wav',
    '/jarvis-audio/Начинаю диагностику системы.wav',
    '/jarvis-audio/Начинаю диагностику системы (второй).wav',
  ],
  // FIXED (per requirements): standard answer audio after each successful reply
  complete: [
    '/jarvis-audio/Я провел симуляции со всеми известными элементами.wav',
  ],
  // FIXED (per requirements): error audio
  errors: [
    '/jarvis-audio/К сожалению его невозможно синтезировать.wav',
  ],
  witty: [
    '/jarvis-audio/Очень тонкое замечание сэр.wav',
    '/jarvis-audio/Поздравляю сэр.wav',
    '/jarvis-audio/О чем я думал, обычно у нас все веселенькое.wav',
    '/jarvis-audio/Да, это поможет вам оставаться незамеченным.wav',
  ],
  status: [
    '/jarvis-audio/Мы подключены и готовы.wav',
    '/jarvis-audio/Мы работаем над проектом сэр 2.wav',
    '/jarvis-audio/Реактор принял модифицированное ядро.wav',
  ],
  misc: [
    '/jarvis-audio/Чего вы пытаетесь добиться сэр.wav',
    '/jarvis-audio/Сэр, не будете дергаться больно не будет.wav',
    '/jarvis-audio/Начинаю автоматическую сборку.wav',
    '/jarvis-audio/Импортирую установки, начинаю калибровку виртуальной среды.wav',
    '/jarvis-audio/Создать визуальный образ по новым спецификациям.wav',
    '/jarvis-audio/Предлагаемый элемент может стать безвредной заменой палладию.wav',
    '/jarvis-audio/Вы создали новый элемент.wav',
  ],
}

const getRandomAudioFile = (category: keyof typeof JARVIS_AUDIO_FILES): string => {
  const files = JARVIS_AUDIO_FILES[category]
  return files[Math.floor(Math.random() * files.length)]
}

const JARVIS_PHRASES = {
  en: {
    greetings: [
      "Good day, Sir. I'm J.A.R.V.I.S., at your service.",
      "Welcome back, Sir. All systems operational.",
      "For you, Sir, always. How may I assist?",
      "At your service, Sir. I've been running diagnostics.",
    ],
    acknowledgments: [
      "Very well, Sir.",
      "As you wish, Sir.",
      "Right away, Sir.",
      "Understood, Sir.",
      "Of course, Sir.",
    ],
    thinking: [
      "Processing your request, Sir.",
      "Analyzing, Sir. One moment.",
      "Running calculations, Sir.",
      "Accessing data, Sir.",
    ],
    complete: [
      "Task complete, Sir.",
      "All wrapped up here, Sir.",
      "Will there be anything else?",
      "The analysis is ready, Sir.",
    ],
    errors: [
      "I apologize, Sir. Systems temporarily unavailable.",
      "A minor setback, Sir. Attempting to reconnect.",
      "I'm experiencing technical difficulties, Sir.",
    ],
    witty: [
      "As always, Sir, a great pleasure watching you work.",
      "I've prepared a briefing for you to entirely ignore.",
      "A very astute observation, Sir.",
      "I wouldn't recommend that, Sir, but I know you'll do it anyway.",
    ],
  },
  ru: {
    greetings: [
      "Добрый день, сэр. Я Д.Ж.А.Р.В.И.С., к вашим услугам.",
      "С возвращением, сэр. Все системы в норме.",
      "Для вас, сэр, всегда. Чем могу помочь?",
      "К вашим услугам, сэр. Я проводил диагностику.",
    ],
    acknowledgments: [
      "Хорошо, сэр.",
      "Как пожелаете, сэр.",
      "Сейчас же, сэр.",
      "Понял, сэр.",
      "Разумеется, сэр.",
    ],
    thinking: [
      "Обрабатываю ваш запрос, сэр.",
      "Анализирую, сэр. Минутку.",
      "Произвожу расчёты, сэр.",
      "Получаю данные, сэр.",
    ],
    complete: [
      "Задача выполнена, сэр.",
      "Здесь всё готово, сэр.",
      "Что-нибудь ещё, сэр?",
      "Анализ готов, сэр.",
    ],
    errors: [
      "Приношу извинения, сэр. Системы временно недоступны.",
      "Небольшая неполадка, сэр. Пытаюсь переподключиться.",
      "У меня возникли технические сложности, сэр.",
    ],
    witty: [
      "Как всегда, сэр, большое удовольствие наблюдать за вашей работой.",
      "Я подготовил инструкцию, которую вы проигнорируете.",
      "Очень тонкое замечание, сэр.",
      "Я бы не рекомендовал это, сэр, но знаю, что вы всё равно это сделаете.",
    ],
  },
}

const getRandomPhrase = (category: keyof typeof JARVIS_PHRASES.en, lang: JarvisLanguage) => {
  const phrases = JARVIS_PHRASES[lang][category]
  return phrases[Math.floor(Math.random() * phrases.length)]
}

interface Message {
  id: string
  type: 'user' | 'jarvis'
  content: string
  timestamp: Date
  isLoading?: boolean
  provider?: string
  model?: string
}

interface Capability {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  examples: string[]
}

interface JarvisStatus {
  deepseek_available: boolean
  huggingface_available: boolean
  tokens_used: number
  token_limit: number
  active_provider: string
}

const CAPABILITIES: Capability[] = [
  {
    id: 'code',
    name: 'Помощь с кодом',
    icon: <Code className="w-6 h-6" />,
    description: 'Написание, ревью и отладка кода',
    examples: ['Напиши React-компонент', 'Отладь мою функцию', 'Объясни этот код']
  },
  {
    id: 'search',
    name: 'Поиск в сети',
    icon: <Globe className="w-6 h-6" />,
    description: 'Поиск и краткое изложение информации',
    examples: ['Что такое квантовые вычисления?', 'Последние новости об ИИ', 'Исследуй тему']
  },
  {
    id: 'write',
    name: 'Написание текстов',
    icon: <FileText className="w-6 h-6" />,
    description: 'Статьи, письма и документы',
    examples: ['Напиши письмо', 'Создай пост для блога', 'Сожми этот текст']
  },
  {
    id: 'analyze',
    name: 'Анализ данных',
    icon: <Calculator className="w-6 h-6" />,
    description: 'Анализ данных и выводы',
    examples: ['Проанализируй данные', 'Построй график', 'Найди закономерности']
  },
  {
    id: 'create',
    name: 'Креативные идеи',
    icon: <Lightbulb className="w-6 h-6" />,
    description: 'Мозговой штурм и генерация идей',
    examples: ['Идеи для стартапа', 'Предложи названия', 'Креативные решения']
  },
  {
    id: 'learn',
    name: 'Помощь в обучении',
    icon: <BookOpen className="w-6 h-6" />,
    description: 'Объяснение концепций и обучение',
    examples: ['Объясни машинное обучение', 'Научи меня Python', 'Устрой quiz по истории']
  },
]

const QUICK_PROMPTS = [
  'Напиши React-компонент для списка задач',
  'Объясни, как работает блокчейн',
  'Помоги отладить этот код',
  'Сгенерируй 5 бизнес-идей',
  'Кратко изложи последние новости об ИИ',
  'Составь дорожную карту проекта',
]

const API_BASE = (import.meta as any).env?.VITE_API_URL || ''

export default function JarvisPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [jarvisStatus, setJarvisStatus] = useState<'Ready' | 'Listening' | 'Thinking' | 'Speaking'>('Ready')
  const [showCapabilities, setShowCapabilities] = useState(true)
  const [aiStatus, setAiStatus] = useState<JarvisStatus | null>(null)
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([])
  const [language] = useState<JarvisLanguage>('ru')
  const [jarvisVoice, setJarvisVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [alwaysListening, setAlwaysListening] = useState(false)
  const [awaitingCommand, setAwaitingCommand] = useState(false)
  const [pendingAction, setPendingAction] = useState<{
    type: 'message' | 'call' | null
    contact?: string
    messageTime?: string
  }>({ type: null })
  const [showSettings, setShowSettings] = useState(false)
  const [quota, setQuota] = useState<JarvisQuota | null>(null)
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const alwaysListenRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isMutedRef = useRef(false)
  const alwaysListeningRef = useRef(false)
  const recognitionTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    alwaysListeningRef.current = alwaysListening
  }, [alwaysListening])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const findBestVoice = useCallback((lang: JarvisLanguage) => {
    if (!synthRef.current) return null
    const voices = synthRef.current.getVoices()
    
    if (lang === 'en') {
      const preferredVoices = ['Daniel', 'George', 'Google UK English Male', 'Microsoft George']
      for (const name of preferredVoices) {
        const voice = voices.find(v => v.name.includes(name) && v.lang.includes('en-GB'))
        if (voice) return voice
      }
      return voices.find(v => v.lang.includes('en-GB')) || voices.find(v => v.lang.startsWith('en'))
    } else {
      const preferredVoices = ['Dmitri', 'Maxim', 'Pavel', 'Google русский', 'Microsoft Pavel']
      for (const name of preferredVoices) {
        const voice = voices.find(v => v.name.includes(name))
        if (voice) return voice
      }
      return voices.find(v => v.lang.includes('ru'))
    }
  }, [])

  useEffect(() => {
    synthRef.current = window.speechSynthesis
    
    const loadVoices = () => {
      const voice = findBestVoice(language)
      setJarvisVoice(voice || null)
    }
    
    loadVoices()
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices
    }
    
    fetchAiStatus()
    fetchQuota()

    const welcomeMessage: Message = {
      id: '1',
      type: 'jarvis',
      content: language === 'ru' 
        ? "К вашим услугам, сэр. Я Д.Ж.А.Р.В.И.С."
        : getRandomPhrase('greetings', language),
      timestamp: new Date(),
    }
    setMessages([welcomeMessage])
    
    setTimeout(() => {
      if (language === 'ru' && !isMutedRef.current) {
        const audio = new Audio(getRandomAudioFile('greetings'))
        audio.play().catch(err => console.log('Initial audio blocked:', err))
      }
    }, 500)
  }, [])

  useEffect(() => {
    const voice = findBestVoice(language)
    setJarvisVoice(voice || null)
  }, [language, findBestVoice])

  useEffect(() => {
    const twentyOneDaysInMs = 21 * 24 * 60 * 60 * 1000
    const interval = setInterval(() => {
      const now = Date.now()
      setMessages(prev => prev.filter(msg => {
        const messageAge = now - new Date(msg.timestamp).getTime()
        return messageAge < twentyOneDaysInMs
      }))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchAiStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/jarvis/status`)
      if (response.ok) {
        const data = await response.json()
        setAiStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch AI status:', error)
    }
  }

  const fetchQuota = async () => {
    try {
      const data = await premiumAPI.getQuota()
      setQuota(data)
      if (data.remaining > 0) {
        setQuotaExceeded(false)
      }
    } catch (error) {
      // Пользователь не авторизован или эндпоинт недоступен — просто не показываем счётчик
      console.error('Failed to fetch Jarvis quota:', error)
    }
  }

  const playJarvisAudio = useCallback((category: keyof typeof JARVIS_AUDIO_FILES) => {
    if (isMutedRef.current || isAudioPlaying) return
    
    const audioFile = getRandomAudioFile(category)
    
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    
    const audio = new Audio(audioFile)
    audioRef.current = audio
    
    audio.onplay = () => {
      setIsAudioPlaying(true)
      setJarvisStatus('Speaking')
    }
    
    audio.onended = () => {
      setIsAudioPlaying(false)
      setJarvisStatus('Ready')
    }
    
    audio.onerror = () => {
      setIsAudioPlaying(false)
      setJarvisStatus('Ready')
      console.error('Failed to play audio:', audioFile)
    }
    
    if (isMutedRef.current) {
      audioRef.current = null
      return
    }
    
    audio.play().catch(err => {
      console.error('Audio playback error:', err)
      setIsAudioPlaying(false)
    })
  }, [isAudioPlaying])

  const speakText = useCallback((text: string) => {
    if (isMutedRef.current) return
    
    if (language === 'ru') {
      const lowerText = text.toLowerCase()
      if (lowerText.includes('приветств') || lowerText.includes('добрый') || lowerText.includes('услуг')) {
        playJarvisAudio('greetings')
      } else if (lowerText.includes('да') || lowerText.includes('понял') || lowerText.includes('хорошо')) {
        playJarvisAudio('acknowledgments')
      } else if (lowerText.includes('загруж') || lowerText.includes('обрабатыв') || lowerText.includes('анализ')) {
        playJarvisAudio('thinking')
      } else if (lowerText.includes('выполнен') || lowerText.includes('завершен') || lowerText.includes('готов')) {
        playJarvisAudio('complete')
      } else if (lowerText.includes('ошибк') || lowerText.includes('недоступн')) {
        playJarvisAudio('errors')
      } else {
        playJarvisAudio('witty')
      }
      return
    }
    
    if (!synthRef.current) return
    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    
    if (jarvisVoice) {
      utterance.voice = jarvisVoice
    }
    
    utterance.lang = 'en-GB'
    utterance.pitch = 0.85
    utterance.rate = 0.92
    utterance.volume = 1.0

    utterance.onstart = () => setJarvisStatus('Speaking')
    utterance.onend = () => setJarvisStatus('Ready')
    utterance.onerror = () => setJarvisStatus('Ready')

    synthRef.current.speak(utterance)
  }, [jarvisVoice, language, playJarvisAudio])

  const speakCategory = useCallback((category: keyof typeof JARVIS_AUDIO_FILES) => {
    if (isMutedRef.current) return
    if (language === 'ru') {
      playJarvisAudio(category)
    } else {
      const categoryMap: Record<keyof typeof JARVIS_AUDIO_FILES, keyof typeof JARVIS_PHRASES.en> = {
        greetings: 'greetings',
        acknowledgments: 'acknowledgments',
        thinking: 'thinking',
        complete: 'complete',
        errors: 'errors',
        witty: 'witty',
        status: 'complete',
        misc: 'witty',
      }
      const phrase = getRandomPhrase(categoryMap[category], language)
      speakText(phrase)
    }
  }, [language, playJarvisAudio, speakText])

  const handleSendMessage = async (content?: string) => {
    const messageContent = content || inputMessage.trim()
    if (!messageContent) return
    if (quotaExceeded && !quota?.premium) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageContent,
      timestamp: new Date(),
    }

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'jarvis',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    }

    setMessages(prev => [...prev, userMessage, loadingMessage])
    setInputMessage('')
    setJarvisStatus('Thinking')
    setShowCapabilities(false)
    
    if (!isMutedRef.current) {
      speakCategory('thinking')
    }

    const newHistory = [
      ...conversationHistory,
      { role: 'user', content: messageContent }
    ]

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/api/jarvis/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: messageContent,
          history: newHistory.slice(-10)
        })
      })

      if (response.status === 429) {
        let quotaError: any = null
        try {
          quotaError = await response.json()
        } catch {
          quotaError = null
        }
        if (quotaError?.error === 'quota_exceeded') {
          setQuota({
            limit: quotaError.limit ?? quota?.limit ?? 0,
            used: quotaError.used ?? quota?.used ?? 0,
            remaining: 0,
            premium: !!quotaError.premium,
          })
        }
        setQuotaExceeded(true)
        setMessages(prev => prev.filter(msg => !msg.isLoading))
        setJarvisStatus('Ready')
        if (!isMutedRef.current && language === 'ru') {
          speakCategory('errors')
        }
        return
      }

      if (!response.ok) {
        throw new Error('AI service unavailable')
      }

      const data = await response.json()

      if (data.quota) {
        setQuota(data.quota)
      }

      setConversationHistory([
        ...newHistory,
        { role: 'assistant', content: data.response }
      ])

      setMessages(prev =>
        prev.map(msg =>
          msg.isLoading
            ? { 
                ...msg, 
                content: data.response, 
                isLoading: false,
                provider: data.provider,
                model: data.model
              }
            : msg
        )
      )

      if (!isMutedRef.current && language === 'ru') {
        speakCategory('complete')
      } else if (!isMutedRef.current) {
        speakText(data.response)
      } else {
        setJarvisStatus('Ready')
      }

      fetchAiStatus()

    } catch (error) {
      console.error('AI request failed:', error)
      
      const isRussian = messageContent.match(/[а-яА-ЯёЁ]/)
      
      const fallbackResponses = isRussian ? [
        "Приношу извинения, сэр. Похоже, связь с AI системами временно недоступна. Попробуем ещё раз через мгновение?",
        "Боюсь, у меня возникли технические неполадки, сэр. Мои нейронные сети, похоже, отключены.",
        "Мои извинения, сэр. AI сервис в данный момент недоступен. Желаете, чтобы я попытался переподключиться?",
        "К сожалению, сэр, системы временно недоступны. Как всегда, сэр, я делаю всё возможное.",
      ] : [
        "I apologize, Sir. It appears my connection to the AI systems is temporarily unavailable. Perhaps we could try again in a moment?",
        "I'm afraid I'm experiencing some technical difficulties at the moment, Sir. My neural networks seem to be offline.",
        "My apologies, Sir. The AI service is currently unreachable. Shall I attempt to reconnect?",
        "A minor setback, Sir. The systems are temporarily unavailable. As always, I'm doing everything I can.",
      ]
      const fallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]

      setMessages(prev =>
        prev.map(msg =>
          msg.isLoading
            ? { ...msg, content: fallback, isLoading: false }
            : msg
        )
      )
      setJarvisStatus('Ready')
      if (!isMutedRef.current && language === 'ru') {
        speakCategory('errors')
      } else if (!isMutedRef.current) {
        speakText(fallback)
      }
    }
  }

  const parseVoiceCommand = useCallback((transcript: string) => {
    const lowerText = transcript.toLowerCase()
    
    if (lowerText.includes('написать') || lowerText.includes('напиши') || lowerText.includes('отправить') || lowerText.includes('отправь')) {
      const contactMatch = transcript.match(/(?:написать|напиши|отправить|отправь)\s+(?:пользователю\s+)?(.+?)(?:\s+сообщение|\s+текст|$)/i)
      if (contactMatch && contactMatch[1]) {
        const contact = contactMatch[1].trim()
        setPendingAction({ type: 'message', contact })
        return { 
          action: 'request_message', 
          response: `Хорошо, сэр. Что передать пользователю ${contact}?`
        }
      }
      return { 
        action: 'request_contact', 
        response: 'Кому отправить сообщение, сэр?'
      }
    }
    
    if (lowerText.includes('ответить') || lowerText.includes('ответь') || lowerText.includes('поднять трубку') || lowerText.includes('принять звонок')) {
      return { 
        action: 'answer_call', 
        response: 'Принимаю звонок, сэр.'
      }
    }
    
    if (lowerText.includes('последнее сообщение') || lowerText.includes('новые сообщения') || lowerText.includes('непрочитанные')) {
      return { 
        action: 'check_messages', 
        response: 'Проверяю входящие сообщения, сэр.'
      }
    }
    
    if (lowerText.includes('сколько') && lowerText.includes('сообщений')) {
      return { 
        action: 'count_messages', 
        response: 'Анализирую количество сообщений, сэр.'
      }
    }
    
    return null
  }, [])

  const sendMessageViaJarvis = useCallback(async (contact: string, messageText: string) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        return 'Сэр, вы не авторизованы. Пожалуйста, войдите в систему.'
      }
      
      const searchResponse = await fetch(`${API_BASE}/api/users/search?q=${encodeURIComponent(contact)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!searchResponse.ok) {
        return `Не удалось найти пользователя ${contact}, сэр.`
      }
      
      const users = await searchResponse.json()
      if (!users || users.length === 0) {
        return `Пользователь ${contact} не найден, сэр.`
      }
      
      const targetUser = users[0]
      
      const sendResponse = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          to_user_id: String(targetUser.id),
          content: messageText
        })
      })
      
      if (sendResponse.ok) {
        return `Сообщение отправлено пользователю ${targetUser.username}, сэр.`
      } else {
        return 'Не удалось отправить сообщение, сэр. Попробуйте позже.'
      }
    } catch {
      return 'Произошла ошибка при отправке сообщения, сэр.'
    }
  }, [])

  const handleAlwaysListenResult = useCallback(async (transcript: string) => {
    const lowerText = transcript.toLowerCase()
    
    if (pendingAction.type === 'message' && pendingAction.contact) {
      const result = await sendMessageViaJarvis(pendingAction.contact, transcript)
      
      const jarvisMessage: Message = {
        id: Date.now().toString(),
        type: 'jarvis',
        content: result,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, jarvisMessage])
      setPendingAction({ type: null })
      setAwaitingCommand(false)
      
      if (!isMutedRef.current) {
        playJarvisAudio('complete')
      }
      return
    }
    
    if (lowerText.includes('джарвис')) {
      setAwaitingCommand(true)
      if (!isMutedRef.current) {
        playJarvisAudio('greetings')
      }
      
      const cleanCommand = transcript.replace(/джарвис[,.]?\s*/i, '').trim()
      
      if (cleanCommand.length > 3) {
        const command = parseVoiceCommand(cleanCommand)
        if (command) {
          const jarvisMessage: Message = {
            id: Date.now().toString(),
            type: 'jarvis',
            content: command.response,
            timestamp: new Date(),
          }
          setMessages(prev => [...prev, jarvisMessage])
          
          if (!isMutedRef.current) {
            playJarvisAudio('acknowledgments')
          }
        } else {
          handleSendMessage(cleanCommand)
        }
      } else {
        const jarvisMessage: Message = {
          id: Date.now().toString(),
          type: 'jarvis',
          content: 'Слушаю вас, сэр. Чем могу помочь?',
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, jarvisMessage])
      }
      return
    }
    
    if (awaitingCommand) {
      const command = parseVoiceCommand(transcript)
      if (command) {
        const jarvisMessage: Message = {
          id: Date.now().toString(),
          type: 'jarvis',
          content: command.response,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, jarvisMessage])
        
        if (!isMutedRef.current) {
          playJarvisAudio('acknowledgments')
        }
        
        if (command.action !== 'request_message' && command.action !== 'request_contact') {
          setAwaitingCommand(false)
        }
      } else {
        handleSendMessage(transcript)
        setAwaitingCommand(false)
      }
    }
  }, [pendingAction, awaitingCommand, parseVoiceCommand, sendMessageViaJarvis, playJarvisAudio, handleSendMessage])

  const startAlwaysListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Распознавание речи не поддерживается в вашем браузере')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'ru-RU'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onstart = () => {
      setAlwaysListening(true)
    }

    recognition.onresult = (event: any) => {
      if (!alwaysListeningRef.current) return
      const lastResult = event.results[event.results.length - 1]
      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript
        console.log('Heard:', transcript)
        handleAlwaysListenResult(transcript)
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        if (recognitionTimerRef.current) {
          clearTimeout(recognitionTimerRef.current)
        }
        recognitionTimerRef.current = setTimeout(() => {
          if (alwaysListeningRef.current && alwaysListenRef.current) {
            try {
              alwaysListenRef.current.start()
            } catch {
              console.log('Recognition restart failed')
            }
          }
        }, 1000)
      }
    }

    recognition.onend = () => {
      if (alwaysListeningRef.current) {
        if (recognitionTimerRef.current) {
          clearTimeout(recognitionTimerRef.current)
        }
        recognitionTimerRef.current = setTimeout(() => {
          if (alwaysListeningRef.current) {
            try {
              recognition.start()
            } catch {
              console.log('Recognition restart failed')
            }
          }
        }, 100)
      }
    }

    alwaysListenRef.current = recognition
    recognition.start()
  }, [alwaysListening, handleAlwaysListenResult])

  const stopAlwaysListening = useCallback(() => {
    alwaysListeningRef.current = false
    if (recognitionTimerRef.current) {
      clearTimeout(recognitionTimerRef.current)
      recognitionTimerRef.current = null
    }
    setAlwaysListening(false)
    setAwaitingCommand(false)
    setPendingAction({ type: null })
    if (alwaysListenRef.current) {
      alwaysListenRef.current.onend = null
      alwaysListenRef.current.onerror = null
      alwaysListenRef.current.onresult = null
      alwaysListenRef.current.stop()
      alwaysListenRef.current = null
    }
  }, [])

  const toggleAlwaysListening = useCallback(() => {
    if (alwaysListening) {
      stopAlwaysListening()
      const jarvisMessage: Message = {
        id: Date.now().toString(),
        type: 'jarvis',
        content: 'Режим постоянного прослушивания отключён, сэр.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, jarvisMessage])
    } else {
      startAlwaysListening()
      const jarvisMessage: Message = {
        id: Date.now().toString(),
        type: 'jarvis',
        content: 'Режим постоянного прослушивания активирован. Скажите "Джарвис" чтобы начать команду.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, jarvisMessage])
      if (!isMutedRef.current) {
        playJarvisAudio('status')
      }
    }
  }, [alwaysListening, startAlwaysListening, stopAlwaysListening, playJarvisAudio])

  const toggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Распознавание речи не поддерживается в вашем браузере')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      setJarvisStatus('Ready')
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.lang = 'ru-RU'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsListening(true)
        setJarvisStatus('Listening')
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInputMessage(transcript)
        setIsListening(false)
        setJarvisStatus('Ready')
        handleSendMessage(transcript)
      }

      recognition.onerror = () => {
        setIsListening(false)
        setJarvisStatus('Ready')
      }

      recognition.onend = () => {
        setIsListening(false)
        if (jarvisStatus === 'Listening') {
          setJarvisStatus('Ready')
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    }
  }

  const clearChat = () => {
    const clearMessage = language === 'en' 
      ? "Very well, Sir. I've cleared our conversation history." 
      : "Хорошо, сэр. Я очистил историю нашего разговора."
    
    setMessages([{
      id: Date.now().toString(),
      type: 'jarvis',
      content: clearMessage,
      timestamp: new Date(),
    }])
    setConversationHistory([])
    setShowCapabilities(true)
    
    if (!isMutedRef.current) {
      speakCategory('acknowledgments')
    }
  }

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const regenerateResponse = (messageId: string) => {
    const index = messages.findIndex(m => m.id === messageId)
    if (index > 0) {
      const userMessage = messages[index - 1]
      if (userMessage.type === 'user') {
        setMessages(prev => prev.filter((_, i) => i !== index))
        setTimeout(() => handleSendMessage(userMessage.content), 100)
      }
    }
  }

  const toggleMute = () => {
    if (!isMuted) {
      if (synthRef.current) {
        synthRef.current.cancel()
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      setIsAudioPlaying(false)
      setJarvisStatus('Ready')
    }
    setIsMuted(!isMuted)
  }

  return (
    <Layout>
      <div className="h-screen flex">
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border glass">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500',
                  jarvisStatus === 'Ready' && 'bg-gradient-brand glow',
                  jarvisStatus === 'Listening' && 'bg-gradient-to-br from-accent to-emerald-400 animate-pulse glow',
                  jarvisStatus === 'Thinking' && 'bg-gradient-to-br from-yellow-400 to-orange-500 animate-spin-slow',
                  jarvisStatus === 'Speaking' && 'bg-gradient-to-br from-primary to-accent pulse-call'
                )}>
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">J.A.R.V.I.S.</h1>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className={cn(
                      'w-2 h-2 rounded-full',
                      jarvisStatus === 'Ready' && 'bg-accent',
                      jarvisStatus === 'Listening' && 'bg-accent animate-pulse',
                      jarvisStatus === 'Thinking' && 'bg-yellow-400 animate-pulse',
                      jarvisStatus === 'Speaking' && 'bg-primary animate-pulse'
                    )} />
                    {jarvisStatus}
                    {aiStatus && (
                      <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
                        {aiStatus.active_provider === 'deepseek' && <Zap className="w-3 h-3 inline mr-1" />}
                        {aiStatus.active_provider === 'huggingface' && <Activity className="w-3 h-3 inline mr-1" />}
                        {aiStatus.active_provider || 'offline'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAlwaysListening}
                  className={cn(
                    "p-2 rounded-lg transition-colors flex items-center gap-1",
                    alwaysListening 
                      ? "bg-accent/15 text-accent hover:bg-accent/25" 
                      : "hover:bg-primary/10"
                  )}
                  title={alwaysListening ? "Отключить постоянное прослушивание" : "Включить постоянное прослушивание"}
                >
                  <Radio className={cn("w-5 h-5", alwaysListening && "animate-pulse")} />
                  {alwaysListening && <span className="text-xs font-medium">LIVE</span>}
                </button>
                <button
                  onClick={toggleMute}
                  className={cn(
                    "p-2 rounded-lg hover:bg-primary/10 transition-colors",
                    isMuted && "text-red-400"
                  )}
                  title={isMuted ? "Включить звук" : "Выключить звук"}
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => fetchAiStatus()}
                  className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
                  title="Обновить статус"
                >
                  <History className="w-5 h-5" />
                </button>
                <button
                  onClick={clearChat}
                  className="p-2 rounded-lg hover:bg-red-500/15 hover:text-red-400 transition-colors"
                  title="Очистить чат"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    showSettings ? "bg-primary/15 text-primary" : "hover:bg-primary/10"
                  )}
                  title="Настройки"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>

            {alwaysListening && (
              <div className="mt-3 p-2 rounded-lg bg-accent/10 border border-accent/25">
                <div className="flex items-center gap-2 text-sm text-accent">
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span className="font-medium">Режим постоянного прослушивания активен</span>
                  {awaitingCommand && (
                    <span className="ml-2 px-2 py-0.5 bg-accent/15 rounded-full text-xs">
                      Ожидаю команду...
                    </span>
                  )}
                  {pendingAction.type === 'message' && pendingAction.contact && (
                    <span className="ml-2 px-2 py-0.5 bg-primary/15 text-primary rounded-full text-xs">
                      Сообщение для: {pendingAction.contact}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Скажите "Джарвис" чтобы активировать команду. Доступно: "написать [имя]", "ответить на звонок", "проверить сообщения"
                </p>
              </div>
            )}

            {aiStatus && (
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className={cn('w-2 h-2 rounded-full', aiStatus.deepseek_available ? 'bg-accent' : 'bg-red-400')} />
                  DeepSeek
                </div>
                <div className="flex items-center gap-1">
                  <span className={cn('w-2 h-2 rounded-full', aiStatus.huggingface_available ? 'bg-accent' : 'bg-red-400')} />
                  HuggingFace
                </div>
                <div className="ml-auto">
                  Токены: {aiStatus.tokens_used?.toLocaleString()} / {aiStatus.token_limit?.toLocaleString()}
                </div>
              </div>
            )}

            {quota && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full glass border border-primary/20">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Запросов сегодня: {quota.used}/{quota.limit}</span>
                </div>
                {quota.premium && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/25">
                    <Crown className="w-3 h-3" />
                    Premium: расширенный лимит ({quota.limit}/день)
                  </span>
                )}
              </div>
            )}

            {showSettings && (
              <div className="mt-4 p-4 rounded-xl glass">
                <h3 className="font-semibold mb-4">Настройки J.A.R.V.I.S.</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Голосовые ответы</p>
                      <p className="text-xs text-muted-foreground">Озвучивать ответы Jarvis</p>
                    </div>
                    <button
                      onClick={toggleMute}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        isMuted ? "bg-muted" : "bg-primary"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all",
                        isMuted ? "left-0.5" : "left-6"
                      )} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Постоянное прослушивание</p>
                      <p className="text-xs text-muted-foreground">Активация по слову "Джарвис"</p>
                    </div>
                    <button
                      onClick={toggleAlwaysListening}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        !alwaysListening ? "bg-muted" : "bg-accent"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all",
                        !alwaysListening ? "left-0.5" : "left-6"
                      )} />
                    </button>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      AI провайдеры: DeepSeek (основной), HuggingFace (резервный).
                      Эти сервисы работают без ограничений для пользователей из РФ.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {showCapabilities && messages.length <= 1 && (
              <div className="animate-fade-in">
                <div className="text-center mb-8">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-brand flex items-center justify-center glow">
                    <Bot className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2 gradient-brand-text">К вашим услугам, сэр</h2>
                  <p className="text-muted-foreground">Выберите возможность или просто произнесите запрос</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  {CAPABILITIES.map(cap => (
                    <button
                      key={cap.id}
                      onClick={() => handleSendMessage(cap.examples[0])}
                      className="glass rounded-xl p-4 text-left hover:border-accent/50 hover:shadow-glow transition-all hover:scale-105"
                    >
                      <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center mb-3 text-accent">
                        {cap.icon}
                      </div>
                      <h3 className="font-semibold mb-1">{cap.name}</h3>
                      <p className="text-sm text-muted-foreground">{cap.description}</p>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(prompt)}
                      className="px-4 py-2 rounded-full glass text-sm hover:border-primary/50 hover:bg-primary/10 transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3 animate-slide-in',
                  message.type === 'user' && 'flex-row-reverse'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                  message.type === 'jarvis' 
                    ? 'bg-gradient-brand glow' 
                    : 'bg-card border border-border'
                )}>
                  {message.type === 'jarvis' ? (
                    <Sparkles className="w-5 h-5 text-white" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div className={cn(
                  'max-w-[80%] rounded-2xl p-4',
                  message.type === 'jarvis' 
                    ? 'glass' 
                    : 'bg-gradient-brand text-primary-foreground shadow-soft'
                )}>
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm text-muted-foreground">Обрабатываю ваш запрос, сэр...</span>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.type === 'jarvis' && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                          <button
                            onClick={() => copyMessage(message.content)}
                            className="p-1.5 rounded hover:bg-primary/10 transition-colors"
                            title="Копировать"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => regenerateResponse(message.id)}
                            className="p-1.5 rounded hover:bg-primary/10 transition-colors"
                            title="Перегенерировать"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => speakText(message.content)}
                            className="p-1.5 rounded hover:bg-primary/10 transition-colors"
                            title="Прочитать вслух"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                          {message.provider && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              via {message.provider}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {quotaExceeded && !quota?.premium && (
            <div className="px-4 pt-4">
              <div className="glass rounded-xl p-5 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 text-center animate-fade-in">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 flex items-center justify-center glow">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Лимит бесплатных запросов исчерпан</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Вы использовали {quota?.used ?? 0} из {quota?.limit ?? 0} запросов сегодня.
                  С Nebula Premium лимит расширяется до 100 запросов в день.
                </p>
                <Link
                  href="/premium"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-brand text-primary-foreground font-medium hover:brightness-110 transition-all shadow-glow"
                >
                  <Crown className="w-4 h-4" />
                  Перейти на Premium
                </Link>
              </div>
            </div>
          )}

          <div className="p-4 border-t border-border glass">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleVoiceInput}
                className={cn(
                  'p-3 rounded-full transition-all',
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'glass hover:border-accent/50 hover:text-accent'
                )}
                title={isListening ? "Остановить прослушивание" : "Голосовой ввод"}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Произнесите или напишите запрос, сэр..."
                  className="input-field !rounded-xl py-3 pr-12"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg
                            bg-gradient-brand text-primary-foreground
                            disabled:opacity-50 disabled:cursor-not-allowed
                            hover:shadow-glow transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Jarvis использует DeepSeek AI с HuggingFace в резерве. Голос включён. Сообщения удаляются через 21 день.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
