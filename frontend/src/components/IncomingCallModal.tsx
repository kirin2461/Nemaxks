import { useEffect } from 'react'
import { Phone, PhoneOff, User } from 'lucide-react'
import { Avatar } from './Avatar'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/utils'

interface IncomingCallModalProps {
  caller: {
    id: string
    username: string
    avatar?: string
  }
  channelId?: string
  onAccept: () => void
  onReject: () => void
}

export function IncomingCallModal({ caller, channelId, onAccept, onReject }: IncomingCallModalProps) {
  useEffect(() => {
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [])

  return (
    <div className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] animate-fade-in-soft z-[10000] flex items-center justify-center p-4">
      <div className="bg-card border border-border shadow-pop rounded-2xl max-w-sm w-full p-8 animate-scale-in text-center">
        <div className="relative mb-6">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-emerald-500/40 animate-pulse-ring" />
          <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden ring-1 ring-border shadow-soft">
            {caller.avatar ? (
              <Avatar src={caller.avatar} alt={caller.username} size="lg" />
            ) : (
              <div className="w-full h-full bg-primary flex items-center justify-center">
                <User className="w-12 h-12 text-white" />
              </div>
            )}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full animate-bounce shadow-lg-brand">
            Incoming Call
          </div>
        </div>

        <h3 className="text-xl font-bold mb-1 tracking-tight">{caller.username}</h3>
        <p className="text-muted-foreground mb-8">
          {channelId ? 'Voice Channel Invite' : 'is calling you...'}
        </p>

        <div className="flex items-center justify-center gap-6">
          <button
            onClick={onReject}
            className="w-16 h-16 rounded-full bg-destructive hover:bg-[hsl(0_72%_38%)] text-white flex items-center justify-center transition-all hover:scale-110 shadow-soft"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
          <button
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-primary hover:bg-emerald-800 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg-brand animate-pulse"
          >
            <Phone className="w-7 h-7" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Press Accept to join the call
        </p>
      </div>
    </div>
  )
}
