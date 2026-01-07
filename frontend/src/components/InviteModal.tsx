import { useState, useEffect } from 'react'
import { X, Copy, Check, Link, QrCode, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { invitesAPI } from '@/lib/api'

interface InviteModalProps {
  guildId: string
  guildName: string
  onClose: () => void
}

export function InviteModal({ guildId, guildName, onClose }: InviteModalProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined)
  const [showQR, setShowQR] = useState(true)

  const baseUrl = window.location.origin

  useEffect(() => {
    generateInvite()
  }, [])

  const generateInvite = async () => {
    setLoading(true)
    try {
      const invite = await invitesAPI.createInvite(guildId, maxUses)
      setInviteCode(invite.code)
    } catch (error) {
      console.error('Failed to create invite:', error)
    } finally {
      setLoading(false)
    }
  }

  const inviteLink = inviteCode ? `${baseUrl}/invite/${inviteCode}` : ''

  const copyToClipboard = async () => {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-card rounded-2xl w-full max-w-md mx-4 shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Пригласить на сервер</h2>
              <p className="text-sm text-muted-foreground">{guildName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setShowQR(true)}
              className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                showQR ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <QrCode className="w-4 h-4" />
              QR-код
            </button>
            <button
              onClick={() => setShowQR(false)}
              className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                !showQR ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <Link className="w-4 h-4" />
              Ссылка
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="loading-spinner" />
            </div>
          ) : inviteCode ? (
            <>
              {showQR ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white p-4 rounded-xl">
                    <QRCodeSVG
                      value={inviteLink}
                      size={200}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Отсканируйте QR-код, чтобы присоединиться к серверу
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Ссылка-приглашение
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inviteLink}
                        readOnly
                        className="flex-1 px-4 py-3 rounded-lg bg-background border border-border text-sm"
                      />
                      <button
                        onClick={copyToClipboard}
                        className="px-4 py-3 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-2"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4" />
                            Скопировано
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Копировать
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Максимальное количество использований
                    </label>
                    <select
                      value={maxUses || ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : undefined
                        setMaxUses(val)
                      }}
                      className="w-full px-4 py-3 rounded-lg bg-background border border-border"
                    >
                      <option value="">Без ограничений</option>
                      <option value="1">1 использование</option>
                      <option value="5">5 использований</option>
                      <option value="10">10 использований</option>
                      <option value="25">25 использований</option>
                      <option value="50">50 использований</option>
                      <option value="100">100 использований</option>
                    </select>
                  </div>

                  <button
                    onClick={generateInvite}
                    className="w-full py-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                  >
                    Сгенерировать новую ссылку
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Не удалось создать приглашение
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
