import { useState } from 'react'
import { X, Hash, Volume2, Lock, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreateChannelModalProps {
  category?: string
  onClose: () => void
  onCreate: (channel: { name: string; type: 'text' | 'voice'; isPrivate: boolean }) => void
}

export function CreateChannelModal({ category, onClose, onCreate }: CreateChannelModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'text' | 'voice'>('text')
  const [isPrivate, setIsPrivate] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({ name: name.trim().toLowerCase().replace(/\s+/g, '-'), type, isPrivate })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Create Channel</h2>
            {category && (
              <p className="text-sm text-muted-foreground">in {category}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Channel Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('text')}
                className={cn(
                  'p-4 rounded-lg border transition-all flex flex-col items-center gap-2',
                  type === 'text'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <Hash className="w-8 h-8" />
                <span className="font-medium">Text</span>
                <span className="text-xs text-muted-foreground text-center">
                  Send messages, images, and files
                </span>
              </button>
              <button
                type="button"
                onClick={() => setType('voice')}
                className={cn(
                  'p-4 rounded-lg border transition-all flex flex-col items-center gap-2',
                  type === 'voice'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <Volume2 className="w-8 h-8" />
                <span className="font-medium">Voice</span>
                <span className="text-xs text-muted-foreground text-center">
                  Talk with voice and video
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Channel Name</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {type === 'text' ? <Hash className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="new-channel"
                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              {isPrivate ? <Lock className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
              <div>
                <p className="font-medium text-sm">Private Channel</p>
                <p className="text-xs text-muted-foreground">
                  Only selected members can access
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={cn(
                'w-12 h-6 rounded-full transition-colors relative',
                isPrivate ? 'bg-primary' : 'bg-muted'
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all',
                  isPrivate ? 'left-6' : 'left-0.5'
                )}
              />
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg hover:bg-accent/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
