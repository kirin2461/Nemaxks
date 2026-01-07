import { PhoneOff, User } from 'lucide-react'

interface OutgoingCallModalProps {
  targetUser: {
    id: string
    username: string
  }
  status: 'dialing' | 'ringing' | 'connected' | 'rejected' | 'ended'
  onCancel: () => void
}

export function OutgoingCallModal({ targetUser, status, onCancel }: OutgoingCallModalProps) {
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
        return 'bg-red-500'
      case 'connected':
        return 'bg-green-500'
      default:
        return 'bg-blue-500'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-8 animate-fade-in text-center">
        <div className="relative mb-6">
          <div className={`w-24 h-24 mx-auto rounded-full overflow-hidden ring-4 ring-primary/50 ${status === 'dialing' || status === 'ringing' ? 'animate-pulse' : ''}`}>
            <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <User className="w-12 h-12 text-white" />
            </div>
          </div>
          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 ${getStatusColor()} text-white text-xs font-medium rounded-full`}>
            {getStatusText()}
          </div>
        </div>

        <h3 className="text-xl font-bold mb-1">{targetUser.username}</h3>
        <p className="text-muted-foreground mb-8">
          {status === 'rejected' ? 'User declined the call' : 'Calling...'}
        </p>

        {status !== 'rejected' && status !== 'ended' && (
          <div className="flex items-center justify-center">
            <button
              onClick={onCancel}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        )}

        {status === 'rejected' && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
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
