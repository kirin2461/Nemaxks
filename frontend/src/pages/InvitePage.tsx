import { useState, useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { referralAPI } from '@/lib/api'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check, Users, Link2, QrCode, Share2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InvitedUser {
  id: number
  username: string
  avatar?: string
  invited_at: string
}

export default function InvitePage() {
  const [referralCode, setReferralCode] = useState<string>('')
  const [inviteCount, setInviteCount] = useState(0)
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)


  useEffect(() => {
    loadReferralData()
  }, [])

  const loadReferralData = async () => {
    try {
      const [referral, invited] = await Promise.all([
        referralAPI.getMyReferral(),
        referralAPI.getInvitedUsers()
      ])
      setReferralCode(referral.code)
      setInviteCount(referral.invite_count)
      setInvitedUsers(invited.invited_users || [])
    } catch (err) {
      console.error('Failed to load referral data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getInviteLink = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/join/${referralCode}`
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getInviteLink())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Присоединяйся к Nebula!',
          text: 'Приглашаю тебя в Nebula - современную платформу для общения',
          url: getInviteLink()
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err)
        }
      }
    } else {
      copyLink()
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto space-y-6 animate-rise-in">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-accent grid place-items-center">
            <Users className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-[-0.015em] text-graphite-900">
              Пригласить <span className="text-primary">друзей</span>
            </h1>
            <p className="text-sm text-muted-foreground">Делись ссылкой и приглашай друзей в Nebula</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-soft p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-graphite-900">Твоя реферальная ссылка</h2>
              <p className="text-sm text-muted-foreground">Поделись этой ссылкой с друзьями</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-display font-extrabold tracking-[-0.02em] text-graphite-900">{inviteCount}</div>
              <div className="text-xs text-muted-foreground">приглашено</div>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 bg-graphite-100 border border-border rounded-lg px-4 py-3 font-mono text-sm text-graphite-700 truncate">
              {getInviteLink()}
            </div>
            <button
              onClick={copyLink}
              title="Скопировать"
              className={cn(
                "h-[46px] w-[46px] shrink-0 grid place-items-center rounded-lg border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 active:scale-[0.97] transition-all duration-150",
                copied && "bg-success-soft border-emerald-200 text-emerald-700"
              )}
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowQR(!showQR)}
              title="QR-код"
              className={cn(
                "h-[46px] w-[46px] shrink-0 grid place-items-center rounded-lg border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 active:scale-[0.97] transition-all duration-150",
                showQR && "bg-accent border-emerald-200 text-accent-foreground"
              )}
            >
              <QrCode className="w-5 h-5" />
            </button>
            {'share' in navigator && (
              <button
                onClick={shareLink}
                title="Поделиться"
                className="h-[46px] w-[46px] shrink-0 grid place-items-center rounded-lg border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 active:scale-[0.97] transition-all duration-150"
              >
                <Share2 className="w-5 h-5" />
              </button>
            )}
          </div>

          {showQR && (
            <div className="flex justify-center animate-scale-in">
              <div className="p-4 bg-card rounded-xl border border-border shadow-soft">
                <QRCodeSVG
                  value={getInviteLink()}
                  size={200}
                  level="H"
                  includeMargin
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={copyLink}
              className="flex-1 h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150"
            >
              <Link2 className="w-4 h-4" />
              Скопировать ссылку
            </button>
            {'share' in navigator && (
              <button
                onClick={shareLink}
                className="flex-1 h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 active:scale-[0.97] transition-all duration-150"
              >
                <Share2 className="w-4 h-4" />
                Поделиться
              </button>
            )}
          </div>
        </div>

        {invitedUsers.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-soft p-6">
            <h2 className="text-lg font-semibold text-graphite-900 mb-4">Приглашённые друзья</h2>
            <div className="space-y-2">
              {invitedUsers.map((user, i) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border animate-rise-in [animation-fill-mode:both]"
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-700 ring-1 ring-border flex items-center justify-center shrink-0 overflow-hidden">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-white">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{user.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(user.invited_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card shadow-soft p-6">
          <h3 className="font-semibold text-graphite-900 mb-3">Как это работает?</h3>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-accent text-emerald-700 flex items-center justify-center text-xs font-medium mt-0.5 shrink-0">1</span>
              Поделись своей ссылкой или QR-кодом с друзьями
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-accent text-emerald-700 flex items-center justify-center text-xs font-medium mt-0.5 shrink-0">2</span>
              Друг переходит по ссылке и регистрируется
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-accent text-emerald-700 flex items-center justify-center text-xs font-medium mt-0.5 shrink-0">3</span>
              Вы автоматически становитесь друзьями
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}
