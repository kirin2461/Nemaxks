import { useJarvisVoice } from '@/contexts/JarvisVoiceContext'
import { Radio, Volume2, VolumeX, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocation } from 'wouter'

export function JarvisFloatingIndicator() {
  const { 
    isAlwaysListening, 
    isAwaitingCommand, 
    pendingAction, 
    isMuted,
    toggleAlwaysListening,
    toggleMute,
    lastTranscript
  } = useJarvisVoice()
  
  const [location] = useLocation()
  
  if (location === '/jarvis') return null

  return (
    <div className="fixed bottom-20 right-4 z-50 pointer-events-auto">
      <div className={cn(
        "flex items-center gap-1 p-1 rounded-lg shadow-lg transition-all duration-300",
        isAlwaysListening 
          ? "bg-green-500/20 border border-green-500/40 backdrop-blur-sm" 
          : "bg-card/90 border border-border backdrop-blur-sm"
      )}>
        <button
          onClick={toggleAlwaysListening}
          className={cn(
            "p-1.5 rounded transition-colors flex items-center gap-1",
            isAlwaysListening 
              ? "bg-green-500/30 text-green-400 hover:bg-green-500/40" 
              : "hover:bg-accent/20"
          )}
          title={isAlwaysListening ? "Отключить Джарвиса" : "Включить Джарвиса"}
        >
          <Radio className={cn("w-3.5 h-3.5", isAlwaysListening && "animate-pulse")} />
        </button>

        {isAlwaysListening && (
          <>
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Bot className="w-3 h-3 text-white" />
            </div>
            
            <div className="text-[10px] max-w-[120px]">
              {isAwaitingCommand ? (
                <span className="text-green-400">Слушаю...</span>
              ) : pendingAction.type === 'message' ? (
                <span className="text-blue-400">Для: {pendingAction.contact}</span>
              ) : lastTranscript ? (
                <span className="text-muted-foreground truncate block">{lastTranscript}</span>
              ) : (
                <span className="text-muted-foreground">Джарвис</span>
              )}
            </div>
          </>
        )}

        <button
          onClick={toggleMute}
          className={cn(
            "p-1.5 rounded transition-colors",
            isMuted ? "text-red-500" : "hover:bg-accent/20"
          )}
          title={isMuted ? "Включить звук" : "Выключить звук"}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        <a
          href="/jarvis"
          className="p-1.5 rounded hover:bg-accent/20 transition-colors"
          title="Открыть Джарвис"
        >
          <Bot className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  )
}
