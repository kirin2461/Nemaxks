import { useState, useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { referralAPI } from '@/lib/api'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check, Users, Link2, QrCode, Share2 } from 'lucide-react'
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
          title: 'Присоединяйся к Nemaks!',
          text: 'Приглашаю тебя в Nemaks - современную платформу для общения',
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-primary/20">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Пригласить друзей</h1>
            <p className="text-muted-foreground">Делись ссылкой и приглашай друзей в Nemaks</p>
          </div>
        </div>

        <div className="card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Твоя реферальная ссылка</h2>
              <p className="text-sm text-muted-foreground">Поделись этой ссылкой с друзьями</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{inviteCount}</div>
              <div className="text-xs text-muted-foreground">приглашено</div>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 bg-secondary/50 rounded-lg px-4 py-3 font-mono text-sm truncate">
              {getInviteLink()}
            </div>
            <button
              onClick={copyLink}
              className={cn(
                "btn-secondary p-3 transition-all",
                copied && "bg-green-500/20 text-green-500"
              )}
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowQR(!showQR)}
              className={cn(
                "btn-secondary p-3",
                showQR && "bg-primary/20 text-primary"
              )}
            >
              <QrCode className="w-5 h-5" />
            </button>
            {'share' in navigator && (
              <button onClick={shareLink} className="btn-secondary p-3">
                <Share2 className="w-5 h-5" />
              </button>
            )}
          </div>

          {showQR && (
            <div className="flex justify-center p-6 bg-white rounded-xl">
              <QRCodeSVG
                value={getInviteLink()}
                size={200}
                level="H"
                includeMargin
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={copyLink} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Link2 className="w-4 h-4" />
              Скопировать ссылку
            </button>
            {'share' in navigator && (
              <button onClick={shareLink} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" />
                Поделиться
              </button>
            )}
          </div>
        </div>

        {invitedUsers.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Приглашённые друзья</h2>
            <div className="space-y-3">
              {invitedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-primary">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{user.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(user.invited_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-6 bg-gradient-to-br from-primary/10 to-transparent">
          <h3 className="font-semibold mb-2">Как это работает?</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs mt-0.5">1</span>
              Поделись своей ссылкой или QR-кодом с друзьями
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs mt-0.5">2</span>
              Друг переходит по ссылке и регистрируется
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs mt-0.5">3</span>
              Вы автоматически становитесь друзьями
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}
