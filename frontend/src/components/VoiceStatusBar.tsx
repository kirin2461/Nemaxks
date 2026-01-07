import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Signal } from 'lucide-react'
import { useVoice } from '@/contexts/VoiceContext'
import { cn } from '@/lib/utils'

export function VoiceStatusBar() {
  const { state, toggleMute, toggleDeafen, leaveChannel } = useVoice()

  if (!state.isConnected) {
    return null
  }

  return (
    <div className="bg-[#1e1f22] border-t border-[#2b2d31]">
      <div className="flex items-center gap-2 p-2">
        <div className="flex-1 flex items-center gap-2 min-w-0 hover:bg-[#35373c] rounded px-2 py-1 transition-colors">
          <Signal className={cn(
            "w-4 h-4 flex-shrink-0",
            state.connectionQuality === 'excellent' && "text-green-500",
            state.connectionQuality === 'good' && "text-yellow-500",
            state.connectionQuality === 'poor' && "text-red-500"
          )} />
          <div className="text-left min-w-0">
            <div className="text-xs font-semibold text-green-500">Голосовой канал</div>
            <div className="text-[10px] text-[#b5bac1] truncate">
              {state.channelName} • {state.connectedUsers.length} участн.
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleMute}
            className={cn(
              "p-2 rounded hover:bg-[#35373c] transition-colors",
              state.isMuted ? "text-red-400" : "text-[#dbdee1]"
            )}
            title={state.isMuted ? "Включить микрофон" : "Отключить микрофон"}
          >
            {state.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleDeafen}
            className={cn(
              "p-2 rounded hover:bg-[#35373c] transition-colors",
              state.isDeafened ? "text-red-400" : "text-[#dbdee1]"
            )}
            title={state.isDeafened ? "Включить звук" : "Отключить звук"}
          >
            {state.isDeafened ? <HeadphoneOff className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
          </button>

          <button
            onClick={leaveChannel}
            className="p-2 rounded hover:bg-red-500/20 text-red-400 transition-colors"
            title="Отключиться"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
