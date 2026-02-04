import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { Room, RoomEvent, LocalParticipant, RemoteParticipant, Track, LocalTrackPublication, RemoteTrackPublication } from 'livekit-client'
import { useStore } from '@/lib/store'

interface LiveKitParticipant {
  id: string
  username: string
  isMuted: boolean
  isSpeaking: boolean
  hasVideo: boolean
  isScreenSharing: boolean
  audioTrack?: MediaStreamTrack
  videoTrack?: MediaStreamTrack
}

interface LiveKitState {
  isConnected: boolean
  channelId: string | null
  participants: LiveKitParticipant[]
  isMuted: boolean
  hasVideo: boolean
  isScreenSharing: boolean
}

interface LiveKitContextValue {
  state: LiveKitState
  joinRoom: (channelId: string) => Promise<boolean>
  leaveRoom: () => void
  toggleMute: () => void
  toggleVideo: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  isAvailable: boolean
}

const initialState: LiveKitState = {
  isConnected: false,
  channelId: null,
  participants: [],
  isMuted: false,
  hasVideo: false,
  isScreenSharing: false
}

const LiveKitContext = createContext<LiveKitContextValue | null>(null)

export function LiveKitProvider({ children }: { children: React.ReactNode }) {
  const { user } = useStore()
  const [state, setState] = useState<LiveKitState>(initialState)
  const [isAvailable, setIsAvailable] = useState(false)
  const roomRef = useRef<Room | null>(null)

  useEffect(() => {
    checkLiveKitAvailability()
  }, [])

  const checkLiveKitAvailability = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/livekit/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setIsAvailable(response.ok)
    } catch {
      setIsAvailable(false)
    }
  }

  const fetchToken = async (channelId: string): Promise<{ token: string; url: string } | null> => {
    try {
      const authToken = localStorage.getItem('token')
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room_name: `voice-channel-${channelId}`,
          channel_id: channelId
        })
      })
      
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.error('[LiveKit] Failed to fetch token:', error)
    }
    return null
  }

  const updateParticipants = useCallback(() => {
    if (!roomRef.current) return

    const participants: LiveKitParticipant[] = []

    const localParticipant = roomRef.current.localParticipant
    if (localParticipant) {
      participants.push({
        id: localParticipant.identity,
        username: localParticipant.name || localParticipant.identity,
        isMuted: !localParticipant.isMicrophoneEnabled,
        isSpeaking: localParticipant.isSpeaking,
        hasVideo: localParticipant.isCameraEnabled,
        isScreenSharing: localParticipant.isScreenShareEnabled
      })
    }

    roomRef.current.remoteParticipants.forEach((participant) => {
      participants.push({
        id: participant.identity,
        username: participant.name || participant.identity,
        isMuted: !participant.isMicrophoneEnabled,
        isSpeaking: participant.isSpeaking,
        hasVideo: participant.isCameraEnabled,
        isScreenSharing: participant.isScreenShareEnabled
      })
    })

    setState(prev => ({ ...prev, participants }))
  }, [])

  const joinRoom = useCallback(async (channelId: string): Promise<boolean> => {
    if (roomRef.current) {
      await roomRef.current.disconnect()
    }

    const tokenData = await fetchToken(channelId)
    if (!tokenData) {
      console.error('[LiveKit] Failed to get token')
      return false
    }

    try {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 30 }
        }
      })

      room.on(RoomEvent.ParticipantConnected, updateParticipants)
      room.on(RoomEvent.ParticipantDisconnected, updateParticipants)
      room.on(RoomEvent.TrackSubscribed, updateParticipants)
      room.on(RoomEvent.TrackUnsubscribed, updateParticipants)
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setState(prev => ({
          ...prev,
          participants: prev.participants.map(p => ({
            ...p,
            isSpeaking: speakers.some(s => s.identity === p.id)
          }))
        }))
      })
      room.on(RoomEvent.Disconnected, () => {
        setState(initialState)
        roomRef.current = null
      })

      await room.connect(tokenData.url, tokenData.token)
      await room.localParticipant.setMicrophoneEnabled(true)

      roomRef.current = room
      setState({
        isConnected: true,
        channelId,
        participants: [],
        isMuted: false,
        hasVideo: false,
        isScreenSharing: false
      })

      updateParticipants()
      console.log('[LiveKit] Connected to room:', channelId)
      return true

    } catch (error) {
      console.error('[LiveKit] Failed to connect:', error)
      return false
    }
  }, [updateParticipants])

  const leaveRoom = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect()
      roomRef.current = null
    }
    setState(initialState)
  }, [])

  const toggleMute = useCallback(() => {
    if (!roomRef.current) return
    const enabled = roomRef.current.localParticipant.isMicrophoneEnabled
    roomRef.current.localParticipant.setMicrophoneEnabled(!enabled)
    setState(prev => ({ ...prev, isMuted: enabled }))
  }, [])

  const toggleVideo = useCallback(async () => {
    if (!roomRef.current) return
    const enabled = roomRef.current.localParticipant.isCameraEnabled
    await roomRef.current.localParticipant.setCameraEnabled(!enabled)
    setState(prev => ({ ...prev, hasVideo: !enabled }))
  }, [])

  const toggleScreenShare = useCallback(async () => {
    if (!roomRef.current) return
    const enabled = roomRef.current.localParticipant.isScreenShareEnabled
    await roomRef.current.localParticipant.setScreenShareEnabled(!enabled)
    setState(prev => ({ ...prev, isScreenSharing: !enabled }))
  }, [])

  return (
    <LiveKitContext.Provider value={{
      state,
      joinRoom,
      leaveRoom,
      toggleMute,
      toggleVideo,
      toggleScreenShare,
      isAvailable
    }}>
      {children}
    </LiveKitContext.Provider>
  )
}

export function useLiveKit() {
  const context = useContext(LiveKitContext)
  if (!context) {
    throw new Error('useLiveKit must be used within a LiveKitProvider')
  }
  return context
}
