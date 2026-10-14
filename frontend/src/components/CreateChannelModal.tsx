import { useState, useEffect } from 'react'
import { X, Hash, Volume2, Lock, Globe, BookOpen, Presentation, Code, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface CreateChannelModalProps {
  category?: string
  onClose: () => void
  onCreate: (channel: { name: string; type: 'text' | 'voice' | 'announcement'; isPrivate: boolean; template?: string }) => void
}

export function CreateChannelModal({ category, onClose, onCreate }: CreateChannelModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [type, setType] = useState<'text' | 'voice' | 'announcement'>('text')
  const [isPrivate, setIsPrivate] = useState(true)
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    fetch('/api/templates/educational', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
      if (res.ok) return res.json()
      return []
    }).then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setTemplates(data)
        setIsPremium(true)
      }
    }).catch(() => {})
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({ 
      name: name.trim().toLowerCase().replace(/\s+/g, '-'), 
      type, 
      isPrivate,
      template: selectedTemplate || undefined
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md mx-4 animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">{t('channels.createChannel')}</h2>
            {category && (
              <p className="text-sm text-muted-foreground">{t('channels.inCategory', { category })}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[85vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-2">{t('channels.channelType')}</label>
            <div className="grid grid-cols-3 gap-2">
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
                <span className="font-medium">{t('channels.textChannel')}</span>
                <span className="text-xs text-muted-foreground text-center">
                  {t('channels.textChannelDesc')}
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
                <span className="font-medium">{t('channels.voiceChannel')}</span>
                <span className="text-xs text-muted-foreground text-center">
                  {t('channels.voiceChannelDesc')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setType('announcement')}
                className={cn(
                  'p-4 rounded-lg border transition-all flex flex-col items-center gap-2',
                  type === 'announcement'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <Megaphone className="w-8 h-8" />
                <span className="font-medium">📢 Канал-лента</span>
                <span className="text-xs text-muted-foreground text-center">
                  Telegram-стиль: посты от админов, комментарии в тредах
                </span>
              </button>
            </div>
          </div>

          {type === 'text' && isPremium && templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Шаблон канала</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  className={cn(
                    'p-3 rounded-lg border transition-all flex flex-col items-center gap-1 text-center',
                    selectedTemplate === null
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <Hash className="w-6 h-6" />
                  <span className="text-xs font-medium">Обычный</span>
                </button>
                {templates.map((tmpl: any) => {
                  const Icon = tmpl.tool_type === 'notebook' ? BookOpen 
                    : tmpl.tool_type === 'whiteboard' ? Presentation 
                    : tmpl.tool_type === 'editor' ? Code : BookOpen
                  return (
                    <button
                      key={tmpl.id || tmpl.slug}
                      type="button"
                      onClick={() => setSelectedTemplate(tmpl.slug)}
                      className={cn(
                        'p-3 rounded-lg border transition-all flex flex-col items-center gap-1 text-center',
                        selectedTemplate === tmpl.slug
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-xs font-medium truncate w-full">{tmpl.name_ru || tmpl.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">{t('channels.channelName')}</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {type === 'text' ? <Hash className="w-5 h-5" /> : type === 'announcement' ? <Megaphone className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('channels.channelNamePlaceholder')}
                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              {isPrivate ? <Lock className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
              <div>
                <p className="font-medium text-sm">{t('channels.privateChannel')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('channels.privateChannelDesc')}
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {t('channels.createChannel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
