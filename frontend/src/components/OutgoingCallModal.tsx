import { useEffect } from 'react'
import { PhoneOff, User } from 'lucide-react'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/utils'

interface OutgoingCallModalProps {
  targetUser: {
    id: string
    username: string
  }
  status: 'dialing' | 'ringing' | 'connected' | 'rejected' | 'ended'
  onCancel: () => void
}

export function OutgoingCallModal({ targetUser, status, onCancel }: OutgoingCallModalProps) {
  useEffect(() => {
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [])

  const getStatusText = () => {
    switch (status) {
      case 'dialing':
        return 'Connecting...'
      case 'ringing':
        return 'Ringing...'
      case 'connected':
        return 'Connected'
      case 'rejected':
        return 'Call declined'
      case 'ended':
        return 'Call ended'
      default:
        return 'Calling...'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'rejected':
        return 'bg-destructive'
      case 'connected':
        return 'bg-emerald-500'
      default:
        return 'bg-primary'
    }
  }

  return (
    <div className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] animate-fade-in-soft z-[10000] flex items-center justify-center p-4">
      <div className="bg-card border border-border shadow-pop rounded-2xl max-w-sm w-full p-8 animate-scale-in text-center">
        <div className="relative mb-6">
          {(status === 'dialing' || status === 'ringing') && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-emerald-500/40 animate-pulse-ring" />
          )}
          <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden ring-1 ring-border shadow-soft">
            <div className="w-full h-full bg-primary flex items-center justify-center">
              <User className="w-12 h-12 text-white" />
            </div>
          </div>
          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 ${getStatusColor()} text-white text-xs font-medium rounded-full shadow-elev`}>
            {getStatusText()}
          </div>
        </div>

        <h3 className="text-xl font-bold mb-1 tracking-tight">{targetUser.username}</h3>
        <p className="text-muted-foreground mb-8">
          {status === 'rejected' ? 'User declined the call' : 'Calling...'}
        </p>

        {status !== 'rejected' && status !== 'ended' && (
          <div className="flex items-center justify-center">
            <button
              onClick={onCancel}
              className="w-16 h-16 rounded-full bg-destructive hover:bg-[hsl(0_72%_38%)] text-white flex items-center justify-center transition-all hover:scale-110 shadow-soft"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        )}

        {status === 'rejected' && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-xl transition-all hover:shadow-soft"
            >
              Close
            </button>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-6">
          {status === 'dialing' || status === 'ringing' 
            ? 'Waiting for response...' 
            : status === 'rejected' 
              ? 'You can try calling again' 
              : ''}
        </p>
      </div>
    </div>
  )
}
