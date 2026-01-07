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
        "flex items-center gap-2 p-2 rounded-xl shadow-lg transition-all duration-300",
        isAlwaysListening 
          ? "bg-green-500/20 border border-green-500/40 backdrop-blur-sm" 
          : "bg-card/90 border border-border backdrop-blur-sm"
      )}>
        <button
          onClick={toggleAlwaysListening}
          className={cn(
            "p-2 rounded-lg transition-colors flex items-center gap-1",
            isAlwaysListening 
              ? "bg-green-500/30 text-green-400 hover:bg-green-500/40" 
              : "hover:bg-accent/20"
          )}
          title={isAlwaysListening ? "Отключить Джарвиса" : "Включить Джарвиса"}
        >
          <Radio className={cn("w-5 h-5", isAlwaysListening && "animate-pulse")} />
        </button>

        {isAlwaysListening && (
          <>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            
            <div className="text-xs max-w-[150px]">
              {isAwaitingCommand ? (
                <span className="text-green-400">Слушаю команду...</span>
              ) : pendingAction.type === 'message' ? (
                <span className="text-blue-400">Сообщение для: {pendingAction.contact}</span>
              ) : lastTranscript ? (
                <span className="text-muted-foreground truncate block">{lastTranscript}</span>
              ) : (
                <span className="text-muted-foreground">Скажите "Джарвис"</span>
              )}
            </div>
          </>
        )}

        <button
          onClick={toggleMute}
          className={cn(
            "p-2 rounded-lg transition-colors",
            isMuted ? "text-red-500" : "hover:bg-accent/20"
          )}
          title={isMuted ? "Включить звук" : "Выключить звук"}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <a
          href="/jarvis"
          className="p-2 rounded-lg hover:bg-accent/20 transition-colors"
          title="Открыть Джарвис"
        >
          <Bot className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}
