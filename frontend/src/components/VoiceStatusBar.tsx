import { Mic, MicOff, Headphones, PhoneOff, Signal, X } from 'lucide-react'
import { useVoice } from '@/contexts/VoiceContext'
import { cn } from '@/lib/utils'

export function VoiceStatusBar() {
  const { state, toggleMute, toggleDeafen, leaveChannel } = useVoice()

  if (!state.isConnected) {
    return null
  }

  return (
    <div className="bg-card border-t border-border">
      <div className="flex items-center gap-2 p-2">
        <div className="flex-1 flex items-center gap-2 min-w-0 hover:bg-accent rounded px-2 py-1 transition-colors">
          <Signal className={cn(
            "w-4 h-4 flex-shrink-0",
            state.connectionQuality === 'excellent' && "text-emerald-600",
            state.connectionQuality === 'good' && "text-warning",
            state.connectionQuality === 'poor' && "text-destructive"
          )} />
          <div className="text-left min-w-0">
            <div className="text-xs font-semibold text-emerald-600">Голосовой канал</div>
            <div className="text-[10px] text-[#b5bac1] truncate">
              {state.channelName} • {state.connectedUsers.length} участн.
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleMute}
            className={cn(
              "p-2 rounded hover:bg-accent transition-colors",
              state.isMuted ? "text-destructive" : "text-foreground"
            )}
            title={state.isMuted ? "Включить микрофон" : "Отключить микрофон"}
          >
            {state.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleDeafen}
            className={cn(
              "p-2 rounded hover:bg-accent transition-colors",
              state.isDeafened ? "text-destructive" : "text-foreground"
            )}
            title={state.isDeafened ? "Включить звук" : "Отключить звук"}
          >
            {state.isDeafened ? (
              <div className="relative">
                <Headphones className="w-5 h-5" />
                <X className="w-3 h-3 absolute -top-1 -right-1" />
              </div>
            ) : (
              <Headphones className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={leaveChannel}
            className="p-2 rounded hover:bg-danger-soft text-destructive transition-colors"
            title="Отключиться"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
