import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Headphones,
  PhoneOff,
  Settings,
  Monitor,
  Video,
  VideoOff,
  Sparkles,
  Activity,
  Shield,
  Sliders,
  Users,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { useVoice } from '@/contexts/VoiceContext'

interface VoiceUser {
  id: number
  username: string
  avatar?: string
  isSpeaking: boolean
  isMuted: boolean
  isDeafened: boolean
  isScreenSharing: boolean
  hasVideo: boolean
  volume: number
}

interface VoiceChannelProps {
  channelId: number
  channelName: string
  guildName: string
  onDisconnect: () => void
}

interface AudioSettings {
  noiseSuppression: boolean
  echoCancellation: boolean
  autoGainControl: boolean
  noiseGateEnabled: boolean
  noiseGateThreshold: number
  inputVolume: number
  outputVolume: number
}

type CallState = 'idle' | 'connecting' | 'ringing' | 'connected'

export function VoiceChannel({ channelId, channelName, guildName, onDisconnect }: VoiceChannelProps) {
  const { user } = useStore()
  const { state: voiceState, setRemoteSpeaking, syncConnectedUsers, addConnectedUser, removeConnectedUser, getICEServers, sendWebSocketMessage, subscribeToMessages } = useVoice()
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isMicTesting, setIsMicTesting] = useState(false)
  const [micTestLevel, setMicTestLevel] = useState(0)
  const micTestStreamRef = useRef<MediaStream | null>(null)
  const micTestAnalyserRef = useRef<AnalyserNode | null>(null)
  const micTestAnimationRef = useRef<number | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  
  const connectedUsers: VoiceUser[] = voiceState.connectedUsers
    .filter(u => u.id !== String(user?.id))
    .map(u => ({
      id: parseInt(u.id) || 0,
      username: u.username,
      avatar: u.avatar,
      isSpeaking: u.isSpeaking,
      isMuted: u.isMuted,
      isDeafened: u.isDeafened,
      isScreenSharing: false,
      hasVideo: false,
      volume: u.volume
    }))
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent')
  const [showParticipants, setShowParticipants] = useState(true)
  const [remoteVideos, setRemoteVideos] = useState<Map<number, MediaStream>>(new Map())
  const [fullscreenUserId, setFullscreenUserId] = useState<number | 'local' | null>(null)
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false)
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null)
  const fullscreenContainerRef = useRef<HTMLDivElement>(null)
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null)
  const remoteVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map())
  const videoSendersRef = useRef<Map<number, RTCRtpSender>>(new Map())
  const screenSendersRef = useRef<Map<number, RTCRtpSender>>(new Map())
  const localVideoStreamRef = useRef<MediaStream | null>(null)
  const screenShareStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioAnalysersRef = useRef<Map<number, { audioContext: AudioContext; analyser: AnalyserNode; animationId: number }>>(new Map())
  const remoteAudioElementsRef = useRef<Map<number, HTMLAudioElement>>(new Map())
  const iceServersRef = useRef<RTCIceServer[]>([])
  
  const [callState, setCallState] = useState<CallState>('idle')
  const callStateRef = useRef<CallState>('idle')
  const dialToneContextRef = useRef<AudioContext | null>(null)
  const dialToneOscillatorsRef = useRef<OscillatorNode[]>([])
  const dialToneGainRef = useRef<GainNode | null>(null)
  const dialToneIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    callStateRef.current = callState
  }, [callState])
  
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    noiseGateEnabled: true,
    noiseGateThreshold: -50,
    inputVolume: 100,
    outputVolume: 100
  })

  const localStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const noiseGateRef = useRef<GainNode | null>(null)
  const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(new Map())
  const wsRef = useRef<WebSocket | null>(null)

  const startDialTone = useCallback(() => {
    if (dialToneContextRef.current || isDeafened) return
    
    try {
      const ctx = new AudioContext()
      dialToneContextRef.current = ctx
      
      const masterGain = ctx.createGain()
      masterGain.gain.value = 0
      masterGain.connect(ctx.destination)
      dialToneGainRef.current = masterGain
      
      const playTone = () => {
        if (!dialToneContextRef.current) return
        
        dialToneOscillatorsRef.current.forEach(osc => {
          try { osc.stop() } catch {}
        })
        dialToneOscillatorsRef.current = []
        
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        osc1.frequency.value = 440
        osc2.frequency.value = 480
        osc1.type = 'sine'
        osc2.type = 'sine'
        
        const toneGain = ctx.createGain()
        toneGain.gain.value = 0.15 * (audioSettings.outputVolume / 100)
        
        osc1.connect(toneGain)
        osc2.connect(toneGain)
        toneGain.connect(masterGain)
        
        masterGain.gain.setValueAtTime(1, ctx.currentTime)
        masterGain.gain.setValueAtTime(1, ctx.currentTime + 1.5)
        masterGain.gain.setValueAtTime(0, ctx.currentTime + 1.5)
        
        osc1.start(ctx.currentTime)
        osc2.start(ctx.currentTime)
        osc1.stop(ctx.currentTime + 1.5)
        osc2.stop(ctx.currentTime + 1.5)
        
        dialToneOscillatorsRef.current = [osc1, osc2]
      }
      
      playTone()
      dialToneIntervalRef.current = setInterval(playTone, 3000)
      
    } catch (err) {
      console.error('Failed to start dial tone:', err)
    }
  }, [isDeafened, audioSettings.outputVolume])

  const stopDialTone = useCallback(() => {
    if (dialToneIntervalRef.current) {
      clearInterval(dialToneIntervalRef.current)
      dialToneIntervalRef.current = null
    }
    
    dialToneOscillatorsRef.current.forEach(osc => {
      try { osc.stop() } catch {}
    })
    dialToneOscillatorsRef.current = []
    
    if (dialToneContextRef.current) {
      dialToneContextRef.current.close()
      dialToneContextRef.current = null
    }
    dialToneGainRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      stopDialTone()
    }
  }, [stopDialTone])
  
  void startDialTone

  const startVoiceActivity = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    let smoothedLevel = 0
    let gateOpen = false
    let holdCounter = 0
    const holdTime = 10
    const attackTime = 0.02
    const releaseTime = 0.15
    
    const checkVoice = () => {
      if (!analyserRef.current) return
      analyserRef.current.getByteFrequencyData(dataArray)
      
      const voiceBands = dataArray.slice(2, 40)
      const rawLevel = voiceBands.reduce((a, b) => a + b, 0) / voiceBands.length
      smoothedLevel = smoothedLevel * 0.7 + rawLevel * 0.3
      
      const threshold = audioSettings.noiseGateEnabled 
        ? Math.pow(10, (audioSettings.noiseGateThreshold + 40) / 40) * 30
        : 15

      const isAboveThreshold = smoothedLevel > threshold
      
      if (isAboveThreshold) {
        gateOpen = true
        holdCounter = holdTime
      } else if (holdCounter > 0) {
        holdCounter--
      } else {
        gateOpen = false
      }

      setIsSpeaking(gateOpen)

      if (noiseGateRef.current && audioSettings.noiseGateEnabled) {
        const targetGain = gateOpen ? 1 : 0
        const transitionTime = gateOpen ? attackTime : releaseTime
        noiseGateRef.current.gain.setTargetAtTime(
          targetGain,
          noiseGateRef.current.context.currentTime,
          transitionTime
        )
      }

      requestAnimationFrame(checkVoice)
    }
    
    checkVoice()
  }, [audioSettings.noiseGateEnabled, audioSettings.noiseGateThreshold])

  const startRemoteVoiceActivity = useCallback((userId: number, stream: MediaStream) => {
    const existing = remoteAudioAnalysersRef.current.get(userId)
    if (existing) {
      cancelAnimationFrame(existing.animationId)
      existing.audioContext.close().catch(() => {})
      remoteAudioAnalysersRef.current.delete(userId)
    }

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) return

    try {
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let smoothedLevel = 0
      let isSpeakingNow = false
      let holdCounter = 0
      const holdTime = 8

      const checkRemoteVoice = () => {
        analyser.getByteFrequencyData(dataArray)
        
        const voiceBands = dataArray.slice(2, 40)
        const rawLevel = voiceBands.reduce((a, b) => a + b, 0) / voiceBands.length
        smoothedLevel = smoothedLevel * 0.7 + rawLevel * 0.3
        
        const threshold = 20
        const isAboveThreshold = smoothedLevel > threshold
        
        if (isAboveThreshold) {
          holdCounter = holdTime
          if (!isSpeakingNow) {
            isSpeakingNow = true
            setRemoteSpeaking(String(userId), true)
          }
        } else if (holdCounter > 0) {
          holdCounter--
        } else if (isSpeakingNow) {
          isSpeakingNow = false
          setRemoteSpeaking(String(userId), false)
        }

        const animId = requestAnimationFrame(checkRemoteVoice)
        const entry = remoteAudioAnalysersRef.current.get(userId)
        if (entry) {
          entry.animationId = animId
        }
      }
      
      const animationId = requestAnimationFrame(checkRemoteVoice)
      remoteAudioAnalysersRef.current.set(userId, { audioContext, analyser, animationId })
    } catch (err) {
      console.error('Failed to start remote voice activity detection:', err)
    }
  }, [setRemoteSpeaking])

  const stopRemoteVoiceActivity = useCallback((userId: number) => {
    const entry = remoteAudioAnalysersRef.current.get(userId)
    if (entry) {
      cancelAnimationFrame(entry.animationId)
      entry.audioContext.close().catch(() => {})
      remoteAudioAnalysersRef.current.delete(userId)
    }
    setRemoteSpeaking(String(userId), false)
  }, [setRemoteSpeaking])

  const toggleBrowserFullscreen = useCallback((userId: number | 'local') => {
    if (!fullscreenContainerRef.current) return
    
    if (!document.fullscreenElement) {
      fullscreenContainerRef.current.requestFullscreen?.().then(() => {
        setFullscreenUserId(userId)
        setIsBrowserFullscreen(true)
      }).catch(() => {
        setFullscreenUserId(userId)
      })
    } else {
      document.exitFullscreen?.().then(() => {
        setFullscreenUserId(null)
        setIsBrowserFullscreen(false)
      })
    }
  }, [])

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.()
    }
    setFullscreenUserId(null)
    setIsBrowserFullscreen(false)
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsBrowserFullscreen(false)
        setFullscreenUserId(null)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const connectToVoice = useCallback(async () => {
    try {
      setCallState('connecting')
      
      iceServersRef.current = await getICEServers()
      console.log('VoiceChannel using ICE servers:', iceServersRef.current.length)
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: audioSettings.noiseSuppression,
          echoCancellation: audioSettings.echoCancellation,
          autoGainControl: audioSettings.autoGainControl,
          sampleRate: 48000,
          channelCount: 1
        },
        video: false
      })

      localStreamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: 48000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)

      const highPassFilter = audioContext.createBiquadFilter()
      highPassFilter.type = 'highpass'
      highPassFilter.frequency.value = 80
      highPassFilter.Q.value = 0.7

      const lowPassFilter = audioContext.createBiquadFilter()
      lowPassFilter.type = 'lowpass'
      lowPassFilter.frequency.value = 12000
      lowPassFilter.Q.value = 0.7

      const compressor = audioContext.createDynamicsCompressor()
      compressor.threshold.value = -24
      compressor.knee.value = 30
      compressor.ratio.value = 12
      compressor.attack.value = 0.003
      compressor.release.value = 0.25

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser

      const gainNode = audioContext.createGain()
      gainNode.gain.value = audioSettings.inputVolume / 100
      gainNodeRef.current = gainNode

      const noiseGate = audioContext.createGain()
      noiseGate.gain.value = 1
      noiseGateRef.current = noiseGate

      // Create destination to pipe processed audio back to stream
      const destination = audioContext.createMediaStreamDestination()

      // Connect the processing chain
      source.connect(highPassFilter)
      highPassFilter.connect(lowPassFilter)
      lowPassFilter.connect(compressor)
      compressor.connect(analyser)
      analyser.connect(noiseGate)
      noiseGate.connect(gainNode)
      gainNode.connect(destination)

      // Replace localStreamRef with processed audio stream
      const processedAudioTrack = destination.stream.getAudioTracks()[0]
      const processedStream = new MediaStream([processedAudioTrack])

      // Store both original and processed streams
      const originalStream = localStreamRef.current
      localStreamRef.current = processedStream

      setIsConnected(true)
      startVoiceActivity()

      connectWebSocket()

    } catch (err) {
      console.error('Failed to connect to voice:', err)
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      setIsConnected(false)
      setCallState('idle')
      stopDialTone()
    }
  }, [audioSettings, startVoiceActivity, stopDialTone, getICEServers])

  const connectWebSocket = useCallback(() => {
    wsRef.current = { readyState: WebSocket.OPEN } as any // Mock WS for internal logic if needed
    
    // Use NotificationContext's socket via subscribeToMessages
    const unsubscribe = subscribeToMessages(async (data: any) => {
      switch (data.type) {
        case 'voice-users':
          if (data.users && Array.isArray(data.users)) {
            const voiceUsers = data.users
              .filter((u: { id: number }) => u.id !== user?.id)
              .map((u: { id: number; username: string; avatar?: string }) => ({
                id: String(u.id),
                username: u.username,
                avatar: u.avatar,
                isSpeaking: false,
                isMuted: false,
                isDeafened: false,
                volume: 100
              }))
            syncConnectedUsers(voiceUsers)
          }
          if (callStateRef.current === 'connecting') {
            setCallState('connected')
          }
          break
        case 'voice-offer':
          if (callStateRef.current === 'connecting') {
            setCallState('connected')
          }
          await handleOffer(data.fromUserId, data.offer)
          break
        case 'voice-answer':
          await handleAnswer(data.fromUserId, data.answer)
          break
        case 'voice-ice-candidate':
          await handleIceCandidate(data.fromUserId, data.candidate)
          break
        case 'voice-user-joined':
          if (callStateRef.current === 'connecting') {
            setCallState('connected')
          }
          if (data.userId && data.username) {
            addConnectedUser({
              id: String(data.userId),
              username: data.username,
              avatar: data.avatar,
              isSpeaking: false,
              isMuted: false,
              isDeafened: false,
              volume: 100
            })
          }
          await createPeerConnection(data.userId)
          break
        case 'voice-user-left':
          removeConnectedUser(String(data.userId))
          closePeerConnection(data.userId)
          break
      }
    })

    sendWebSocketMessage({
      type: 'voice-join',
      channelId
    })

    setTimeout(() => {
      if (callStateRef.current === 'connecting') {
        setCallState('connected')
      }
    }, 3000)

    return unsubscribe
  }, [channelId, syncConnectedUsers, addConnectedUser, removeConnectedUser, user?.id, sendWebSocketMessage, subscribeToMessages])

  // Need to handle the return from connectWebSocket in useEffect
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    if (isConnected) {
      unsubscribe = connectWebSocket()
    }
    return () => {
      if (unsubscribe) unsubscribe()
      if (isConnected) {
        sendWebSocketMessage({
          type: 'voice-leave',
          channelId
        })
      }
    }
  }, [isConnected, connectWebSocket, sendWebSocketMessage, channelId])

  const createPeerConnection = async (userId: number) => {
    const iceConfig = iceServersRef.current.length > 0 
      ? iceServersRef.current 
      : await getICEServers()
    
    const pc = new RTCPeerConnection({
      iceServers: iceConfig,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    })

    peerConnectionsRef.current.set(userId, pc)

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        const sender = pc.addTrack(track, localStreamRef.current!)
        if (track.kind === 'audio') {
          const params = sender.getParameters()
          if (!params.encodings) {
            params.encodings = [{}]
          }
          params.encodings[0].maxBitrate = 128000
          params.encodings[0].priority = 'high'
          params.encodings[0].networkPriority = 'high'
          sender.setParameters(params).catch(console.error)
        }
      })
    }

    if (localVideoStreamRef.current) {
      const videoTrack = localVideoStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        const clonedTrack = videoTrack.clone()
        const peerStream = new MediaStream([clonedTrack])
        const sender = pc.addTrack(clonedTrack, peerStream)
        videoSendersRef.current.set(userId, sender)
      }
    }

    if (screenShareStreamRef.current) {
      const screenTrack = screenShareStreamRef.current.getVideoTracks()[0]
      if (screenTrack) {
        const clonedTrack = screenTrack.clone()
        const peerStream = new MediaStream([clonedTrack])
        const sender = pc.addTrack(clonedTrack, peerStream)
        screenSendersRef.current.set(userId, sender)
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendWebSocketMessage({
          type: 'voice-ice-candidate',
          targetUserId: userId,
          channel_id: String(channelId),
          candidate: event.candidate
        })
      }
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0]
      const hasVideo = stream.getVideoTracks().length > 0
      const hasAudio = stream.getAudioTracks().length > 0

      if (hasVideo) {
        setRemoteVideos(prev => new Map(prev).set(userId, stream))

        stream.getVideoTracks().forEach(track => {
          track.onended = () => {
            setRemoteVideos(prev => {
              const newMap = new Map(prev)
              newMap.delete(userId)
              return newMap
            })
          }
        })
      }

      if (hasAudio) {
        console.log(`Received audio track from user ${userId}`)

        // Get or create audio element for this user
        let audioEl = remoteAudioElementsRef.current.get(userId)
        if (!audioEl) {
          console.log(`Creating new audio element for user ${userId}`)
          audioEl = new Audio()
          audioEl.autoplay = true
          remoteAudioElementsRef.current.set(userId, audioEl)
          // Attach to DOM to prevent garbage collection
          audioEl.style.display = 'none'
          document.body.appendChild(audioEl)
        }

        audioEl.srcObject = stream
        audioEl.volume = audioSettings.outputVolume / 100
        audioEl.play().then(() => {
          console.log(`Successfully playing audio from user ${userId}`)
        }).catch(e => {
          console.error(`Failed to play remote audio from user ${userId}:`, e)
        })

        startRemoteVoiceActivity(userId, stream)
      }
    }

    pc.onconnectionstatechange = () => {
      console.log(`Peer ${userId} connection state: ${pc.connectionState}`)
      if (pc.connectionState === 'connected') {
        setConnectionQuality('excellent')
        setCallState('connected')
      } else if (pc.connectionState === 'disconnected') {
        setConnectionQuality('poor')
        setTimeout(async () => {
          if (pc.connectionState === 'disconnected') {
            console.log(`Peer ${userId} still disconnected, attempting ICE restart with new offer`)
            try {
              const offer = await pc.createOffer({ iceRestart: true })
              await pc.setLocalDescription(offer)
              sendWebSocketMessage({
                type: 'voice-offer',
                targetUserId: userId,
                channel_id: String(channelId),
                offer
              })
            } catch (err) {
              console.error(`ICE restart failed for peer ${userId}:`, err)
            }
          }
        }, 3000)
      } else if (pc.connectionState === 'failed') {
        console.log(`Peer ${userId} connection failed, closing and reconnecting`)
        closePeerConnection(userId)
        setTimeout(() => {
          if (isConnected && wsRef.current?.readyState === WebSocket.OPEN) {
            createPeerConnection(userId)
          }
        }, 2000)
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log(`Peer ${userId} ICE state: ${pc.iceConnectionState}`)
      if (pc.iceConnectionState === 'failed') {
        console.log(`Peer ${userId} ICE failed, restarting`)
        pc.restartIce()
      }
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    sendWebSocketMessage({
      type: 'voice-offer',
      targetUserId: userId,
      channel_id: String(channelId),
      offer,
      callerName: user?.username || 'User',
      callerAvatar: user?.avatar,
      channelId: String(channelId)
    })
  }

  const handleOffer = async (fromUserId: string, offer: RTCSessionDescriptionInit) => {
    let pc = peerConnectionsRef.current.get(parseInt(fromUserId))
    
    if (!pc) {
      const iceConfig = iceServersRef.current.length > 0 
        ? iceServersRef.current 
        : await getICEServers()
      
      pc = new RTCPeerConnection({
        iceServers: iceConfig,
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      })
      peerConnectionsRef.current.set(parseInt(fromUserId), pc)

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          const sender = pc!.addTrack(track, localStreamRef.current!)
          if (track.kind === 'audio') {
            const params = sender.getParameters()
            if (!params.encodings) {
              params.encodings = [{}]
            }
            params.encodings[0].maxBitrate = 128000
            params.encodings[0].priority = 'high'
            params.encodings[0].networkPriority = 'high'
            sender.setParameters(params).catch(console.error)
          }
        })
      }

      if (localVideoStreamRef.current) {
        const videoTrack = localVideoStreamRef.current.getVideoTracks()[0]
        if (videoTrack) {
          const clonedTrack = videoTrack.clone()
          const peerStream = new MediaStream([clonedTrack])
          const sender = pc.addTrack(clonedTrack, peerStream)
          videoSendersRef.current.set(parseInt(fromUserId), sender)
        }
      }

      if (screenShareStreamRef.current) {
        const screenTrack = screenShareStreamRef.current.getVideoTracks()[0]
        if (screenTrack) {
          const clonedTrack = screenTrack.clone()
          const peerStream = new MediaStream([clonedTrack])
          const sender = pc.addTrack(clonedTrack, peerStream)
          screenSendersRef.current.set(parseInt(fromUserId), sender)
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWebSocketMessage({
            type: 'voice-ice-candidate',
            targetUserId: fromUserId,
            candidate: event.candidate
          })
        }
      }

      pc.ontrack = (event) => {
        const stream = event.streams[0]
        const hasVideo = stream.getVideoTracks().length > 0
        const hasAudio = stream.getAudioTracks().length > 0

        if (hasVideo) {
          setRemoteVideos(prev => new Map(prev).set(parseInt(fromUserId), stream))

          stream.getVideoTracks().forEach(track => {
            track.onended = () => {
              setRemoteVideos(prev => {
                const newMap = new Map(prev)
                newMap.delete(parseInt(fromUserId))
                return newMap
              })
            }
          })
        }

        if (hasAudio) {
          console.log(`Received audio track from user ${fromUserId}`)

          // Get or create audio element for this user
          let audioEl = remoteAudioElementsRef.current.get(parseInt(fromUserId))
          if (!audioEl) {
            console.log(`Creating new audio element for user ${fromUserId}`)
            audioEl = new Audio()
            audioEl.autoplay = true
            remoteAudioElementsRef.current.set(parseInt(fromUserId), audioEl)
            // Attach to DOM to prevent garbage collection
            audioEl.style.display = 'none'
            document.body.appendChild(audioEl)
          }

          audioEl.srcObject = stream
          audioEl.volume = audioSettings.outputVolume / 100
          audioEl.play().then(() => {
            console.log(`Successfully playing audio from user ${fromUserId}`)
          }).catch(e => {
            console.error(`Failed to play remote audio from user ${fromUserId}:`, e)
          })

          startRemoteVoiceActivity(parseInt(fromUserId), stream)
        }
      }

      pc.onconnectionstatechange = () => {
        console.log(`Peer ${fromUserId} connection state: ${pc?.connectionState}`)
        if (pc?.connectionState === 'connected') {
          setConnectionQuality('excellent')
          setCallState('connected')
        } else if (pc?.connectionState === 'disconnected') {
          setConnectionQuality('poor')
          setTimeout(async () => {
            if (pc?.connectionState === 'disconnected') {
              console.log(`Peer ${fromUserId} still disconnected, attempting ICE restart with new offer`)
              try {
                const offer = await pc.createOffer({ iceRestart: true })
                await pc.setLocalDescription(offer)
                sendWebSocketMessage({
                  type: 'voice-offer',
                  targetUserId: fromUserId,
                  offer
                })
              } catch (err) {
                console.error(`ICE restart failed for peer ${fromUserId}:`, err)
              }
            }
          }, 3000)
        } else if (pc?.connectionState === 'failed') {
          console.log(`Peer ${fromUserId} connection failed`)
          closePeerConnection(parseInt(fromUserId))
        }
      }

      pc.oniceconnectionstatechange = () => {
        console.log(`Peer ${fromUserId} ICE state: ${pc?.iceConnectionState}`)
        if (pc?.iceConnectionState === 'failed') {
          console.log(`Peer ${fromUserId} ICE failed, restarting`)
          pc?.restartIce()
        }
      }
    }

    await pc!.setRemoteDescription(offer)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    sendWebSocketMessage({
      type: 'voice-answer',
      targetUserId: fromUserId,
      answer
    })
  }

  const handleAnswer = async (fromUserId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionsRef.current.get(parseInt(fromUserId))
    if (pc) {
      await pc.setRemoteDescription(answer)
    }
  }

  const handleIceCandidate = async (fromUserId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionsRef.current.get(parseInt(fromUserId))
    if (pc) {
      await pc.addIceCandidate(candidate)
    }
  }

  const renegotiateWithPeer = async (userId: number, pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'voice-offer',
          targetUserId: userId,
          offer
        }))
      }
    } catch (err) {
      console.error('Failed to renegotiate with peer:', err)
    }
  }

  const closePeerConnection = (userId: number) => {
    const pc = peerConnectionsRef.current.get(userId)
    if (pc) {
      pc.close()
      peerConnectionsRef.current.delete(userId)
    }

    // Cleanup audio elements
    const audioEl = remoteAudioElementsRef.current.get(userId)
    if (audioEl) {
      audioEl.pause()
      audioEl.srcObject = null
      if (audioEl.parentElement) {
        audioEl.parentElement.removeChild(audioEl)
      }
      remoteAudioElementsRef.current.delete(userId)
    }

    videoSendersRef.current.delete(userId)
    screenSendersRef.current.delete(userId)
    stopRemoteVoiceActivity(userId)
    setRemoteVideos(prev => {
      const newMap = new Map(prev)
      newMap.delete(userId)
      return newMap
    })
  }

  const disconnect = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    remoteAudioAnalysersRef.current.forEach((entry) => {
      cancelAnimationFrame(entry.animationId)
      entry.audioContext.close().catch(() => {})
    })
    remoteAudioAnalysersRef.current.clear()

    // Cleanup all remote audio elements
    remoteAudioElementsRef.current.forEach((audioEl, userId) => {
      audioEl.pause()
      audioEl.srcObject = null
      if (audioEl.parentElement) {
        audioEl.parentElement.removeChild(audioEl)
      }
    })
    remoteAudioElementsRef.current.clear()

    peerConnectionsRef.current.forEach(pc => pc.close())
    peerConnectionsRef.current.clear()

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'voice-leave',
          channelId
        }))
      }
      wsRef.current.close()
      wsRef.current = null
    }

    setIsConnected(false)
    setCallState('idle')
    stopDialTone()
    onDisconnect()
  }, [channelId, onDisconnect, stopDialTone])

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = isMuted
        setIsMuted(!isMuted)
      }
    }
  }, [isMuted])

  const toggleDeafen = useCallback(() => {
    setIsDeafened(!isDeafened)
  }, [isDeafened])

  const toggleVideo = useCallback(async () => {
    if (isVideoEnabled) {
      peerConnectionsRef.current.forEach((pc, oderId) => {
        const sender = videoSendersRef.current.get(oderId)
        if (sender) {
          pc.removeTrack(sender)
          videoSendersRef.current.delete(oderId)
        }
      })
      
      if (localVideoStream) {
        localVideoStream.getTracks().forEach(track => track.stop())
      }
      
      peerConnectionsRef.current.forEach((pc, oderId) => {
        renegotiateWithPeer(oderId, pc)
      })
      
      localVideoStreamRef.current = null
      setLocalVideoStream(null)
      setIsVideoEnabled(false)
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
        const videoTrack = videoStream.getVideoTracks()[0]
        
        localVideoStreamRef.current = videoStream
        
        peerConnectionsRef.current.forEach((pc, peerId) => {
          const clonedTrack = videoTrack.clone()
          const peerStream = new MediaStream([clonedTrack])
          const sender = pc.addTrack(clonedTrack, peerStream)
          videoSendersRef.current.set(peerId, sender)
          renegotiateWithPeer(peerId, pc)
        })

        setLocalVideoStream(videoStream)
        setIsVideoEnabled(true)
      } catch (err) {
        console.error('Failed to enable video:', err)
      }
    }
  }, [isVideoEnabled, localVideoStream])

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      peerConnectionsRef.current.forEach((pc, oderId) => {
        const sender = screenSendersRef.current.get(oderId)
        if (sender) {
          pc.removeTrack(sender)
          screenSendersRef.current.delete(oderId)
        }
      })
      
      if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => track.stop())
      }
      
      peerConnectionsRef.current.forEach((pc, oderId) => {
        renegotiateWithPeer(oderId, pc)
      })
      
      screenShareStreamRef.current = null
      setScreenShareStream(null)
      setIsScreenSharing(false)
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 60, max: 60 },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          // @ts-ignore - newer audio options for system audio capture
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            suppressLocalAudioPlayback: false
          },
          // @ts-ignore - newer display capture API options
          preferCurrentTab: false,
          selfBrowserSurface: 'exclude',
          surfaceSwitching: 'include',
          systemAudio: 'include',
          monitorTypeSurfaces: 'include'
        })
        
        const screenTrack = screenStream.getVideoTracks()[0]
        
        screenTrack.onended = () => {
          peerConnectionsRef.current.forEach((pc, oderId) => {
            const sender = screenSendersRef.current.get(oderId)
            if (sender) {
              pc.removeTrack(sender)
              screenSendersRef.current.delete(oderId)
            }
            renegotiateWithPeer(oderId, pc)
          })
          screenShareStreamRef.current = null
          setScreenShareStream(null)
          setIsScreenSharing(false)
        }

        screenShareStreamRef.current = screenStream
        
        peerConnectionsRef.current.forEach((pc, peerId) => {
          const clonedTrack = screenTrack.clone()
          const peerStream = new MediaStream([clonedTrack])
          const sender = pc.addTrack(clonedTrack, peerStream)
          screenSendersRef.current.set(peerId, sender)
          renegotiateWithPeer(peerId, pc)
        })

        setScreenShareStream(screenStream)
        setIsScreenSharing(true)
      } catch (err) {
        console.error('Failed to share screen:', err)
      }
    }
  }, [isScreenSharing, screenShareStream])

  const updateAudioSetting = useCallback(<K extends keyof AudioSettings>(key: K, value: AudioSettings[K]) => {
    setAudioSettings(prev => ({ ...prev, [key]: value }))

    if (key === 'inputVolume' && gainNodeRef.current) {
      gainNodeRef.current.gain.value = (value as number) / 100
    }
  }, [])

  const startMicTest = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: audioSettings.noiseSuppression,
          echoCancellation: audioSettings.echoCancellation,
          autoGainControl: audioSettings.autoGainControl
        }
      })
      micTestStreamRef.current = stream

      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      micTestAnalyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      
      const updateLevel = () => {
        if (!micTestAnalyserRef.current) return
        micTestAnalyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const normalizedLevel = Math.min(100, (average / 128) * 100)
        setMicTestLevel(normalizedLevel)
        micTestAnimationRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()
      setIsMicTesting(true)
    } catch (err) {
      console.error('Mic test failed:', err)
    }
  }, [audioSettings])

  const stopMicTest = useCallback(() => {
    if (micTestAnimationRef.current) {
      cancelAnimationFrame(micTestAnimationRef.current)
      micTestAnimationRef.current = null
    }
    if (micTestStreamRef.current) {
      micTestStreamRef.current.getTracks().forEach(track => track.stop())
      micTestStreamRef.current = null
    }
    micTestAnalyserRef.current = null
    setMicTestLevel(0)
    setIsMicTesting(false)
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-800 relative">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            isConnected 
              ? "bg-gradient-to-br from-green-500 to-emerald-600" 
              : "bg-gradient-to-br from-slate-600 to-slate-700"
          )}>
            <Volume2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{channelName}</h2>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>{guildName}</span>
              {isConnected && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className={cn(
                    connectionQuality === 'excellent' && 'text-green-400',
                    connectionQuality === 'good' && 'text-yellow-400',
                    connectionQuality === 'poor' && 'text-red-400'
                  )}>
                    {connectionQuality === 'excellent' && '● Отличное соединение'}
                    {connectionQuality === 'good' && '● Хорошее соединение'}
                    {connectionQuality === 'poor' && '● Плохое соединение'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <button
              onClick={() => setShowParticipants(!showParticipants)}
              className={cn(
                "p-2 rounded-lg transition relative",
                showParticipants ? "bg-slate-600 text-white" : "hover:bg-slate-700 text-slate-400 hover:text-white"
              )}
              title="Участники"
            >
              <Users className="w-5 h-5" />
              {connectedUsers.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 text-xs flex items-center justify-center text-white">
                  {connectedUsers.length + 1}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <Settings className="w-5 h-5" />
          </button>
          {isConnected && (
            <button
              onClick={disconnect}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 transition"
            >
              <PhoneOff className="w-4 h-4" />
              Отключиться
            </button>
          )}
        </div>
      </div>

      {showParticipants && isConnected && (
        <div className="fixed right-0 top-0 w-72 h-full bg-slate-900 border-l border-slate-700 z-20 flex flex-col shadow-xl">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Участники ({connectedUsers.length + 1})
            </h3>
            <button
              onClick={() => setShowParticipants(false)}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg transition",
              isSpeaking ? "bg-green-500/10 ring-1 ring-green-500/50" : "bg-slate-800/50 hover:bg-slate-800"
            )}>
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all",
                isSpeaking 
                  ? "ring-2 ring-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]" 
                  : "bg-slate-600"
              )}>
                <span className="text-lg">👤</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">Вы</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                  {isDeafened && <VolumeX className="w-3.5 h-3.5 text-red-400" />}
                  {isVideoEnabled && <Video className="w-3.5 h-3.5 text-blue-400" />}
                  {isScreenSharing && <Monitor className="w-3.5 h-3.5 text-purple-400" />}
                  {!isMuted && isSpeaking && (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      Говорите
                    </span>
                  )}
                </div>
              </div>
            </div>
            {connectedUsers.map(u => (
              <div 
                key={u.id} 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition",
                  u.isSpeaking ? "bg-green-500/10 ring-1 ring-green-500/50" : "bg-slate-800/50 hover:bg-slate-800"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden transition-all",
                  u.isSpeaking 
                    ? "ring-2 ring-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]" 
                    : "bg-blue-500"
                )}>
                  {u.avatar ? (
                    <img src={u.avatar} alt={u.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">👤</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{u.username}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {u.isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                    {u.isDeafened && <VolumeX className="w-3.5 h-3.5 text-red-400" />}
                    {u.hasVideo && <Video className="w-3.5 h-3.5 text-blue-400" />}
                    {u.isScreenSharing && <Monitor className="w-3.5 h-3.5 text-purple-400" />}
                    {!u.isMuted && u.isSpeaking && (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        Говорит
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="p-4 bg-slate-800/80 border-b border-slate-700 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            Настройки звука (Krisp-like)
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={audioSettings.noiseSuppression}
                onChange={(e) => updateAudioSetting('noiseSuppression', e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
              />
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                Шумоподавление
              </div>
            </label>

            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={audioSettings.echoCancellation}
                onChange={(e) => updateAudioSetting('echoCancellation', e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
              />
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                Эхоподавление
              </div>
            </label>

            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={audioSettings.autoGainControl}
                onChange={(e) => updateAudioSetting('autoGainControl', e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
              />
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Авто-громкость
              </div>
            </label>

            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={audioSettings.noiseGateEnabled}
                onChange={(e) => updateAudioSetting('noiseGateEnabled', e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
              />
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-yellow-400" />
                Noise Gate
              </div>
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Громкость микрофона</span>
              <span>{audioSettings.inputVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              value={audioSettings.inputVolume}
              onChange={(e) => updateAudioSetting('inputVolume', parseInt(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Громкость вывода</span>
              <span>{audioSettings.outputVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              value={audioSettings.outputVolume}
              onChange={(e) => updateAudioSetting('outputVolume', parseInt(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {audioSettings.noiseGateEnabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Порог Noise Gate</span>
                <span>{audioSettings.noiseGateThreshold} dB</span>
              </div>
              <input
                type="range"
                min="-80"
                max="-20"
                value={audioSettings.noiseGateThreshold}
                onChange={(e) => updateAudioSetting('noiseGateThreshold', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
            </div>
          )}

          <div className="pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-300 font-medium">Тест микрофона</span>
              <button
                onClick={isMicTesting ? stopMicTest : startMicTest}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  isMicTesting 
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" 
                    : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                )}
              >
                {isMicTesting ? 'Остановить' : 'Начать тест'}
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-75 rounded-full",
                    micTestLevel > 70 ? "bg-red-500" :
                    micTestLevel > 40 ? "bg-yellow-500" :
                    micTestLevel > 10 ? "bg-green-500" : "bg-slate-600"
                  )}
                  style={{ width: `${micTestLevel}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Уровень: {Math.round(micTestLevel)}%</span>
                <span className={cn(
                  isMicTesting && micTestLevel > 5 ? "text-green-400" : 
                  isMicTesting ? "text-yellow-400" : "text-slate-500"
                )}>
                  {!isMicTesting ? 'Нажмите "Начать тест"' :
                   micTestLevel > 5 ? '✓ Микрофон работает' : 'Говорите в микрофон...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div 
        ref={fullscreenContainerRef}
        className={cn(
          "flex-1 overflow-auto",
          showParticipants && isConnected ? "mr-72" : "",
          isBrowserFullscreen ? "fixed inset-0 z-[9999] bg-slate-900 !mr-0" : ""
        )}
      >
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center h-full p-6">
            {callState === 'connecting' ? (
              <>
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 rounded-full bg-green-500/30 animate-ping" />
                  <div className="absolute inset-2 rounded-full bg-green-500/20 animate-pulse" />
                  <Headphones className="w-12 h-12 text-white relative z-10" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Подключение...</h3>
                <p className="text-slate-400 mb-4 text-center max-w-md">
                  Устанавливаем соединение с голосовым каналом
                </p>
                <div className="flex items-center gap-2 text-green-400">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm">Гудки вызова</span>
                </div>
                <button
                  onClick={disconnect}
                  className="mt-6 px-6 py-3 rounded-xl bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30 transition-all border border-red-500/30"
                >
                  Отменить
                </button>
              </>
            ) : (
              <>
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center mb-6">
                  <Headphones className="w-12 h-12 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Голосовой канал</h3>
                <p className="text-slate-400 mb-6 text-center max-w-md">
                  Нажмите кнопку ниже, чтобы присоединиться к голосовому каналу. 
                  Вы сможете общаться с другими участниками в реальном времени.
                </p>
                <button
                  onClick={connectToVoice}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-green-500/25"
                >
                  Присоединиться к голосовому каналу
                </button>
              </>
            )}
          </div>
        ) : fullscreenUserId !== null ? (
          <div 
            className="flex flex-col bg-slate-900 h-full p-4"
          >
            <div className="flex-1 relative bg-black rounded-xl overflow-hidden">
              {fullscreenUserId === 'local' ? (
                <>
                  {isScreenSharing && screenShareStream ? (
                    <video
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-contain"
                      ref={(el) => {
                        if (el && screenShareStream) {
                          el.srcObject = screenShareStream
                        }
                      }}
                    />
                  ) : isVideoEnabled && localVideoStream ? (
                    <video
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-contain"
                      ref={(el) => {
                        if (el && localVideoStream) {
                          el.srcObject = localVideoStream
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className={cn(
                        "w-32 h-32 rounded-full flex items-center justify-center transition-all",
                        isSpeaking ? "ring-4 ring-green-500 shadow-[0_0_30px_rgba(34,197,94,0.5)]" : ""
                      )}>
                        <span className="text-6xl">👤</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-2 rounded-lg">
                    <p className="text-white font-semibold">Вы</p>
                  </div>
                </>
              ) : (
                <>
                  {(() => {
                    const user = connectedUsers.find(u => u.id === fullscreenUserId)
                    const remoteStream = remoteVideos.get(fullscreenUserId as number)
                    const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().length > 0
                    return (
                      <>
                        {hasRemoteVideo ? (
                          <video
                            autoPlay
                            playsInline
                            className="w-full h-full object-contain"
                            ref={(el) => {
                              if (el && remoteStream) {
                                el.srcObject = remoteStream
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className={cn(
                              "w-32 h-32 rounded-full flex items-center justify-center transition-all",
                              user?.isSpeaking ? "ring-4 ring-green-500 shadow-[0_0_30px_rgba(34,197,94,0.5)]" : ""
                            )}>
                              {user?.avatar ? (
                                <img src={user.avatar} alt={user?.username} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <span className="text-6xl">👤</span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-2 rounded-lg">
                          <p className="text-white font-semibold">{user?.username}</p>
                        </div>
                      </>
                    )
                  })()}
                </>
              )}
              <button
                onClick={exitFullscreen}
                className="absolute top-4 right-4 p-2 bg-black/70 hover:bg-black/90 rounded-lg text-white transition"
                title="Выйти из полноэкранного режима"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full p-6 flex items-center justify-center">
            <div className="grid gap-4 w-full max-w-6xl" style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`
            }}>
              {/* Local user tile - Discord-like size */}
              <div 
                className={cn(
                  "relative bg-slate-800 rounded-lg overflow-hidden transition-all cursor-pointer group",
                  "min-h-[200px]",
                  isSpeaking 
                    ? "ring-[3px] ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]" 
                    : "ring-1 ring-slate-600 hover:ring-slate-500"
                )}
                onClick={() => (isVideoEnabled || isScreenSharing) && toggleBrowserFullscreen('local')}
              >
                {isScreenSharing && screenShareStream ? (
                  <video
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-contain bg-black absolute inset-0"
                    style={{ minHeight: '200px' }}
                    ref={(el) => {
                      if (el && screenShareStream) {
                        el.srcObject = screenShareStream
                      }
                    }}
                  />
                ) : isVideoEnabled && localVideoStream ? (
                  <video
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover absolute inset-0"
                    style={{ minHeight: '200px' }}
                    ref={(el) => {
                      if (el && localVideoStream) {
                        el.srcObject = localVideoStream
                      }
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                    <div className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center transition-all",
                      isSpeaking 
                        ? "ring-4 ring-green-500 shadow-[0_0_25px_rgba(34,197,94,0.5)]" 
                        : "bg-gradient-to-br from-slate-600 to-slate-700"
                    )}>
                      <span className="text-5xl">👤</span>
                    </div>
                  </div>
                )}
                
                {(isVideoEnabled || isScreenSharing) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleBrowserFullscreen('local')
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded opacity-0 group-hover:opacity-100 transition-opacity text-white"
                    title="Полноэкранный режим"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
                
                <div className={cn(
                  "absolute bottom-0 left-0 right-0 p-3",
                  (isVideoEnabled || isScreenSharing) ? "bg-gradient-to-t from-black/80 via-black/40 to-transparent" : "bg-slate-800/90"
                )}>
                  <div className="flex items-center justify-between">
                    <p className="text-white font-semibold">Вы</p>
                    <div className="flex items-center gap-1.5">
                      {isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                      {isDeafened && <VolumeX className="w-4 h-4 text-red-400" />}
                      {isVideoEnabled && <Video className="w-4 h-4 text-blue-400" />}
                      {isScreenSharing && <Monitor className="w-4 h-4 text-purple-400" />}
                    </div>
                  </div>
                  {!isMuted && !isDeafened && isSpeaking && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs text-green-400">Говорите</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Remote users tiles - Discord-like size */}
              {connectedUsers.map(voiceUser => {
                const remoteStream = remoteVideos.get(voiceUser.id)
                const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().length > 0
                const isRemoteSpeaking = voiceUser.isSpeaking || false
                
                return (
                  <div
                    key={voiceUser.id}
                    className={cn(
                      "relative bg-slate-800 rounded-lg overflow-hidden transition-all cursor-pointer group",
                      "min-h-[200px]",
                      isRemoteSpeaking 
                        ? "ring-[3px] ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]" 
                        : "ring-1 ring-slate-600 hover:ring-slate-500"
                    )}
                    onClick={() => hasRemoteVideo && toggleBrowserFullscreen(voiceUser.id)}
                  >
                    {hasRemoteVideo ? (
                      <video
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover absolute inset-0"
                        style={{ minHeight: '200px' }}
                        ref={(el) => {
                          if (el && remoteStream) {
                            el.srcObject = remoteStream
                            remoteVideoRefs.current.set(voiceUser.id, el)
                          }
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full min-h-[200px]">
                        <div className={cn(
                          "w-24 h-24 rounded-full flex items-center justify-center transition-all overflow-hidden",
                          isRemoteSpeaking 
                            ? "ring-4 ring-green-500 shadow-[0_0_25px_rgba(34,197,94,0.5)]" 
                            : "bg-gradient-to-br from-blue-500 to-cyan-600"
                        )}>
                          {voiceUser.avatar ? (
                            <img src={voiceUser.avatar} alt={voiceUser.username} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-5xl">👤</span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {hasRemoteVideo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleBrowserFullscreen(voiceUser.id)
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded opacity-0 group-hover:opacity-100 transition-opacity text-white"
                        title="Полноэкранный режим"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    )}
                    
                    <div className={cn(
                      "absolute bottom-0 left-0 right-0 p-3",
                      hasRemoteVideo ? "bg-gradient-to-t from-black/80 via-black/40 to-transparent" : "bg-slate-800/90"
                    )}>
                      <div className="flex items-center justify-between">
                        <p className="text-white font-semibold truncate">{voiceUser.username}</p>
                        <div className="flex items-center gap-1.5">
                          {voiceUser.isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                          {voiceUser.isDeafened && <VolumeX className="w-4 h-4 text-red-400" />}
                          {voiceUser.hasVideo && <Video className="w-4 h-4 text-blue-400" />}
                          {voiceUser.isScreenSharing && <Monitor className="w-4 h-4 text-purple-400" />}
                        </div>
                      </div>
                      {!voiceUser.isMuted && isRemoteSpeaking && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-xs text-green-400">Говорит</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {isConnected && (
        <div className="p-4 bg-slate-800/80 border-t border-slate-700">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={toggleMute}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                isMuted 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              )}
              title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleDeafen}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                isDeafened 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              )}
              title={isDeafened ? "Включить звук" : "Выключить звук"}
            >
              {isDeafened ? <VolumeX className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleVideo}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                isVideoEnabled 
                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              )}
              title={isVideoEnabled ? "Выключить камеру" : "Включить камеру"}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleScreenShare}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                isScreenSharing 
                  ? "bg-purple-600 hover:bg-purple-700 text-white" 
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              )}
              title={isScreenSharing ? "Остановить демонстрацию" : "Демонстрация экрана"}
            >
              <Monitor className="w-5 h-5" />
            </button>

            <div className="w-px h-8 bg-slate-600 mx-2" />

            <button
              onClick={disconnect}
              className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all"
              title="Отключиться"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
