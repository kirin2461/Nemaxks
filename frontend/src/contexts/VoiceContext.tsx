import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { useNotifications } from '@/contexts/NotificationContext'

interface VoiceUser {
  id: string
  username: string
  avatar?: string
  isMuted: boolean
  isDeafened: boolean
  isSpeaking: boolean
  volume: number
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
  connectedUsers: VoiceUser[]
  connectionQuality: 'excellent' | 'good' | 'poor'
}

interface VoiceChannelUsers {
  [channelId: string]: VoiceUser[]
}

interface VoiceContextValue {
  state: VoiceState
  voiceChannelUsers: VoiceChannelUsers
  joinChannel: (channelId: string, channelName: string, guildId: string, guildName: string) => Promise<void>
  leaveChannel: () => void
  toggleMute: () => void
  toggleDeafen: () => void
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
  connectedUsers: [],
  connectionQuality: 'excellent'
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
]

async function fetchICEServers(): Promise<RTCIceServer[]> {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/rtc/ice-servers', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      if (data.iceServers && Array.isArray(data.iceServers)) {
        return data.iceServers
      }
    }
  } catch (error) {
    console.error('Failed to fetch ICE servers:', error)
  }
  return DEFAULT_ICE_SERVERS
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useStore()
  const { subscribeToMessages, sendWebSocketMessage } = useNotifications()
  const [state, setState] = useState<VoiceState>(initialState)
  const [voiceChannelUsers, setVoiceChannelUsers] = useState<VoiceChannelUsers>({})
  
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const speakingAnimationRef = useRef<number | null>(null)
  const stateRef = useRef(state)
  
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const remoteAudioAnalysersRef = useRef<Map<string, { audioContext: AudioContext; analyser: AnalyserNode; animationId: number }>>(new Map())
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map())
  const createOfferRef = useRef<((peerId: string) => Promise<void>) | null>(null)
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS)
  
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const broadcastVoiceEvent = useCallback((type: string, data: object) => {
    sendWebSocketMessage({ type, ...data })
  }, [sendWebSocketMessage])

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ 
      iceServers: iceServersRef.current,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    })
    
    pc.onicecandidate = (event) => {
      if (event.candidate && stateRef.current.channelId) {
        sendWebSocketMessage({
          type: 'voice-ice-candidate',
          targetUserId: peerId,
          channel_id: stateRef.current.channelId,
          candidate: event.candidate.toJSON()
        })
      }
    }
    
    pc.ontrack = (event) => {
      console.log(`Received remote track from ${peerId}`)
      let audioEl = remoteAudioElementsRef.current.get(peerId)
      if (!audioEl) {
        audioEl = new Audio()
        audioEl.autoplay = true
        remoteAudioElementsRef.current.set(peerId, audioEl)
      }
      audioEl.srcObject = event.streams[0]
      audioEl.play().catch(console.error)
      
      startRemoteVoiceAnalysis(peerId, event.streams[0])
    }
    
    pc.onconnectionstatechange = () => {
      console.log(`Peer ${peerId} connection state: ${pc.connectionState}`)
      if (pc.connectionState === 'failed') {
        console.log(`Attempting to reconnect with peer ${peerId}`)
        closePeerConnection(peerId)
        setTimeout(() => {
          if (stateRef.current.isConnected && stateRef.current.connectedUsers.some(u => u.id === peerId)) {
            createOfferRef.current?.(peerId)
          }
        }, 1000)
      } else if (pc.connectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.connectionState === 'disconnected') {
            closePeerConnection(peerId)
          }
        }, 5000)
      }
    }
    
    pc.oniceconnectionstatechange = () => {
      console.log(`Peer ${peerId} ICE state: ${pc.iceConnectionState}`)
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce()
      }
    }
    
    // Применяем настройки качества при создании соединения
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'connected') {
        const senders = pc.getSenders();
        senders.forEach(sender => {
          if (sender.track && sender.track.kind === 'audio') {
            const params = sender.getParameters();
            if (!params.encodings) params.encodings = [{}];
            params.encodings[0].maxBitrate = 128000;
            sender.setParameters(params).catch(console.error);
          }
        });
      }
    });
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }
    
    peerConnectionsRef.current.set(peerId, pc)
    return pc
  }, [sendWebSocketMessage])

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
    
    stopRemoteVoiceAnalysis(peerId)
    pendingCandidatesRef.current.delete(peerId)
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
    pendingCandidatesRef.current.clear()
  }, [stopRemoteVoiceAnalysis])

  const createOffer = useCallback(async (peerId: string) => {
    console.log(`Creating offer for peer ${peerId}`)
    let pc = peerConnectionsRef.current.get(peerId)
    if (!pc) {
      pc = createPeerConnection(peerId)
    }
    
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      sendWebSocketMessage({
        type: 'voice-offer',
        targetUserId: peerId,
        channel_id: stateRef.current.channelId,
        sdp: offer.sdp
      })
    } catch (error) {
      console.error('Error creating offer:', error)
    }
  }, [createPeerConnection, sendWebSocketMessage])

  useEffect(() => {
    createOfferRef.current = createOffer
  }, [createOffer])

  const handleVoiceOffer = useCallback(async (fromUserId: string, sdp: string, channelId: string) => {
    if (!stateRef.current.isConnected) return
    if (channelId && channelId !== 'undefined' && channelId !== 'null' && stateRef.current.channelId !== channelId) return
    if (fromUserId === String(user?.id)) return
    
    console.log(`Received voice offer from ${fromUserId}`)
    let pc = peerConnectionsRef.current.get(fromUserId)
    if (!pc) {
      pc = createPeerConnection(fromUserId)
    }
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }))
      
      const pendingCandidates = pendingCandidatesRef.current.get(fromUserId) || []
      for (const candidate of pendingCandidates) {
        await pc.addIceCandidate(candidate)
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
    } catch (error) {
      console.error('Error handling voice offer:', error)
    }
  }, [createPeerConnection, sendWebSocketMessage, user?.id])

  const handleVoiceAnswer = useCallback(async (fromUserId: string, sdp: string) => {
    if (!stateRef.current.isConnected) return
    if (fromUserId === String(user?.id)) return
    
    console.log(`Received voice answer from ${fromUserId}`)
    const pc = peerConnectionsRef.current.get(fromUserId)
    if (!pc) return
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }))
      
      const pendingCandidates = pendingCandidatesRef.current.get(fromUserId) || []
      for (const candidate of pendingCandidates) {
        await pc.addIceCandidate(candidate)
      }
      pendingCandidatesRef.current.delete(fromUserId)
    } catch (error) {
      console.error('Error handling voice answer:', error)
    }
  }, [user?.id])

  const handleIceCandidate = useCallback(async (fromUserId: string, candidateData: RTCIceCandidateInit) => {
    if (!stateRef.current.isConnected) return
    if (fromUserId === String(user?.id)) return
    if (!candidateData) return
    
    const pc = peerConnectionsRef.current.get(fromUserId)
    const candidate = new RTCIceCandidate(candidateData)
    
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(candidate)
      } catch (error) {
        console.error('Error adding ICE candidate:', error)
      }
    } else {
      const pending = pendingCandidatesRef.current.get(fromUserId) || []
      pending.push(candidate)
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
            is_speaking: shouldBeSpeaking
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
        volume: 100
      }
      
      setVoiceChannelUsers(prev => {
        const channelUsers = prev[channelId] || []
        if (channelUsers.some(u => u.id === userId)) {
          return prev
        }
        return { ...prev, [channelId]: [...channelUsers, voiceUser] }
      })
      
      if (stateRef.current.channelId === channelId && userId !== String(user?.id)) {
        setState(prev => ({
          ...prev,
          connectedUsers: prev.connectedUsers.some(u => u.id === userId)
            ? prev.connectedUsers
            : [...prev.connectedUsers, voiceUser]
        }))
        
        createOffer(userId)
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
      const updateUser = (users: VoiceUser[]) => 
        users.map(u => u.id === userId 
          ? { ...u, isMuted: data.is_muted, isDeafened: data.is_deafened, isSpeaking: data.is_speaking } 
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
      iceServersRef.current = await fetchICEServers()
      console.log('Using ICE servers:', iceServersRef.current.length)
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16,
          // Улучшенные параметры для качества речи
          ...({
            googEchoCancellation: true,
            googAutoGainControl: true,
            googNoiseSuppression: true,
            googHighpassFilter: true,
            googTypingNoiseDetection: true,
            googAudioMirroring: false
          } as any)
        }
      })
      localStreamRef.current = stream

      // Оптимизация битрейта и параметров WebRTC
      const updateSenderParameters = (pc: RTCPeerConnection) => {
        pc.getSenders().forEach(sender => {
          if (sender.track && sender.track.kind === 'audio') {
            const parameters = sender.getParameters();
            if (!parameters.encodings) {
              parameters.encodings = [{}];
            }
            // Устанавливаем высокий битрейт для аудио (Опус обычно 32-64kbps достаточно, но можно до 128)
            parameters.encodings[0].maxBitrate = 128000;
            sender.setParameters(parameters).catch(err => console.error('Error setting audio parameters:', err));
          }
        });
      };
      
      // Вызываем для всех существующих соединений
      peerConnectionsRef.current.forEach(pc => updateSenderParameters(pc));

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
        volume: 100
      }

      setState(prev => ({
        ...prev,
        isConnected: true,
        channelId,
        channelName,
        guildId,
        guildName,
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
        is_deafened: state.isDeafened
      })

      for (const participant of existingParticipants) {
        if (participant.id && participant.id !== 'undefined' && participant.id !== String(user?.id)) {
          createOffer(participant.id)
        }
      }

      startVoiceActivityDetection()

    } catch (error) {
      console.error('Failed to join voice channel:', error)
    }
  }, [state.isConnected, state.channelId, state.isMuted, state.isDeafened, user, broadcastVoiceEvent, startVoiceActivityDetection, stopVoiceActivityDetection, closeAllPeerConnections, fetchExistingParticipants, createOffer])

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
          is_speaking: false
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
          is_speaking: false
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

  const getICEServers = useCallback(async (): Promise<RTCIceServer[]> => {
    if (iceServersRef.current.length > 0) {
      return iceServersRef.current
    }
    iceServersRef.current = await fetchICEServers()
    return iceServersRef.current
  }, [])

  useEffect(() => {
    return () => {
      stopVoiceActivityDetection()
      closeAllPeerConnections()
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
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
      joinChannel, 
      leaveChannel, 
      toggleMute, 
      toggleDeafen, 
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
