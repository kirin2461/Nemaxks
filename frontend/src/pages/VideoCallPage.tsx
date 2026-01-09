import { useState, useRef, useEffect, useCallback } from 'react'
import { useRoute } from 'wouter'
import { Layout } from '@/components/Layout'
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Maximize,
  Minimize,
  Settings,
  Users,
  MessageSquare,
  Signal,
  SignalHigh,
  SignalMedium,
  SignalLow
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { friendsAPI, type Friend } from '@/lib/api'

type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'
type VideoQuality = '720p' | '480p' | '360p' | '240p'

interface CallParticipant {
  id: string
  username: string
  avatar?: string
  isMuted: boolean
  isVideoOn: boolean
  isScreenSharing: boolean
  stream?: MediaStream
}

interface NetworkStats {
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  bitrate: number
  packetLoss: number
  latency: number
}

interface CallHistoryItem {
  id: string
  username: string
  type: 'incoming' | 'outgoing'
  time: string
  duration: string
}

const QUALITY_CONFIGS: Record<VideoQuality, { width: number; height: number; frameRate: number; bitrate: number }> = {
  '720p': { width: 1280, height: 720, frameRate: 30, bitrate: 2500000 },
  '480p': { width: 854, height: 480, frameRate: 30, bitrate: 1000000 },
  '360p': { width: 640, height: 360, frameRate: 24, bitrate: 500000 },
  '240p': { width: 426, height: 240, frameRate: 15, bitrate: 250000 },
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

export default function VideoCallPage() {
  const { user } = useStore()
  const [, params] = useRoute('/call/:userId')
  
  const [urlState] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const hasPendingCall = !!sessionStorage.getItem('pendingCall')
    const hasOutgoingCall = !!sessionStorage.getItem('outgoingCall')
    return {
      userId: params?.userId || searchParams.get('user'),
      shouldAccept: searchParams.get('accept') === 'true' || hasPendingCall,
      shouldInitiate: searchParams.get('initiate') === 'true' || hasOutgoingCall,
      callId: searchParams.get('callId')
    }
  })
  
  const userIdFromRoute = params?.userId || urlState.userId
  const shouldAccept = urlState.shouldAccept
  const shouldInitiate = urlState.shouldInitiate
  const callIdFromUrl = urlState.callId
  
  const [callState, setCallState] = useState<CallState>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentQuality, setCurrentQuality] = useState<VideoQuality>('720p')
  const [targetQuality, setTargetQuality] = useState<VideoQuality>('720p')
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    quality: 'excellent',
    bitrate: 2500000,
    packetLoss: 0,
    latency: 50
  })
  const [_participants, _setParticipants] = useState<CallParticipant[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [_showChat, setShowChat] = useState(false)
  const [callHistory] = useState<CallHistoryItem[]>([])
  const [wsConnected, setWsConnected] = useState(false)
  const pendingCallProcessed = useRef(false)
  const callEndSent = useRef(false)
  
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const screenShareRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    console.log('VideoCallPage mounted:', { 
      userIdFromRoute, 
      shouldAccept, 
      shouldInitiate, 
      pendingCall: sessionStorage.getItem('pendingCall'),
      outgoingCall: sessionStorage.getItem('outgoingCall')
    })
    loadFriends()
  }, [])

  useEffect(() => {
    if (userIdFromRoute && friends.length > 0) {
      const friend = friends.find(f => String(f.id) === String(userIdFromRoute))
      if (friend) {
        setSelectedFriend(friend)
      }
    }
  }, [userIdFromRoute, friends])

  useEffect(() => {
    if (shouldAccept && wsConnected && !pendingCallProcessed.current) {
      sessionStorage.removeItem('outgoingCall')
      
      const pendingCallData = sessionStorage.getItem('pendingCall')
      console.log('Accept flow: pendingCallData =', pendingCallData)
      if (pendingCallData) {
        pendingCallProcessed.current = true
        try {
          const { offer, callerId } = JSON.parse(pendingCallData)
          sessionStorage.removeItem('pendingCall')
          if (offer) {
            console.log('Processing pending call from', callerId, 'with offer')
            handleIncomingCall({ 
              type: 'call-offer', 
              offer, 
              fromUserId: callerId,
              autoAccept: true 
            })
          } else {
            console.error('No offer in pending call data')
          }
        } catch (e) {
          console.error('Failed to parse pending call data:', e)
        }
      } else {
        console.log('No pending call data found, waiting for call-offer via WebSocket')
      }
    }
  }, [shouldAccept, wsConnected])

  useEffect(() => {
    if (shouldAccept) {
      return
    }
    
    if (shouldInitiate && wsConnected && selectedFriend && !pendingCallProcessed.current) {
      const outgoingCallData = sessionStorage.getItem('outgoingCall')
      console.log('Initiate flow: outgoingCallData =', outgoingCallData)
      if (outgoingCallData) {
        try {
          const parsed = JSON.parse(outgoingCallData)
          if (String(parsed.targetUserId) === String(selectedFriend.id)) {
            pendingCallProcessed.current = true
            sessionStorage.removeItem('outgoingCall')
            console.log('Initiating call to', selectedFriend.username)
            startCall(selectedFriend)
          }
        } catch (e) {
          console.error('Failed to parse outgoing call data:', e)
        }
      }
    }
  }, [shouldAccept, shouldInitiate, wsConnected, selectedFriend])

  useEffect(() => {
    if (user?.id) {
      connectWebSocket()
    }
    return () => {
      cleanup()
      wsRef.current?.close()
    }
  }, [user?.id])

  useEffect(() => {
    if (callState === 'connected') {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
      startNetworkMonitoring()
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current)
      }
      setCallDuration(0)
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current)
    }
  }, [callState])

  const loadFriends = async () => {
    try {
      const data = await friendsAPI.getFriends()
      setFriends(data || [])
    } catch (error) {
      console.error('Failed to load friends:', error)
      setFriends([])
    }
  }

  const connectWebSocket = () => {
    if (!user?.id) return
    
    const token = localStorage.getItem('token')
    if (!token) return
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`
    
    wsRef.current = new WebSocket(wsUrl)
    
    wsRef.current.onopen = () => {
      console.log('WebSocket connected for video calls')
      setWsConnected(true)
    }
    
    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.fromUserId !== user.id) {
        handleSignalingMessage(message)
      }
    }
    
    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected')
      setWsConnected(false)
      setTimeout(connectWebSocket, 3000)
    }
  }

  const handleSignalingMessage = async (message: any) => {
    switch (message.type) {
      case 'call-offer':
        if (shouldAccept || callState !== 'idle') {
          console.log('Ignoring duplicate call-offer, already processing call')
          return
        }
        await handleIncomingCall(message)
        break
      case 'call-answer':
        console.log('Received call-answer')
        await handleCallAnswer(message)
        setCallState('connected')
        break
      case 'call-accepted':
        console.log('Call accepted by recipient, waiting for call-answer')
        break
      case 'ice-candidate':
        await handleIceCandidate(message)
        break
      case 'call-end':
        if (callState !== 'idle' && callState !== 'ended' && !callEndSent.current) {
          callEndSent.current = true
          setCallState('ended')
          cleanup()
          setTimeout(() => {
            setCallState('idle')
            callEndSent.current = false
          }, 2000)
        }
        break
      case 'call-rejected':
        setCallState('ended')
        cleanup()
        setTimeout(() => setCallState('idle'), 2000)
        break
    }
  }

  const getMediaStream = async (quality: VideoQuality = '720p') => {
    const config = QUALITY_CONFIGS[quality]
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: config.width },
          height: { ideal: config.height },
          frameRate: { ideal: config.frameRate }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      return stream
    } catch (error) {
      console.error('Failed to get media stream:', error)
      throw error
    }
  }

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          targetUserId: selectedFriend?.id
        }))
      }
    }
    
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind, 'enabled:', event.track.enabled, 'muted:', event.track.muted, 'readyState:', event.track.readyState)
      const stream = event.streams[0] || new MediaStream([event.track])
      
      const playMedia = () => {
        if (event.track.kind === 'video' && remoteVideoRef.current) {
          if (!remoteVideoRef.current.srcObject) {
            remoteVideoRef.current.srcObject = stream
          }
          remoteVideoRef.current.muted = true
          remoteVideoRef.current.play().catch(e => console.log('Video play error:', e))
        }
        
        if (event.track.kind === 'audio' && remoteAudioRef.current) {
          // Create a new stream with this specific track
          const audioStream = new MediaStream([event.track])

          // If there's already audio, stop old tracks first
          if (remoteAudioRef.current.srcObject) {
            const oldStream = remoteAudioRef.current.srcObject as MediaStream
            oldStream.getTracks().forEach(t => {
              if (t.id !== event.track.id) {
                t.stop()
              }
            })
          }

          remoteAudioRef.current.srcObject = audioStream
          remoteAudioRef.current.muted = false
          remoteAudioRef.current.volume = 1.0

          // Use user interaction to enable autoplay
          const playAudio = () => {
            remoteAudioRef.current?.play().then(() => {
              console.log('Remote audio playing successfully')
            }).catch(e => {
              console.log('Audio play error - waiting for user interaction:', e)
            })
          }

          playAudio()
          // Retry on user interaction if needed
          document.addEventListener('click', playAudio, { once: true })
        }
      }
      
      if (!event.track.muted) {
        playMedia()
      }
      
      event.track.onunmute = () => {
        console.log('Track unmuted:', event.track.kind)
        playMedia()
      }
      
      event.track.onmute = () => {
        console.log('Track muted:', event.track.kind)
      }
    }
    
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('connected')
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall()
      }
    }
    
    return pc
  }

  const startCall = async (friend: Friend) => {
    setSelectedFriend(friend)
    setCallState('calling')
    
    try {
      const stream = await getMediaStream(targetQuality)
      localStreamRef.current = stream
      setCurrentQuality(targetQuality)
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        localVideoRef.current.play().catch(e => console.log('Local video play error:', e))
      }
      
      peerConnectionRef.current = createPeerConnection()
      
      stream.getTracks().forEach(track => {
        peerConnectionRef.current?.addTrack(track, stream)
      })
      
      const offer = await peerConnectionRef.current.createOffer()
      await peerConnectionRef.current.setLocalDescription(offer)
      
      const callId = callIdFromUrl || crypto.randomUUID()
      console.log('Sending call-offer with SDP to', friend.id, 'callId:', callId)
      
      wsRef.current?.send(JSON.stringify({
        type: 'call-offer',
        callId,
        offer,
        targetUserId: friend.id,
        callerName: user?.username,
        callerAvatar: user?.avatar,
        callerInfo: {
          id: user?.id,
          username: user?.username,
          avatar: user?.avatar
        }
      }))
    } catch (error) {
      console.error('Failed to start call:', error)
      setCallState('idle')
    }
  }

  const handleIncomingCall = async (message: any) => {
    setCallState('ringing')
    const callerId = message.callerInfo?.id || message.fromUserId
    if (message.callerInfo) {
      setSelectedFriend(message.callerInfo)
    }
    
    peerConnectionRef.current = createPeerConnection()
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(message.offer))
    
    if (message.autoAccept && callerId) {
      await acceptCallInternal(callerId)
    }
  }

  const acceptCallInternal = async (targetUserId?: string) => {
    if (!peerConnectionRef.current) return
    
    const targetId = targetUserId || selectedFriend?.id
    if (!targetId) {
      console.error('No target user ID for call answer')
      return
    }
    
    try {
      const stream = await getMediaStream(targetQuality)
      localStreamRef.current = stream
      setCurrentQuality(targetQuality)
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        localVideoRef.current.play().catch(e => console.log('Local video play error:', e))
      }
      
      stream.getTracks().forEach(track => {
        peerConnectionRef.current?.addTrack(track, stream)
      })
      
      const answer = await peerConnectionRef.current.createAnswer()
      await peerConnectionRef.current.setLocalDescription(answer)
      
      console.log('Sending call-answer to', targetId)
      wsRef.current?.send(JSON.stringify({
        type: 'call-answer',
        answer,
        targetUserId: targetId
      }))
      
      setCallState('connected')
    } catch (error) {
      console.error('Failed to accept call:', error)
      setCallState('idle')
    }
  }

  const acceptCall = async () => {
    await acceptCallInternal()
  }

  const handleCallAnswer = async (message: any) => {
    if (!peerConnectionRef.current) return
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(message.answer))
  }

  const handleIceCandidate = async (message: any) => {
    if (!peerConnectionRef.current) return
    try {
      if (message.candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(message.candidate))
      }
    } catch (error) {
      console.error('Failed to add ICE candidate:', error)
    }
  }

  const rejectCall = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call-rejected',
        targetUserId: selectedFriend?.id
      }))
    }
    setCallState('idle')
    cleanup()
  }

  const endCall = () => {
    if (callState === 'ended' || callState === 'idle') return
    if (callEndSent.current) return
    
    callEndSent.current = true
    
    if (wsRef.current?.readyState === WebSocket.OPEN && selectedFriend?.id) {
      wsRef.current.send(JSON.stringify({
        type: 'call-end',
        targetUserId: selectedFriend.id
      }))
    }
    setCallState('ended')
    cleanup()
    setTimeout(() => {
      setCallState('idle')
      callEndSent.current = false
    }, 2000)
  }

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    screenStreamRef.current?.getTracks().forEach(track => track.stop())
    peerConnectionRef.current?.close()
    localStreamRef.current = null
    screenStreamRef.current = null
    peerConnectionRef.current = null
    setIsScreenSharing(false)
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOn(videoTrack.enabled)
      }
    }
  }

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(track => track.stop())
      screenStreamRef.current = null
      setIsScreenSharing(false)
      
      if (peerConnectionRef.current && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0]
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video')
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack)
        }
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true
        })
        
        screenStreamRef.current = screenStream
        setIsScreenSharing(true)
        
        if (screenShareRef.current) {
          screenShareRef.current.srcObject = screenStream
        }
        
        if (peerConnectionRef.current) {
          const videoTrack = screenStream.getVideoTracks()[0]
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video')
          if (sender) {
            sender.replaceTrack(videoTrack)
          }
          
          videoTrack.onended = () => {
            toggleScreenShare()
          }
        }
      } catch (error) {
        console.error('Failed to start screen share:', error)
      }
    }
  }

  const startNetworkMonitoring = () => {
    statsIntervalRef.current = setInterval(async () => {
      if (!peerConnectionRef.current) return
      
      try {
        const stats = await peerConnectionRef.current.getStats()
        let inboundRtp: any = null
        let candidatePair: any = null
        
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            inboundRtp = report
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            candidatePair = report
          }
        })
        
        if (inboundRtp && candidatePair) {
          const packetLoss = inboundRtp.packetsLost / (inboundRtp.packetsReceived + inboundRtp.packetsLost) * 100
          const bitrate = candidatePair.availableOutgoingBitrate || 2500000
          const latency = candidatePair.currentRoundTripTime * 1000 || 50
          
          let quality: NetworkStats['quality'] = 'excellent'
          if (packetLoss > 5 || latency > 300) quality = 'poor'
          else if (packetLoss > 2 || latency > 150) quality = 'fair'
          else if (packetLoss > 0.5 || latency > 80) quality = 'good'
          
          setNetworkStats({ quality, bitrate, packetLoss, latency })
          
          adaptQuality(quality)
        }
      } catch (error) {
        console.error('Failed to get stats:', error)
      }
    }, 2000)
  }

  const adaptQuality = useCallback((quality: NetworkStats['quality']) => {
    const qualityMap: Record<NetworkStats['quality'], VideoQuality> = {
      'excellent': '720p',
      'good': '480p',
      'fair': '360p',
      'poor': '240p'
    }
    
    const newQuality = qualityMap[quality]
    if (newQuality !== currentQuality) {
      setCurrentQuality(newQuality)
      updateVideoQuality(newQuality)
    }
  }, [currentQuality])

  const updateVideoQuality = async (quality: VideoQuality) => {
    if (!peerConnectionRef.current || !localStreamRef.current) return
    
    const config = QUALITY_CONFIGS[quality]
    const videoTrack = localStreamRef.current.getVideoTracks()[0]
    
    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({
          width: { ideal: config.width },
          height: { ideal: config.height },
          frameRate: { ideal: config.frameRate }
        })
        
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video')
        if (sender) {
          const params = sender.getParameters()
          if (params.encodings && params.encodings[0]) {
            params.encodings[0].maxBitrate = config.bitrate
          }
          await sender.setParameters(params)
        }
      } catch (error) {
        console.error('Failed to update video quality:', error)
      }
    }
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
    setIsFullscreen(!isFullscreen)
  }

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getSignalIcon = () => {
    switch (networkStats.quality) {
      case 'excellent': return <SignalHigh className="w-4 h-4 text-green-500" />
      case 'good': return <SignalMedium className="w-4 h-4 text-green-400" />
      case 'fair': return <SignalLow className="w-4 h-4 text-yellow-500" />
      case 'poor': return <Signal className="w-4 h-4 text-red-500" />
    }
  }

  return (
    <Layout>
      <div ref={containerRef} className="min-h-screen bg-background">
        {callState === 'idle' && (
          <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Звонки</h1>
            
            <div className="glass-cosmic rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Друзья
              </h2>
              {friends.length === 0 ? (
                <p className="text-muted-foreground">Нет друзей</p>
              ) : (
                <div className="space-y-3">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="p-4 rounded-xl bg-card/50 flex items-center justify-between hover:bg-card/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                            {friend.avatar ? (
                              <img src={friend.avatar} alt={friend.username} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              friend.username.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className={cn(
                            "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
                            friend.status === 'online' ? 'bg-green-500' : 'bg-gray-500'
                          )} />
                        </div>
                        <div>
                          <p className="font-medium">{friend.username}</p>
                          <p className="text-xs text-muted-foreground capitalize">{friend.status === 'online' ? 'В сети' : 'Не в сети'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startCall(friend)}
                          className="p-3 rounded-full bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white transition-all"
                          title="Видеозвонок"
                        >
                          <Video className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => startCall(friend)}
                          className="p-3 rounded-full bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white transition-all"
                          title="Аудиозвонок"
                        >
                          <Phone className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-cosmic rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5" />
                История звонков
              </h2>
              <div className="space-y-3">
                {callHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">История звонков пуста</p>
                ) : (
                  callHistory.map((call) => (
                    <div
                      key={call.id}
                      className="p-4 rounded-xl bg-card/50 flex items-center justify-between hover:bg-card/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                          {call.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{call.username}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={call.type === 'incoming' ? 'text-green-500' : 'text-blue-500'}>
                              {call.type === 'incoming' ? '↙ Входящий' : '↗ Исходящий'}
                            </span>
                            <span>•</span>
                            <span>{call.time}</span>
                            <span>•</span>
                            <span>{call.duration}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const friend = friends.find(f => f.username === call.username)
                            if (friend) startCall(friend)
                          }}
                          className="p-2.5 rounded-full bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white transition-all"
                          title="Перезвонить видео"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const friend = friends.find(f => f.username === call.username)
                            if (friend) startCall(friend)
                          }}
                          className="p-2.5 rounded-full bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white transition-all"
                          title="Перезвонить аудио"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {callState === 'calling' && (
          <div className="h-screen flex flex-col items-center justify-center">
            <div className="text-center">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-4xl font-bold mx-auto mb-6 animate-pulse">
                {selectedFriend?.username?.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-2xl font-bold mb-2">{selectedFriend?.username}</h2>
              <p className="text-muted-foreground mb-8">Вызов...</p>
              <button
                onClick={endCall}
                className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                <PhoneOff className="w-8 h-8" />
              </button>
            </div>
          </div>
        )}

        {callState === 'ringing' && (
          <div className="h-screen flex flex-col items-center justify-center">
            <div className="text-center">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-4xl font-bold mx-auto mb-6 pulse-call">
                {selectedFriend?.username?.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-2xl font-bold mb-2">{selectedFriend?.username}</h2>
              <p className="text-muted-foreground mb-8">Входящий звонок</p>
              <div className="flex gap-6">
                <button
                  onClick={rejectCall}
                  className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                >
                  <PhoneOff className="w-8 h-8" />
                </button>
                <button
                  onClick={acceptCall}
                  className="p-4 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors"
                >
                  <Phone className="w-8 h-8" />
                </button>
              </div>
            </div>
          </div>
        )}

        {(callState === 'connected' || callState === 'ended') && (
          <div className="h-screen flex flex-col bg-black">
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-4">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
                  {getSignalIcon()}
                  <span className="text-white text-sm">{currentQuality}</span>
                </div>
                <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
                  <span className="text-white text-sm font-mono">{formatDuration(callDuration)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowChat(prev => !prev)}
                  className="p-2 rounded-lg bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white transition-colors"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-lg bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white transition-colors"
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex-1 relative">
              <audio ref={remoteAudioRef} autoPlay />
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              
              {isScreenSharing && (
                <video
                  ref={screenShareRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                />
              )}

              <div className="absolute bottom-24 right-4 w-48 aspect-video rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "w-full h-full object-cover",
                    !isVideoOn && "hidden"
                  )}
                />
                {!isVideoOn && (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <VideoOff className="w-8 h-8 text-gray-500" />
                  </div>
                )}
              </div>

              {callState === 'ended' && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <div className="text-center text-white">
                    <PhoneOff className="w-16 h-16 mx-auto mb-4 text-red-500" />
                    <h2 className="text-2xl font-bold mb-2">Звонок завершён</h2>
                    <p className="text-muted-foreground">Длительность: {formatDuration(callDuration)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={toggleMute}
                  className={cn(
                    "p-4 rounded-full transition-colors",
                    isMuted ? "bg-red-500 text-white" : "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
                  )}
                  title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
                <button
                  onClick={toggleVideo}
                  className={cn(
                    "p-4 rounded-full transition-colors",
                    !isVideoOn ? "bg-red-500 text-white" : "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
                  )}
                  title={isVideoOn ? "Выключить камеру" : "Включить камеру"}
                >
                  {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </button>
                <button
                  onClick={toggleScreenShare}
                  className={cn(
                    "p-4 rounded-full transition-colors",
                    isScreenSharing ? "bg-blue-500 text-white" : "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
                  )}
                  title={isScreenSharing ? "Остановить демонстрацию" : "Демонстрация экрана"}
                >
                  {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                </button>
                <button
                  onClick={endCall}
                  className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                  title="Завершить звонок"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </div>
            </div>

            {showSettings && (
              <div className="absolute top-16 right-4 w-72 bg-black/90 backdrop-blur-sm rounded-xl p-4 z-20">
                <h3 className="font-semibold text-white mb-4">Настройки</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Качество видео</label>
                    <div className="flex gap-2">
                      {(['720p', '480p', '360p', '240p'] as VideoQuality[]).map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setTargetQuality(q)
                            updateVideoQuality(q)
                          }}
                          className={cn(
                            "px-2 py-1 rounded text-xs transition-colors",
                            currentQuality === q ? "bg-primary text-white" : "bg-white/10 text-white hover:bg-white/20"
                          )}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Статистика сети</label>
                    <div className="space-y-1 text-sm text-white">
                      <p>Качество: <span className={cn(
                        networkStats.quality === 'excellent' && 'text-green-500',
                        networkStats.quality === 'good' && 'text-green-400',
                        networkStats.quality === 'fair' && 'text-yellow-500',
                        networkStats.quality === 'poor' && 'text-red-500'
                      )}>{networkStats.quality}</span></p>
                      <p>Битрейт: {(networkStats.bitrate / 1000000).toFixed(1)} Мбит/с</p>
                      <p>Потеря пакетов: {networkStats.packetLoss.toFixed(1)}%</p>
                      <p>Задержка: {networkStats.latency.toFixed(0)} мс</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
