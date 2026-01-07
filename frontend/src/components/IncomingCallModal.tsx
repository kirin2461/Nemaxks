import { Phone, PhoneOff, User } from 'lucide-react'
import { Avatar } from './Avatar'

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
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-8 animate-fade-in text-center">
        <div className="relative mb-6">
          <div className="w-24 h-24 mx-auto rounded-full overflow-hidden ring-4 ring-primary/50 animate-pulse">
            {caller.avatar ? (
              <Avatar src={caller.avatar} alt={caller.username} size="lg" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <User className="w-12 h-12 text-white" />
              </div>
            )}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-full animate-bounce">
            Incoming Call
          </div>
        </div>

        <h3 className="text-xl font-bold mb-1">{caller.username}</h3>
        <p className="text-muted-foreground mb-8">
          {channelId ? 'Voice Channel Invite' : 'is calling you...'}
        </p>

        <div className="flex items-center justify-center gap-6">
          <button
            onClick={onReject}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
          <button
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg animate-pulse"
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
