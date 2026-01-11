import { useState, useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Users,
  Settings,
  Monitor,
  Video
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

export function VoiceChannel({ channelId, channelName, guildName, onDisconnect }: VoiceChannelProps) {
  const { user } = useStore()
  const { 
    state: voiceState, 
    joinChannel, 
    leaveChannel, 
    toggleMute, 
    toggleDeafen, 
    setUserVolume 
  } = useVoice()

  useEffect(() => {
    if (!voiceState.isConnected) {
      joinChannel(String(channelId), channelName, "1", guildName)
    }
  }, [channelId, channelName, guildName, joinChannel, voiceState.isConnected])

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
          <div className={cn(
            "relative aspect-video bg-[#1e1f22] rounded-xl flex items-center justify-center transition-all duration-300 ring-2",
            voiceState.isSpeaking ? "ring-[#23a559]" : "ring-transparent"
          )}>
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
          </div>

          {connectedUsers.map((remoteUser) => (
            <div key={remoteUser.id} className={cn(
              "relative aspect-video bg-[#1e1f22] rounded-xl flex items-center justify-center transition-all duration-300 ring-2",
              remoteUser.isSpeaking ? "ring-[#23a559]" : "ring-transparent"
            )}>
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
        >
          {voiceState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button
          onClick={toggleDeafen}
          className={cn(
            "p-4 rounded-full transition-all duration-200",
            voiceState.isDeafened ? "bg-[#ed4245] text-white" : "bg-[#4e5058] text-[#dbdee1] hover:bg-[#6d6f78]"
          )}
        >
          {voiceState.isDeafened ? <VolumeX className="w-6 h-6" /> : <Headphones className="w-6 h-6" />}
        </button>
        <button className="p-4 rounded-full bg-[#4e5058] text-[#dbdee1] hover:bg-[#6d6f78] transition-all">
          <Video className="w-6 h-6" />
        </button>
        <button className="p-4 rounded-full bg-[#4e5058] text-[#dbdee1] hover:bg-[#6d6f78] transition-all">
          <Monitor className="w-6 h-6" />
        </button>
        <button
          onClick={() => {
            leaveChannel()
            onDisconnect()
          }}
          className="p-4 rounded-full bg-[#ed4245] text-white hover:bg-[#da373c] transition-all transform hover:scale-105"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
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
