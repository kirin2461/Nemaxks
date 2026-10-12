import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { useNotifications } from '@/contexts/NotificationContext'
import { useLiveKit } from '@/contexts/LiveKitContext'

interface VoiceUser {
  id: string
  username: string
  avatar?: string
  isMuted: boolean
  isDeafened: boolean
  isSpeaking: boolean
  hasVideo: boolean
  isScreenSharing: boolean
  volume: number
  videoStream?: MediaStream
  screenStream?: MediaStream
}

interface VoiceState {
  isConnected: boolean
  channelId: string | null
  channelName: string | null
  guildId: string | null
  guildName: string | null
  isMuted: boolean
  isDeafened: boolean
  isSpeaking: boolean
  hasVideo: boolean
  isScreenSharing: boolean
  connectedUsers: VoiceUser[]
  connectionQuality: 'excellent' | 'good' | 'poor'
}

interface VoiceChannelUsers {
  [channelId: string]: VoiceUser[]
}

interface VoiceContextValue {
  state: VoiceState
  voiceChannelUsers: VoiceChannelUsers
  localVideoStream: MediaStream | null
  localScreenStream: MediaStream | null
  joinChannel: (channelId: string, channelName: string, guildId: string, guildName: string) => Promise<void>
  leaveChannel: () => void
  toggleMute: () => void
  toggleDeafen: () => void
  toggleVideo: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  setUserVolume: (userId: string, volume: number) => void
  setRemoteSpeaking: (userId: string, isSpeaking: boolean) => void
  syncConnectedUsers: (users: VoiceUser[]) => void
  addConnectedUser: (user: VoiceUser) => void
  removeConnectedUser: (userId: string) => void
  getICEServers: () => Promise<RTCIceServer[]>
  sendWebSocketMessage: (message: any) => void
  subscribeToMessages: (handler: (data: any) => void) => () => void
}

const initialState: VoiceState = {
  isConnected: false,
  channelId: null,
  channelName: null,
  guildId: null,
  guildName: null,
  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  hasVideo: false,
  isScreenSharing: false,
  connectedUsers: [],
  connectionQuality: 'excellent'
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

// Минимальный fallback: только публичные бесплатные STUN-серверы.
// Основной источник ICE-конфигурации — GET /api/rtc/ice-servers: бэкенд отдаёт
// TURN из env-переменных (TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL).
// Для продакшна рекомендуется поднять свой coturn и прописать его через env на бэкенде —
// хардкодить TURN на фронтенде не нужно.
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

// Загружает ICE-серверы с API и мерджит с fallback-списком (dedupe по urls).
async function fetchICEServers(): Promise<RTCIceServer[]> {
  let apiServers: RTCIceServer[] = []
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/rtc/ice-servers', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      if (data.iceServers && Array.isArray(data.iceServers)) {
        apiServers = data.iceServers
      }
    }
  } catch (error) {
    console.error('Failed to fetch ICE servers:', error)
  }
  // Мердж: серверы из API (включая TURN) + fallback STUN, dedupe по urls
  const seen = new Set<string>()
  const merged: RTCIceServer[] = []
  for (const server of [...apiServers, ...DEFAULT_ICE_SERVERS]) {
    const key = Array.isArray(server.urls) ? server.urls.join(',') : String(server.urls)
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(server)
    }
  }
  console.log(`[VoiceContext] ICE servers: ${merged.length} total (${apiServers.length} from API)`)
  return merged
}

type VoiceMode = 'p2p' | 'livekit'

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useStore()
  const { subscribeToMessages, sendWebSocketMessage } = useNotifications()
  const livekit = useLiveKit()
  const [state, setState] = useState<VoiceState>(initialState)
  const [voiceChannelUsers, setVoiceChannelUsers] = useState<VoiceChannelUsers>({})
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('p2p')
  
  const localStreamRef = useRef<MediaStream | null>(null)
  const localVideoStreamRef = useRef<MediaStream | null>(null)
  const localScreenStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const speakingAnimationRef = useRef<number | null>(null)
  const stateRef = useRef(state)
  const p2pFailCountRef = useRef<number>(0)
  const maxP2PFailures = 3
  
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const remoteAudioAnalysersRef = useRef<Map<string, { audioContext: AudioContext; analyser: AnalyserNode; animationId: number }>>(new Map())
  const remoteVideoStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const remoteScreenStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  // Очередь ICE-кандидатов до установки remoteDescription (с меткой времени для TTL-очистки)
  const pendingCandidatesRef = useRef<Map<string, { candidate: RTCIceCandidateInit | null; ts: number }[]>>(new Map())
  // null = ещё не загружались с API (getICEServers делает fetch один раз и кэширует)
  const iceServersRef = useRef<RTCIceServer[] | null>(null)
  const iceServersPromiseRef = useRef<Promise<RTCIceServer[]> | null>(null)
  // Perfect negotiation: флаг "мы сейчас создаём оффер" на каждого пира
  const makingOfferRef = useRef<Map<string, boolean>>(new Map())
  // Пиры, с которыми завершена начальнаяnegotiation (onnegotiationneeded активен только после неё)
  const negotiationReadyRef = useRef<Set<string>>(new Set())
  // Состояние медиа пиров по сигналингу (voice-state-update) — основной источник screen vs camera
  const remoteMediaStateRef = useRef<Map<string, { video: boolean; screen: boolean }>>(new Map())
  // id голосового аудио-потока пира (защита от затирания вторым аудиотреком, например со скриншэра)
  const remoteVoiceStreamIdRef = useRef<Map<string, string>>(new Map())

  // Perfect negotiation: детерминированная роль в паре.
  // polite = (мой id > id пира). Оффер при glare откатывает polite-сторона,
  // impolite-сторона (меньший id) свой оффер НЕ откатывает.
  const isPolite = useCallback((peerId: string) => {
    return String(user?.id) > String(peerId)
  }, [user?.id])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // TTL-очистка очередей ICE-кандидатов (30с) для неизвестных/отвалившихся peerId
  useEffect(() => {
    const PENDING_CANDIDATE_TTL_MS = 30000
    const interval = setInterval(() => {
      const now = Date.now()
      pendingCandidatesRef.current.forEach((queue, peerId) => {
        const fresh = queue.filter(entry => now - entry.ts < PENDING_CANDIDATE_TTL_MS)
        if (fresh.length === 0) {
          pendingCandidatesRef.current.delete(peerId)
        } else if (fresh.length !== queue.length) {
          pendingCandidatesRef.current.set(peerId, fresh)
        }
      })
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const broadcastVoiceEvent = useCallback((type: string, data: object) => {
    sendWebSocketMessage({ type, ...data })
  }, [sendWebSocketMessage])

  // Загрузка ICE-серверов: один fetch с кэшем (iceServersRef) и дедупликацией
  // параллельных вызовов (iceServersPromiseRef).
  const getICEServers = useCallback(async (): Promise<RTCIceServer[]> => {
    if (iceServersRef.current) {
      return iceServersRef.current
    }
    if (!iceServersPromiseRef.current) {
      iceServersPromiseRef.current = fetchICEServers()
        .then(servers => {
          iceServersRef.current = servers
          return servers
        })
        .finally(() => {
          iceServersPromiseRef.current = null
        })
    }
    return iceServersPromiseRef.current
  }, [])

  // Синхронизация треков с senders без полной пересборки:
  // replaceTrack для существующих senders, addTrack только для новых треков,
  // removeTrack только для реально удалённых. Изменения триггерят onnegotiationneeded.
  const addTracksToPeerConnection = useCallback((pc: RTCPeerConnection) => {
    const desiredTracks: { track: MediaStreamTrack; stream: MediaStream }[] = []

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        desiredTracks.push({ track, stream: localStreamRef.current! })
      })
    }

    if (localVideoStreamRef.current && stateRef.current.hasVideo) {
      localVideoStreamRef.current.getTracks().forEach(track => {
        desiredTracks.push({ track, stream: localVideoStreamRef.current! })
      })
    }

    if (localScreenStreamRef.current && stateRef.current.isScreenSharing) {
      localScreenStreamRef.current.getTracks().forEach(track => {
        desiredTracks.push({ track, stream: localScreenStreamRef.current! })
      })
    }

    const senders = pc.getSenders()

    // Удаляем senders, чьи треки больше не нужны
    for (const sender of senders) {
      if (sender.track && !desiredTracks.some(d => d.track === sender.track)) {
        pc.removeTrack(sender)
      }
    }

    // Добавляем/заменяем треки
    for (const { track, stream } of desiredTracks) {
      const existing = pc.getSenders().find(s => s.track === track)
      if (existing) continue // трек уже отправляется

      // Переиспользуем пустой sender того же kind через replaceTrack
      const reusable = pc.getSenders().find(s => !s.track && s instanceof RTCRtpSender)
      if (reusable) {
        reusable.replaceTrack(track).catch(err => console.error('replaceTrack failed:', err))
      } else {
        pc.addTrack(track, stream)
      }
    }
  }, [])

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current ?? DEFAULT_ICE_SERVERS,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    })

    pc.onicecandidate = (event) => {
      if (stateRef.current.channelId) {
        sendWebSocketMessage({
          type: 'voice-ice-candidate',
          targetUserId: peerId,
          channel_id: stateRef.current.channelId,
          // toJSON() для корректной сериализации; null = end-of-candidates
          candidate: event.candidate ? event.candidate.toJSON() : null
        })
      }
    }

    // Perfect negotiation: единая точка создания офферов для ренегосиации и ICE restart.
    // Срабатывает только после завершения начальнойnegotiation (negotiationReadyRef),
    // чтобы не слать лишние офферы во время первичного offer/answer.
    pc.onnegotiationneeded = async () => {
      if (pc.signalingState !== 'stable') return
      if (!negotiationReadyRef.current.has(peerId)) return
      if (!stateRef.current.isConnected || !stateRef.current.channelId) return
      try {
        makingOfferRef.current.set(peerId, true)
        await pc.setLocalDescription()
        if (pc.localDescription) {
          sendWebSocketMessage({
            type: 'voice-offer',
            targetUserId: peerId,
            channel_id: stateRef.current.channelId,
            sdp: pc.localDescription.sdp
          })
        }
      } catch (error) {
        console.error(`onnegotiationneeded failed for peer ${peerId}:`, error)
      } finally {
        makingOfferRef.current.set(peerId, false)
      }
    }

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${peerId}: ${event.track.kind}`, event.track.label)
      const stream = event.streams[0]

      if (event.track.kind === 'audio') {
        const streamId = stream?.id || ''
        const knownVoiceStreamId = remoteVoiceStreamIdRef.current.get(peerId)
        if (knownVoiceStreamId && knownVoiceStreamId !== streamId) {
          // Второй аудиотрек (например, звук скриншэра) — не затираем голосовой элемент
          console.log(`[VoiceContext] Ignoring extra audio track from ${peerId} (stream ${streamId})`)
          return
        }
        remoteVoiceStreamIdRef.current.set(peerId, streamId)

        let audioEl = remoteAudioElementsRef.current.get(peerId)
        if (!audioEl) {
          audioEl = new Audio()
          audioEl.autoplay = true
          audioEl.muted = false // Ensure not muted
          audioEl.volume = 1.0
          audioEl.setAttribute('playsinline', 'true');
          remoteAudioElementsRef.current.set(peerId, audioEl)
        }
        console.log(`Setting remote audio stream for ${peerId}`);
        audioEl.srcObject = stream
        audioEl.play().catch(err => {
          console.error("Error playing remote audio element:", err);
          const playOnGesture = () => {
            audioEl?.play();
            document.removeEventListener('click', playOnGesture);
          };
          document.addEventListener('click', playOnGesture);
        })
        // Анализ голоса запускаем один раз на голосовой поток (не на поток скриншэра)
        if (!remoteAudioAnalysersRef.current.has(peerId)) {
          startRemoteVoiceAnalysis(peerId, stream)
        }
      } else if (event.track.kind === 'video') {
        // Screen vs camera: основной источник — сигналинг (voice-state-update),
        // label трека используется только как fallback.
        const label = event.track.label.toLowerCase()
        const looksLikeScreen = label.includes('screen') || label.includes('window')
        const sig = remoteMediaStateRef.current.get(peerId)
        let isScreen: boolean
        if (sig && sig.screen !== sig.video) {
          isScreen = sig.screen
        } else if (sig && sig.screen && sig.video) {
          // Включены и камера, и экран: различаем по уже назначенным потокам
          const hasCamera = remoteVideoStreamsRef.current.has(peerId)
          const hasScreen = remoteScreenStreamsRef.current.has(peerId)
          if (hasCamera && !hasScreen) isScreen = true
          else if (!hasCamera && hasScreen) isScreen = false
          else isScreen = looksLikeScreen
        } else {
          isScreen = looksLikeScreen
        }

        if (isScreen) {
          remoteScreenStreamsRef.current.set(peerId, stream)
          setState(prev => ({
            ...prev,
            connectedUsers: prev.connectedUsers.map(u =>
              u.id === peerId ? { ...u, isScreenSharing: true, screenStream: stream } : u
            )
          }))
        } else {
          remoteVideoStreamsRef.current.set(peerId, stream)
          setState(prev => ({
            ...prev,
            connectedUsers: prev.connectedUsers.map(u =>
              u.id === peerId ? { ...u, hasVideo: true, videoStream: stream } : u
            )
          }))
        }
      }
    }

    pc.onconnectionstatechange = () => {
      console.log(`Peer ${peerId} connection state: ${pc.connectionState}`)
      if (pc.connectionState === 'failed') {
        p2pFailCountRef.current++
        console.log(`[VoiceContext] P2P connection failed (${p2pFailCountRef.current}/${maxP2PFailures})`)

        if (p2pFailCountRef.current >= maxP2PFailures && livekit.isAvailable) {
          console.log('[VoiceContext] Max P2P failures reached, switching to LiveKit')
          const channelId = stateRef.current.channelId
          if (channelId) {
            closeAllPeerConnections()
            setVoiceMode('livekit')
            livekit.joinRoom(channelId).then(success => {
              if (success) {
                console.log('[VoiceContext] Successfully switched to LiveKit')
              } else {
                console.error('[VoiceContext] Failed to switch to LiveKit, reverting to P2P')
                setVoiceMode('p2p')
                p2pFailCountRef.current = 0
              }
            })
          }
        } else if (!isPolite(peerId)) {
          // Единая точка восстановления: restartIce без закрытия pc.
          // Re-offer делает ТОЛЬКО impolite-сторона (через onnegotiationneeded),
          // чтобы обе стороны не слали офферы одновременно (glare).
          console.log(`[VoiceContext] connectionState failed, restarting ICE with ${peerId}`)
          pc.restartIce()
        }
      } else if (pc.connectionState === 'disconnected') {
        // Grace period 5с: соединение может восстановиться само; иначе — restartIce,
        // pc НЕ закрываем (закрытие только по явному voice-leave/leaveChannel).
        setTimeout(() => {
          if (pc.signalingState !== 'closed' && pc.connectionState === 'disconnected') {
            if (!isPolite(peerId)) {
              console.log(`[VoiceContext] Still disconnected from ${peerId} after grace period, restarting ICE`)
              pc.restartIce()
            }
          }
        }, 5000)
      } else if (pc.connectionState === 'connected') {
        p2pFailCountRef.current = 0
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log(`Peer ${peerId} ICE state: ${pc.iceConnectionState}`)
      if (pc.iceConnectionState === 'failed') {
        // Re-offer после restartIce делает impolite-сторона через onnegotiationneeded
        if (!isPolite(peerId)) {
          pc.restartIce()
        }
      }
    }

    addTracksToPeerConnection(pc)
    peerConnectionsRef.current.set(peerId, pc)
    return pc
  }, [sendWebSocketMessage, addTracksToPeerConnection, livekit, isPolite])

  const startRemoteVoiceAnalysis = useCallback((peerId: string, stream: MediaStream) => {
    const existingAnalyser = remoteAudioAnalysersRef.current.get(peerId)
    if (existingAnalyser) {
      cancelAnimationFrame(existingAnalyser.animationId)
      existingAnalyser.audioContext.close().catch(() => {})
      remoteAudioAnalysersRef.current.delete(peerId)
    }
    
    try {
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.3
      source.connect(analyser)
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let isSpeaking = false
      let holdCounter = 0
      const holdTime = 10
      
      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray)
        const voiceBands = Array.from(dataArray).slice(2, 40)
        const level = voiceBands.reduce((a, b) => a + b, 0) / voiceBands.length
        const threshold = 15
        
        if (level > threshold) {
          holdCounter = holdTime
          if (!isSpeaking) {
            isSpeaking = true
            setState(prev => ({
              ...prev,
              connectedUsers: prev.connectedUsers.map(u =>
                u.id === peerId ? { ...u, isSpeaking: true } : u
              )
            }))
          }
        } else if (holdCounter > 0) {
          holdCounter--
        } else if (isSpeaking) {
          isSpeaking = false
          setState(prev => ({
            ...prev,
            connectedUsers: prev.connectedUsers.map(u =>
              u.id === peerId ? { ...u, isSpeaking: false } : u
            )
          }))
        }
        
        const animationId = requestAnimationFrame(checkAudio)
        const entry = remoteAudioAnalysersRef.current.get(peerId)
        if (entry) {
          entry.animationId = animationId
        }
      }
      
      const animationId = requestAnimationFrame(checkAudio)
      remoteAudioAnalysersRef.current.set(peerId, { audioContext, analyser, animationId })
    } catch (err) {
      console.error('Failed to start remote voice analysis:', err)
    }
  }, [])

  const stopRemoteVoiceAnalysis = useCallback((peerId: string) => {
    const entry = remoteAudioAnalysersRef.current.get(peerId)
    if (entry) {
      cancelAnimationFrame(entry.animationId)
      entry.audioContext.close().catch(() => {})
      remoteAudioAnalysersRef.current.delete(peerId)
    }
  }, [])

  const closePeerConnection = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId)
    if (pc) {
      pc.close()
      peerConnectionsRef.current.delete(peerId)
    }
    
    const audioEl = remoteAudioElementsRef.current.get(peerId)
    if (audioEl) {
      audioEl.srcObject = null
      remoteAudioElementsRef.current.delete(peerId)
    }
    
    remoteVideoStreamsRef.current.delete(peerId)
    remoteScreenStreamsRef.current.delete(peerId)
    stopRemoteVoiceAnalysis(peerId)
    pendingCandidatesRef.current.delete(peerId)
    makingOfferRef.current.delete(peerId)
    negotiationReadyRef.current.delete(peerId)
    remoteMediaStateRef.current.delete(peerId)
    remoteVoiceStreamIdRef.current.delete(peerId)
  }, [stopRemoteVoiceAnalysis])

  const closeAllPeerConnections = useCallback(() => {
    peerConnectionsRef.current.forEach((pc, peerId) => {
      pc.close()
      const audioEl = remoteAudioElementsRef.current.get(peerId)
      if (audioEl) {
        audioEl.srcObject = null
      }
      stopRemoteVoiceAnalysis(peerId)
    })
    peerConnectionsRef.current.clear()
    remoteAudioElementsRef.current.clear()
    remoteAudioAnalysersRef.current.clear()
    remoteVideoStreamsRef.current.clear()
    remoteScreenStreamsRef.current.clear()
    pendingCandidatesRef.current.clear()
    makingOfferRef.current.clear()
    negotiationReadyRef.current.clear()
    remoteMediaStateRef.current.clear()
    remoteVoiceStreamIdRef.current.clear()
  }, [stopRemoteVoiceAnalysis])

  // Ренегосиация: только синхронизируем треки (replaceTrack/addTrack/removeTrack).
  // Сам оффер отправит pc.onnegotiationneeded (с защитой makingOffer и проверкой
  // signalingState === 'stable'), поэтому здесь createOffer вручную НЕ вызываем —
  // иначе возможны двойные офферы и InvalidStateError.
  const renegotiateAll = useCallback(async () => {
    for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
      try {
        if (pc.signalingState === 'closed') continue
        addTracksToPeerConnection(pc)
      } catch (error) {
        console.error(`Error renegotiating with peer ${peerId}:`, error)
      }
    }
  }, [addTracksToPeerConnection])

  const createOffer = useCallback(async (peerId: string) => {
    console.log(`Creating offer for peer ${peerId}`)
    if (makingOfferRef.current.get(peerId)) {
      console.log(`Already making offer for ${peerId}, skipping`)
      return
    }
    let pc = peerConnectionsRef.current.get(peerId)
    if (!pc) {
      pc = createPeerConnection(peerId)
    }
    if (pc.signalingState !== 'stable') {
      console.log(`Skipping offer for ${peerId}: signalingState=${pc.signalingState}`)
      return
    }

    try {
      makingOfferRef.current.set(peerId, true)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      sendWebSocketMessage({
        type: 'voice-offer',
        targetUserId: peerId,
        channel_id: stateRef.current.channelId,
        sdp: offer.sdp
      })
      negotiationReadyRef.current.add(peerId)
    } catch (error) {
      console.error('Error creating offer:', error)
    } finally {
      makingOfferRef.current.set(peerId, false)
    }
  }, [createPeerConnection, sendWebSocketMessage])

  const handleVoiceOffer = useCallback(async (fromUserId: string, sdp: string, channelId: string) => {
    if (!stateRef.current.isConnected) return;
    if (channelId && channelId !== 'undefined' && channelId !== 'null' && stateRef.current.channelId !== channelId) return;
    if (!fromUserId || fromUserId === 'undefined' || fromUserId === String(user?.id)) return;
    
    console.log(`Received voice offer from ${fromUserId}`);
    let pc = peerConnectionsRef.current.get(fromUserId)
    if (!pc) {
      pc = createPeerConnection(fromUserId)
    }

    // Perfect negotiation: разрешение коллизии офферов (glare).
    const polite = isPolite(fromUserId)
    const makingOffer = makingOfferRef.current.get(fromUserId) === true
    const offerCollision = makingOffer || pc.signalingState !== 'stable'

    if (offerCollision) {
      if (!polite) {
        // Impolite-сторона игнорирует встречный оффер
        console.log(`[VoiceContext] Ignoring colliding offer from ${fromUserId} (impolite side)`)
        return
      }
      console.log(`[VoiceContext] Offer collision with ${fromUserId}, rolling back (polite side)`)
    }

    try {
      if (offerCollision) {
        // Polite-сторона откатывает свой оффер и принимает чужой
        await pc.setLocalDescription({ type: 'rollback' })
        makingOfferRef.current.set(fromUserId, false)
      }
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }))

      const pendingCandidates = pendingCandidatesRef.current.get(fromUserId) || []
      for (const entry of pendingCandidates) {
        await pc.addIceCandidate(entry.candidate)
      }
      pendingCandidatesRef.current.delete(fromUserId)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      sendWebSocketMessage({
        type: 'voice-answer',
        targetUserId: fromUserId,
        channel_id: channelId,
        sdp: answer.sdp
      })
      negotiationReadyRef.current.add(fromUserId)
    } catch (error) {
      console.error('Error handling voice offer:', error)
    }
  }, [createPeerConnection, sendWebSocketMessage, user?.id, isPolite])

  const handleVoiceAnswer = useCallback(async (fromUserId: string, sdp: string) => {
    if (!stateRef.current.isConnected) return
    if (fromUserId === String(user?.id)) return

    console.log(`Received voice answer from ${fromUserId}`)
    const pc = peerConnectionsRef.current.get(fromUserId)
    if (!pc) return
    // Answer вне состояния have-local-offer — дубликат/устаревший, игнорируем
    if (pc.signalingState === 'stable') {
      console.log(`[VoiceContext] Ignoring answer from ${fromUserId}: signalingState is stable`)
      return
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }))
      negotiationReadyRef.current.add(fromUserId)

      const pendingCandidates = pendingCandidatesRef.current.get(fromUserId) || []
      for (const entry of pendingCandidates) {
        await pc.addIceCandidate(entry.candidate)
      }
      pendingCandidatesRef.current.delete(fromUserId)
    } catch (error) {
      console.error('Error handling voice answer:', error)
    }
  }, [user?.id])

  const handleIceCandidate = useCallback(async (fromUserId: string, candidateData: RTCIceCandidateInit | null) => {
    if (!stateRef.current.isConnected) return
    if (fromUserId === String(user?.id)) return
    // undefined — битое сообщение; null — легитимный end-of-candidates
    if (candidateData === undefined) return

    const pc = peerConnectionsRef.current.get(fromUserId)

    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(candidateData)
      } catch (error) {
        console.error('Error adding ICE candidate:', error)
      }
    } else if (candidateData) {
      // Кандидат пришёл до remoteDescription — ставим в очередь (TTL-очистка в effect)
      const pending = pendingCandidatesRef.current.get(fromUserId) || []
      pending.push({ candidate: candidateData, ts: Date.now() })
      pendingCandidatesRef.current.set(fromUserId, pending)
    }
  }, [user?.id])

  const startVoiceActivityDetection = useCallback(() => {
    if (!localStreamRef.current || !audioContextRef.current) return

    const analyser = audioContextRef.current.createAnalyser()
    analyser.fftSize = 256
    const source = audioContextRef.current.createMediaStreamSource(localStreamRef.current)
    source.connect(analyser)
    analyserRef.current = analyser

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    let speakingHoldFrames = 0
    let lastSpeakingState = false

    const checkAudioLevel = () => {
      if (!analyserRef.current) return
      
      analyserRef.current.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 2; i < 40; i++) {
        sum += dataArray[i]
      }
      const average = sum / 38
      
      const isSpeakingNow = average > 15
      
      if (isSpeakingNow) {
        speakingHoldFrames = 8
      } else if (speakingHoldFrames > 0) {
        speakingHoldFrames--
      }

      const shouldBeSpeaking = speakingHoldFrames > 0
      
      if (shouldBeSpeaking !== lastSpeakingState) {
        lastSpeakingState = shouldBeSpeaking
        setState(prev => ({ ...prev, isSpeaking: shouldBeSpeaking }))
        
        if (stateRef.current.channelId) {
          broadcastVoiceEvent('voice-state-update', {
            channel_id: stateRef.current.channelId,
            user_id: user?.id,
            is_muted: stateRef.current.isMuted,
            is_deafened: stateRef.current.isDeafened,
            is_speaking: shouldBeSpeaking,
            has_video: stateRef.current.hasVideo,
            is_screen_sharing: stateRef.current.isScreenSharing
          })
        }
      }
      
      speakingAnimationRef.current = requestAnimationFrame(checkAudioLevel)
    }

    checkAudioLevel()
  }, [user?.id, broadcastVoiceEvent])

  const stopVoiceActivityDetection = useCallback(() => {
    if (speakingAnimationRef.current) {
      cancelAnimationFrame(speakingAnimationRef.current)
      speakingAnimationRef.current = null
    }
  }, [])

  const fetchExistingParticipants = useCallback(async (channelId: string): Promise<VoiceUser[]> => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/voice/channels/${channelId}/participants`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const participants = await response.json()
        if (!Array.isArray(participants)) return []
        return participants
          .filter((p: any) => p && p.user_id)
          .map((p: any) => ({
            id: String(p.user_id),
            username: p.username || 'User',
            avatar: p.avatar,
            isMuted: p.is_muted || false,
            isDeafened: p.is_deafened || false,
            isSpeaking: false,
            hasVideo: p.has_video || false,
            isScreenSharing: p.is_screen_sharing || false,
            volume: 100
          }))
      }
    } catch (error) {
      console.error('Error fetching voice participants:', error)
    }
    return []
  }, [])

  const handleWebSocketMessage = useCallback((data: any) => {
    const channelId = String(data.channel_id || data.channelId)
    const userId = String(data.user_id || data.userId)
    const fromUserId = String(data.fromUserId || data.from_user_id || '')
    
    if (data.type === 'voice-offer') {
      handleVoiceOffer(fromUserId, data.sdp, channelId)
      return
    }
    
    if (data.type === 'voice-answer') {
      handleVoiceAnswer(fromUserId, data.sdp)
      return
    }
    
    if (data.type === 'voice-ice-candidate') {
      handleIceCandidate(fromUserId, data.candidate)
      return
    }
    
    if (data.type === 'voice-join') {
      const voiceUser: VoiceUser = {
        id: userId,
        username: data.username || 'User',
        avatar: data.avatar,
        isMuted: data.is_muted || false,
        isDeafened: data.is_deafened || false,
        isSpeaking: false,
        hasVideo: data.has_video || false,
        isScreenSharing: data.is_screen_sharing || false,
        volume: 100
      }
      
      console.log(`Voice join event: user ${userId} in channel ${channelId}`);

      setVoiceChannelUsers(prev => {
        const channelUsers = prev[channelId] || []
        if (channelUsers.some(u => u.id === userId)) {
          return prev
        }
        return { ...prev, [channelId]: [...channelUsers, voiceUser] }
      })
      
      // Запоминаем медиа-состояние пира из сигналинга (для различения screen/camera)
      remoteMediaStateRef.current.set(userId, {
        video: data.has_video || false,
        screen: data.is_screen_sharing || false
      })

      if (stateRef.current.channelId === channelId && userId !== String(user?.id)) {
        console.log(`Adding ${userId} to connected users`);
        setState(prev => ({
          ...prev,
          connectedUsers: prev.connectedUsers.some(u => u.id === userId)
            ? prev.connectedUsers
            : [...prev.connectedUsers, voiceUser]
        }))

        // Perfect negotiation: оффер новичку создаёт ТОЛЬКО сторона с меньшим id
        // (impolite). Вторая ветка (оффер от новичка) — в joinChannel, тоже с
        // проверкой сравнения id. Обе ветки вместе покрывают пару ровно один раз.
        if (String(user?.id) < userId) {
          console.log(`Creating offer for ${userId} (we are the impolite/initiator side)`);
          setTimeout(() => createOffer(userId), 500);
        }
      }
    }
    
    if (data.type === 'voice-leave') {
      setVoiceChannelUsers(prev => {
        const channelUsers = prev[channelId] || []
        return { ...prev, [channelId]: channelUsers.filter(u => u.id !== userId) }
      })
      
      if (stateRef.current.channelId === channelId) {
        setState(prev => ({
          ...prev,
          connectedUsers: prev.connectedUsers.filter(u => u.id !== userId)
        }))
        
        closePeerConnection(userId)
      }
    }
    
    if (data.type === 'voice-state-update') {
      // Основной источник для различения screen/camera треков в ontrack
      remoteMediaStateRef.current.set(userId, {
        video: data.has_video || false,
        screen: data.is_screen_sharing || false
      })

      const updateUser = (users: VoiceUser[]) =>
        users.map(u => u.id === userId 
          ? { 
              ...u, 
              isMuted: data.is_muted, 
              isDeafened: data.is_deafened, 
              isSpeaking: data.is_speaking,
              hasVideo: data.has_video || false,
              isScreenSharing: data.is_screen_sharing || false
            } 
          : u
        )
      
      setVoiceChannelUsers(prev => ({
        ...prev,
        [channelId]: updateUser(prev[channelId] || [])
      }))
      
      if (stateRef.current.channelId === channelId) {
        setState(prev => ({
          ...prev,
          connectedUsers: updateUser(prev.connectedUsers)
        }))
      }
    }
  }, [user?.id, handleVoiceOffer, handleVoiceAnswer, handleIceCandidate, createOffer, closePeerConnection])

  useEffect(() => {
    const unsubscribe = subscribeToMessages(handleWebSocketMessage)
    return unsubscribe
  }, [subscribeToMessages, handleWebSocketMessage])

  const joinChannel = useCallback(async (channelId: string, channelName: string, guildId: string, guildName: string) => {
    if (state.isConnected && state.channelId === channelId) {
      return
    }

    if (state.isConnected && state.channelId) {
      broadcastVoiceEvent('voice-leave', {
        channel_id: state.channelId,
        user_id: user?.id
      })
      
      const oldChannelId = state.channelId
      setVoiceChannelUsers(prev => ({
        ...prev,
        [oldChannelId]: (prev[oldChannelId] || []).filter(u => u.id !== String(user?.id))
      }))
      
      stopVoiceActivityDetection()
      closeAllPeerConnections()
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }

    try {
      const iceServers = await getICEServers()
      console.log('Using ICE servers:', iceServers.length)
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16
        }
      })
      localStreamRef.current = stream

      audioContextRef.current = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: 48000
      })
      
      const existingParticipants = await fetchExistingParticipants(channelId)
      
      const currentUser: VoiceUser = {
        id: String(user?.id),
        username: user?.username || 'User',
        avatar: user?.avatar,
        isMuted: state.isMuted,
        isDeafened: state.isDeafened,
        isSpeaking: false,
        hasVideo: false,
        isScreenSharing: false,
        volume: 100
      }

      setState(prev => ({
        ...prev,
        isConnected: true,
        channelId,
        channelName,
        guildId,
        guildName,
        hasVideo: false,
        isScreenSharing: false,
        connectedUsers: [currentUser, ...existingParticipants.filter(p => p.id !== String(user?.id))],
        connectionQuality: 'excellent'
      }))
      
      setVoiceChannelUsers(prev => ({
        ...prev,
        [channelId]: [currentUser, ...existingParticipants.filter(p => p.id !== String(user?.id))]
      }))

      broadcastVoiceEvent('voice-join', {
        channel_id: channelId,
        user_id: user?.id,
        username: user?.username || 'User',
        avatar: user?.avatar,
        is_muted: state.isMuted,
        is_deafened: state.isDeafened,
        has_video: false,
        is_screen_sharing: false
      })

      // Perfect negotiation: новичок создаёт оффер только участникам с БОЛЬШИМ id
      // (т.е. когда новичок — impolite-сторона пары). Участники с меньшим id сами
      // отправят оффер новичку из обработчика voice-join. Вместе — ровно один оффер на пару.
      for (const participant of existingParticipants) {
        if (participant.id && participant.id !== 'undefined' && participant.id !== String(user?.id)) {
          // Запоминаем медиа-состояние из снапшота участников (screen vs camera)
          remoteMediaStateRef.current.set(participant.id, {
            video: participant.hasVideo || false,
            screen: participant.isScreenSharing || false
          })
          if (String(user?.id) < participant.id) {
            createOffer(participant.id)
          }
        }
      }

      startVoiceActivityDetection()

    } catch (error) {
      console.error('Failed to join voice channel:', error)
    }
  }, [state.isConnected, state.channelId, state.isMuted, state.isDeafened, user, broadcastVoiceEvent, startVoiceActivityDetection, stopVoiceActivityDetection, closeAllPeerConnections, fetchExistingParticipants, createOffer, getICEServers])

  const leaveChannel = useCallback(() => {
    const currentChannelId = state.channelId
    
    if (currentChannelId) {
      broadcastVoiceEvent('voice-leave', {
        channel_id: currentChannelId,
        user_id: user?.id
      })
      
      setVoiceChannelUsers(prev => ({
        ...prev,
        [currentChannelId]: (prev[currentChannelId] || []).filter(u => u.id !== String(user?.id))
      }))
    }

    stopVoiceActivityDetection()
    closeAllPeerConnections()

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }

    if (localVideoStreamRef.current) {
      localVideoStreamRef.current.getTracks().forEach(track => track.stop())
      localVideoStreamRef.current = null
    }

    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach(track => track.stop())
      localScreenStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setState(initialState)
  }, [state.channelId, user?.id, broadcastVoiceEvent, stopVoiceActivityDetection, closeAllPeerConnections])

  const toggleMute = useCallback(() => {
    setState(prev => {
      const newMuted = !prev.isMuted
      
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !newMuted
        })
      }

      if (prev.channelId) {
        broadcastVoiceEvent('voice-state-update', {
          channel_id: prev.channelId,
          user_id: user?.id,
          is_muted: newMuted,
          is_deafened: prev.isDeafened,
          is_speaking: false,
          has_video: prev.hasVideo,
          is_screen_sharing: prev.isScreenSharing
        })
      }

      return { ...prev, isMuted: newMuted, isSpeaking: false }
    })
  }, [user?.id, broadcastVoiceEvent])

  const toggleDeafen = useCallback(() => {
    setState(prev => {
      const newDeafened = !prev.isDeafened
      
      remoteAudioElementsRef.current.forEach(audioEl => {
        audioEl.muted = newDeafened
      })

      if (prev.channelId) {
        broadcastVoiceEvent('voice-state-update', {
          channel_id: prev.channelId,
          user_id: user?.id,
          is_muted: prev.isMuted || newDeafened,
          is_deafened: newDeafened,
          is_speaking: false,
          has_video: prev.hasVideo,
          is_screen_sharing: prev.isScreenSharing
        })
      }

      return { 
        ...prev, 
        isDeafened: newDeafened, 
        isMuted: prev.isMuted || newDeafened,
        isSpeaking: false 
      }
    })
  }, [user?.id, broadcastVoiceEvent])

  const toggleVideo = useCallback(async () => {
    if (!state.isConnected) return

    try {
      if (state.hasVideo) {
        // Disable video
        if (localVideoStreamRef.current) {
          localVideoStreamRef.current.getTracks().forEach(track => track.stop())
          localVideoStreamRef.current = null
        }
        
        setState(prev => ({ ...prev, hasVideo: false }))
        
        if (state.channelId) {
          broadcastVoiceEvent('voice-state-update', {
            channel_id: state.channelId,
            user_id: user?.id,
            is_muted: state.isMuted,
            is_deafened: state.isDeafened,
            is_speaking: state.isSpeaking,
            has_video: false,
            is_screen_sharing: state.isScreenSharing
          })
        }
      } else {
        // Enable video
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        })
        
        localVideoStreamRef.current = videoStream
        setState(prev => ({ ...prev, hasVideo: true }))
        
        if (state.channelId) {
          broadcastVoiceEvent('voice-state-update', {
            channel_id: state.channelId,
            user_id: user?.id,
            is_muted: state.isMuted,
            is_deafened: state.isDeafened,
            is_speaking: state.isSpeaking,
            has_video: true,
            is_screen_sharing: state.isScreenSharing
          })
        }
      }
      
      // Renegotiate all peer connections
      await renegotiateAll()
    } catch (error) {
      console.error('Failed to toggle video:', error)
    }
  }, [state, user?.id, broadcastVoiceEvent, renegotiateAll])

  const toggleScreenShare = useCallback(async () => {
    if (!state.isConnected) return

    try {
      if (state.isScreenSharing) {
        // Stop screen sharing
        if (localScreenStreamRef.current) {
          localScreenStreamRef.current.getTracks().forEach(track => track.stop())
          localScreenStreamRef.current = null
        }
        
        setState(prev => ({ ...prev, isScreenSharing: false }))
        
        if (state.channelId) {
          broadcastVoiceEvent('voice-state-update', {
            channel_id: state.channelId,
            user_id: user?.id,
            is_muted: state.isMuted,
            is_deafened: state.isDeafened,
            is_speaking: state.isSpeaking,
            has_video: state.hasVideo,
            is_screen_sharing: false
          })
        }
      } else {
        // Start screen sharing
        // audio: false — второй аудиотрек скриншэра затирал голосовой поток в ontrack
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: false
        })
        
        // Handle when user stops sharing via browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare()
        }
        
        localScreenStreamRef.current = screenStream
        setState(prev => ({ ...prev, isScreenSharing: true }))
        
        if (state.channelId) {
          broadcastVoiceEvent('voice-state-update', {
            channel_id: state.channelId,
            user_id: user?.id,
            is_muted: state.isMuted,
            is_deafened: state.isDeafened,
            is_speaking: state.isSpeaking,
            has_video: state.hasVideo,
            is_screen_sharing: true
          })
        }
      }
      
      // Renegotiate all peer connections
      await renegotiateAll()
    } catch (error) {
      console.error('Failed to toggle screen share:', error)
    }
  }, [state, user?.id, broadcastVoiceEvent, renegotiateAll])

  const setUserVolume = useCallback((userId: string, volume: number) => {
    const clampedVolume = Math.max(0, Math.min(200, volume))
    
    const audioEl = remoteAudioElementsRef.current.get(userId)
    if (audioEl) {
      audioEl.volume = clampedVolume / 100
    }
    
    setState(prev => ({
      ...prev,
      connectedUsers: prev.connectedUsers.map(u =>
        u.id === userId ? { ...u, volume: clampedVolume } : u
      )
    }))
    
    if (stateRef.current.channelId) {
      setVoiceChannelUsers(prev => ({
        ...prev,
        [stateRef.current.channelId!]: (prev[stateRef.current.channelId!] || []).map(u =>
          u.id === userId ? { ...u, volume: clampedVolume } : u
        )
      }))
    }
  }, [])

  const setRemoteSpeaking = useCallback((userId: string, isSpeaking: boolean) => {
    setState(prev => ({
      ...prev,
      connectedUsers: prev.connectedUsers.map(u =>
        u.id === userId ? { ...u, isSpeaking } : u
      )
    }))
    
    if (stateRef.current.channelId) {
      setVoiceChannelUsers(prev => ({
        ...prev,
        [stateRef.current.channelId!]: (prev[stateRef.current.channelId!] || []).map(u =>
          u.id === userId ? { ...u, isSpeaking } : u
        )
      }))
    }
  }, [])

  const syncConnectedUsers = useCallback((users: VoiceUser[]) => {
    setState(prev => ({
      ...prev,
      connectedUsers: users,
      isConnected: true
    }))
  }, [])

  const addConnectedUser = useCallback((user: VoiceUser) => {
    setState(prev => {
      if (prev.connectedUsers.some(u => u.id === user.id)) {
        return prev
      }
      return {
        ...prev,
        connectedUsers: [...prev.connectedUsers, user]
      }
    })
  }, [])

  const removeConnectedUser = useCallback((userId: string) => {
    setState(prev => ({
      ...prev,
      connectedUsers: prev.connectedUsers.filter(u => u.id !== userId)
    }))
  }, [])

  useEffect(() => {
    return () => {
      stopVoiceActivityDetection()
      closeAllPeerConnections()
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [stopVoiceActivityDetection, closeAllPeerConnections])

  return (
    <VoiceContext.Provider value={{ 
      state, 
      voiceChannelUsers,
      localVideoStream: localVideoStreamRef.current,
      localScreenStream: localScreenStreamRef.current,
      joinChannel, 
      leaveChannel, 
      toggleMute, 
      toggleDeafen,
      toggleVideo,
      toggleScreenShare,
      setUserVolume, 
      setRemoteSpeaking, 
      syncConnectedUsers, 
      addConnectedUser, 
      removeConnectedUser, 
      getICEServers,
      sendWebSocketMessage,
      subscribeToMessages
    }}>
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  const context = useContext(VoiceContext)
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider')
  }
  return context
}
