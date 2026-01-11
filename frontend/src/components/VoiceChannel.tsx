import { useState, useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Users,
  Settings,
  Monitor,
  MonitorOff,
  Video,
  VideoOff
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
  videoStream?: MediaStream
  screenStream?: MediaStream
}

interface VoiceChannelProps {
  channelId: number
  channelName: string
  guildName: string
  onDisconnect: () => void
}

export function VoiceChannel({ channelId, channelName, guildName, onDisconnect }: VoiceChannelProps) {
  const { user } = useStore()
  const { 
    state: voiceState, 
    localVideoStream,
    localScreenStream,
    joinChannel, 
    leaveChannel, 
    toggleMute, 
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
    setUserVolume 
  } = useVoice()

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const localScreenRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!voiceState.isConnected) {
      joinChannel(String(channelId), channelName, "1", guildName)
    }
  }, [channelId, channelName, guildName, joinChannel, voiceState.isConnected])

  // Update local video stream
  useEffect(() => {
    if (localVideoRef.current && localVideoStream) {
      localVideoRef.current.srcObject = localVideoStream
    }
  }, [localVideoStream])

  // Update local screen stream
  useEffect(() => {
    if (localScreenRef.current && localScreenStream) {
      localScreenRef.current.srcObject = localScreenStream
    }
  }, [localScreenStream])

  const connectedUsers: VoiceUser[] = voiceState.connectedUsers
    .filter(u => u.id !== String(user?.id))
    .map(u => ({
      id: parseInt(u.id) || 0,
      username: u.username,
      avatar: u.avatar,
      isSpeaking: u.isSpeaking,
      isMuted: u.isMuted,
      isDeafened: u.isDeafened,
      isScreenSharing: u.isScreenSharing,
      hasVideo: u.hasVideo,
      volume: u.volume,
      videoStream: u.videoStream,
      screenStream: u.screenStream
    }))

  const handleToggleVideo = async () => {
    try {
      await toggleVideo()
    } catch (error) {
      console.error('Failed to toggle video:', error)
    }
  }

  const handleToggleScreenShare = async () => {
    try {
      await toggleScreenShare()
    } catch (error) {
      console.error('Failed to toggle screen share:', error)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#313338] text-white overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[#1e1f22]">
        <div className="flex items-center gap-3">
          <div className="bg-[#4e5058] p-2 rounded-full">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">{channelName}</h2>
            <p className="text-sm text-[#b5bac1]">{guildName} • {voiceState.connectedUsers.length} участников</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-[#4e5058] rounded-md transition-colors text-[#b5bac1] hover:text-white">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {/* Local User */}
          <div className={cn(
            "relative aspect-video bg-[#1e1f22] rounded-xl flex items-center justify-center transition-all duration-300 ring-2",
            voiceState.isSpeaking ? "ring-[#23a559]" : "ring-transparent"
          )}>
            {voiceState.hasVideo && localVideoStream ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-[#5865f2] flex items-center justify-center text-3xl font-bold border-4 border-[#313338]">
                    {user?.avatar ? (
                      <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="" />
                    ) : (
                      user?.username?.[0]?.toUpperCase()
                    )}
                  </div>
                  {voiceState.isMuted && (
                    <div className="absolute -bottom-1 -right-1 bg-[#ed4245] p-1.5 rounded-full border-2 border-[#1e1f22]">
                      <MicOff className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <span className="font-medium text-lg">Вы</span>
              </div>
            )}
            {voiceState.isMuted && voiceState.hasVideo && (
              <div className="absolute bottom-2 left-2 bg-[#ed4245] p-1.5 rounded-full">
                <MicOff className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Local Screen Share */}
          {voiceState.isScreenSharing && localScreenStream && (
            <div className="relative aspect-video bg-[#1e1f22] rounded-xl overflow-hidden col-span-2">
              <video
                ref={localScreenRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 left-2 bg-[#5865f2] px-3 py-1 rounded-full text-sm font-medium">
                Ваш экран
              </div>
            </div>
          )}

          {/* Remote Users */}
          {connectedUsers.map((remoteUser) => (
            <div key={remoteUser.id}>
              {/* User Video */}
              <div className={cn(
                "relative aspect-video bg-[#1e1f22] rounded-xl flex items-center justify-center transition-all duration-300 ring-2 mb-2",
                remoteUser.isSpeaking ? "ring-[#23a559]" : "ring-transparent"
              )}>
                {remoteUser.hasVideo && remoteUser.videoStream ? (
                  <VideoStream stream={remoteUser.videoStream} />
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-[#4e5058] flex items-center justify-center text-3xl font-bold border-4 border-[#313338]">
                        {remoteUser.avatar ? (
                          <img src={remoteUser.avatar} className="w-full h-full rounded-full object-cover" alt="" />
                        ) : (
                          remoteUser.username[0].toUpperCase()
                        )}
                      </div>
                      {remoteUser.isMuted && (
                        <div className="absolute -bottom-1 -right-1 bg-[#ed4245] p-1.5 rounded-full border-2 border-[#1e1f22]">
                          <MicOff className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <span className="font-medium text-lg">{remoteUser.username}</span>
                  </div>
                )}
                {remoteUser.isMuted && remoteUser.hasVideo && (
                  <div className="absolute bottom-2 left-2 bg-[#ed4245] p-1.5 rounded-full">
                    <MicOff className="w-4 h-4" />
                  </div>
                )}
                {remoteUser.hasVideo && (
                  <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-sm">
                    {remoteUser.username}
                  </div>
                )}
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  <input 
                    type="range" 
                    min="0" 
                    max="200" 
                    value={remoteUser.volume}
                    onChange={(e) => setUserVolume(String(remoteUser.id), parseInt(e.target.value))}
                    className="w-16 h-1 bg-[#4e5058] rounded-lg appearance-none cursor-pointer accent-[#5865f2]"
                  />
                </div>
              </div>

              {/* User Screen Share */}
              {remoteUser.isScreenSharing && remoteUser.screenStream && (
                <div className="relative aspect-video bg-[#1e1f22] rounded-xl overflow-hidden">
                  <VideoStream stream={remoteUser.screenStream} />
                  <div className="absolute top-2 left-2 bg-[#5865f2] px-3 py-1 rounded-full text-sm font-medium">
                    {remoteUser.username} демонстрирует экран
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-[#1e1f22] flex items-center justify-center gap-4">
        <button
          onClick={toggleMute}
          className={cn(
            "p-4 rounded-full transition-all duration-200",
            voiceState.isMuted ? "bg-[#ed4245] text-white" : "bg-[#4e5058] text-[#dbdee1] hover:bg-[#6d6f78]"
          )}
          title={voiceState.isMuted ? "Включить микрофон" : "Выключить микрофон"}
        >
          {voiceState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button
          onClick={toggleDeafen}
          className={cn(
            "p-4 rounded-full transition-all duration-200",
            voiceState.isDeafened ? "bg-[#ed4245] text-white" : "bg-[#4e5058] text-[#dbdee1] hover:bg-[#6d6f78]"
          )}
          title={voiceState.isDeafened ? "Включить звук" : "Выключить звук"}
        >
          {voiceState.isDeafened ? <VolumeX className="w-6 h-6" /> : <Headphones className="w-6 h-6" />}
        </button>
        <button
          onClick={handleToggleVideo}
          className={cn(
            "p-4 rounded-full transition-all duration-200",
            voiceState.hasVideo ? "bg-[#5865f2] text-white" : "bg-[#4e5058] text-[#dbdee1] hover:bg-[#6d6f78]"
          )}
          title={voiceState.hasVideo ? "Выключить видео" : "Включить видео"}
        >
          {voiceState.hasVideo ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </button>
        <button
          onClick={handleToggleScreenShare}
          className={cn(
            "p-4 rounded-full transition-all duration-200",
            voiceState.isScreenSharing ? "bg-[#5865f2] text-white" : "bg-[#4e5058] text-[#dbdee1] hover:bg-[#6d6f78]"
          )}
          title={voiceState.isScreenSharing ? "Остановить демонстрацию экрана" : "Демонстрировать экран"}
        >
          {voiceState.isScreenSharing ? <Monitor className="w-6 h-6" /> : <MonitorOff className="w-6 h-6" />}
        </button>
        <button
          onClick={() => {
            leaveChannel()
            onDisconnect()
          }}
          className="p-4 rounded-full bg-[#ed4245] text-white hover:bg-[#da373c] transition-all transform hover:scale-105"
          title="Отключиться"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}

function VideoStream({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      console.log("Setting stream to VideoStream component", stream.getAudioTracks().length, "audio tracks");
      videoRef.current.srcObject = stream
      videoRef.current.muted = false
      videoRef.current.volume = 1.0
      videoRef.current.play().catch(e => console.error("VideoStream play error:", e))
    }
  }, [stream])

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover rounded-xl"
    />
  )
}

function VolumeX(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4.702a.702.702 0 0 1 1.2.498v13.6a.702.702 0 0 1-1.2.498L6.2 14.8a1 1 0 0 0-.7-.3H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h2.5a1 1 0 0 0 .7-.3Z" />
      <line x1="22" x2="16" y1="9" y2="15" />
      <line x1="16" x2="22" y1="9" y2="15" />
    </svg>
  )
}
