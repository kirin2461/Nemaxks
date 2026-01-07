import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'

const JARVIS_AUDIO_FILES = {
  greetings: [
    '/jarvis-audio/Джарвис - приветствие.wav',
    '/jarvis-audio/К вашим услугам сэр.wav',
    '/jarvis-audio/Всегда к вашим услугам сэр.wav',
  ],
  acknowledgments: [
    '/jarvis-audio/Да сэр.wav',
    '/jarvis-audio/Есть.wav',
    '/jarvis-audio/Как пожелаете .wav',
  ],
  thinking: [
    '/jarvis-audio/Загружаю сэр.wav',
    '/jarvis-audio/Начинаю диагностику системы.wav',
  ],
  complete: [
    '/jarvis-audio/Запрос выполнен сэр.wav',
    '/jarvis-audio/Проверка завершена.wav',
  ],
  errors: [
    '/jarvis-audio/Я перезагрузился сэр.wav',
  ],
  status: [
    '/jarvis-audio/Мы подключены и готовы.wav',
  ],
}

const getRandomAudioFile = (category: keyof typeof JARVIS_AUDIO_FILES): string => {
  const files = JARVIS_AUDIO_FILES[category]
  return files[Math.floor(Math.random() * files.length)]
}

interface PendingAction {
  type: 'message' | 'call' | null
  contact?: string
}

interface JarvisVoiceContextType {
  isAlwaysListening: boolean
  isAwaitingCommand: boolean
  pendingAction: PendingAction
  isMuted: boolean
  toggleAlwaysListening: () => void
  toggleMute: () => void
  playAudio: (category: keyof typeof JARVIS_AUDIO_FILES) => void
  lastTranscript: string
}

const JarvisVoiceContext = createContext<JarvisVoiceContextType | null>(null)

export const useJarvisVoice = () => {
  const context = useContext(JarvisVoiceContext)
  if (!context) {
    throw new Error('useJarvisVoice must be used within JarvisVoiceProvider')
  }
  return context
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || ''

export const JarvisVoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAlwaysListening, setIsAlwaysListening] = useState(() => {
    return localStorage.getItem('jarvis_always_listening') === 'true'
  })
  const [isAwaitingCommand, setIsAwaitingCommand] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>({ type: null })
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('jarvis_muted') === 'true'
  })
  const [lastTranscript, setLastTranscript] = useState('')
  
  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const playAudio = useCallback((category: keyof typeof JARVIS_AUDIO_FILES) => {
    if (isMuted) return
    
    const audioFile = getRandomAudioFile(category)
    
    if (audioRef.current) {
      audioRef.current.pause()
    }
    
    const audio = new Audio(audioFile)
    audioRef.current = audio
    audio.play().catch(err => console.log('Audio blocked:', err))
  }, [isMuted])

  const sendMessageViaJarvis = useCallback(async (contact: string, messageText: string) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return 'Сэр, вы не авторизованы.'
      
      const searchResponse = await fetch(`${API_BASE}/api/users/search?q=${encodeURIComponent(contact)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!searchResponse.ok) return `Не удалось найти пользователя ${contact}, сэр.`
      
      const users = await searchResponse.json()
      if (!users || users.length === 0) return `Пользователь ${contact} не найден, сэр.`
      
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
      }
      return 'Не удалось отправить сообщение, сэр.'
    } catch {
      return 'Произошла ошибка при отправке сообщения, сэр.'
    }
  }, [])

  const parseVoiceCommand = useCallback((transcript: string) => {
    const lowerText = transcript.toLowerCase().trim()
    
    if (lowerText === 'привет' || lowerText.includes('привет джарвис') || lowerText.startsWith('привет ')) {
      playAudio('greetings')
      return { action: 'greeting', response: 'Здравствуйте, сэр. Рад вас слышать.' }
    }
    
    if (lowerText === 'здравствуй' || lowerText === 'здравствуйте' || lowerText.includes('здравствуй джарвис')) {
      playAudio('greetings')
      return { action: 'greeting', response: 'Здравствуйте, сэр. К вашим услугам.' }
    }
    
    if (lowerText.includes('как дела') || lowerText.includes('как ты')) {
      playAudio('status')
      return { action: 'status', response: 'Все системы работают в штатном режиме, сэр. Спасибо за заботу.' }
    }
    
    if (lowerText.includes('спасибо')) {
      playAudio('acknowledgments')
      return { action: 'thanks', response: 'Всегда пожалуйста, сэр.' }
    }
    
    if (lowerText.includes('написать') || lowerText.includes('напиши') || lowerText.includes('отправить') || lowerText.includes('отправь')) {
      const contactMatch = transcript.match(/(?:написать|напиши|отправить|отправь)\s+(?:пользователю\s+)?(.+?)(?:\s+сообщение|\s+текст|$)/i)
      if (contactMatch && contactMatch[1]) {
        const contact = contactMatch[1].trim()
        setPendingAction({ type: 'message', contact })
        return { action: 'request_message', response: `Хорошо, сэр. Что передать пользователю ${contact}?` }
      }
      return { action: 'request_contact', response: 'Кому отправить сообщение, сэр?' }
    }
    
    if (lowerText.includes('ответить') || lowerText.includes('поднять трубку') || lowerText.includes('принять звонок')) {
      return { action: 'answer_call', response: 'Принимаю звонок, сэр.' }
    }
    
    if (lowerText.includes('перейти') && lowerText.includes('друзь')) {
      window.location.href = '/friends'
      return { action: 'navigate', response: 'Перехожу на страницу друзей, сэр.' }
    }
    
    if (lowerText.includes('перейти') && lowerText.includes('сообщен')) {
      window.location.href = '/messages'
      return { action: 'navigate', response: 'Перехожу на страницу сообщений, сэр.' }
    }
    
    if (lowerText.includes('перейти') && lowerText.includes('канал')) {
      window.location.href = '/channels'
      return { action: 'navigate', response: 'Перехожу на страницу каналов, сэр.' }
    }
    
    if (lowerText.includes('время') || lowerText.includes('который час')) {
      const now = new Date()
      const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      playAudio('complete')
      return { action: 'time', response: `Сейчас ${timeStr}, сэр.` }
    }
    
    return null
  }, [playAudio])

  const handleRecognitionResult = useCallback(async (transcript: string) => {
    const lowerText = transcript.toLowerCase().trim()
    setLastTranscript(transcript)
    
    if (pendingAction.type === 'message' && pendingAction.contact) {
      const result = await sendMessageViaJarvis(pendingAction.contact, transcript)
      console.log('Jarvis:', result)
      setPendingAction({ type: null })
      setIsAwaitingCommand(false)
      playAudio('complete')
      return
    }
    
    if (lowerText.includes('джарвис') || lowerText === 'привет' || lowerText === 'здравствуй' || lowerText === 'здравствуйте') {
      setIsAwaitingCommand(true)
      
      const cleanCommand = transcript.replace(/джарвис[,.]?\s*/i, '').trim()
      
      if (lowerText === 'привет' || cleanCommand.toLowerCase() === 'привет') {
        console.log('Jarvis: Здравствуйте, сэр. Рад вас слышать.')
        playAudio('greetings')
        return
      }
      
      if (lowerText === 'здравствуй' || lowerText === 'здравствуйте' || cleanCommand.toLowerCase().startsWith('здравствуй')) {
        console.log('Jarvis: Здравствуйте, сэр. К вашим услугам.')
        playAudio('greetings')
        return
      }
      
      playAudio('greetings')
      
      if (cleanCommand.length > 3) {
        const command = parseVoiceCommand(cleanCommand)
        if (command) {
          console.log('Jarvis:', command.response)
        }
      }
      return
    }
    
    if (isAwaitingCommand) {
      const command = parseVoiceCommand(transcript)
      if (command) {
        console.log('Jarvis:', command.response)
        if (command.action !== 'request_message' && command.action !== 'request_contact') {
          setIsAwaitingCommand(false)
        }
      } else {
        setIsAwaitingCommand(false)
      }
    }
  }, [pendingAction, isAwaitingCommand, parseVoiceCommand, sendMessageViaJarvis, playAudio])

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported')
      return
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        console.log('Stopping previous recognition:', e)
      }
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'ru-RU'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      const lastResult = event.results[event.results.length - 1]
      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript
        console.log('Heard:', transcript)
        handleRecognitionResult(transcript)
      }
    }

    recognition.onerror = (event: any) => {
      console.log('Recognition error:', event.error)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        console.error('Microphone access denied')
        return
      }
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setTimeout(() => {
          if (isAlwaysListening) {
            try {
              recognition.start()
            } catch (e) {
              console.log('Restart failed:', e)
            }
          }
        }, 2000)
      }
    }

    recognition.onend = () => {
      console.log('Recognition ended, continuous:', isAlwaysListening)
      if (isAlwaysListening) {
        setTimeout(() => {
          try {
            recognition.start()
            console.log('Recognition restarted')
          } catch (e) {
            console.log('Restart on end failed:', e)
          }
        }, 300)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      console.log('Jarvis listening started')
    } catch (e) {
      console.error('Failed to start recognition:', e)
    }
  }, [isAlwaysListening, handleRecognitionResult])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsAwaitingCommand(false)
    setPendingAction({ type: null })
  }, [])

  const toggleAlwaysListening = useCallback(() => {
    const newState = !isAlwaysListening
    setIsAlwaysListening(newState)
    localStorage.setItem('jarvis_always_listening', String(newState))
    
    if (newState) {
      startListening()
      playAudio('status')
    } else {
      stopListening()
    }
  }, [isAlwaysListening, startListening, stopListening, playAudio])

  const toggleMute = useCallback(() => {
    const newState = !isMuted
    setIsMuted(newState)
    localStorage.setItem('jarvis_muted', String(newState))
  }, [isMuted])

  useEffect(() => {
    const initListening = () => {
      if (isAlwaysListening && !recognitionRef.current) {
        startListening()
      }
    }
    
    const timeout = setTimeout(initListening, 500)
    
    return () => {
      clearTimeout(timeout)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.log('Recognition cleanup error:', e)
        }
      }
    }
  }, [isAlwaysListening, startListening])

  return (
    <JarvisVoiceContext.Provider value={{
      isAlwaysListening,
      isAwaitingCommand,
      pendingAction,
      isMuted,
      toggleAlwaysListening,
      toggleMute,
      playAudio,
      lastTranscript,
    }}>
      {children}
    </JarvisVoiceContext.Provider>
  )
}
