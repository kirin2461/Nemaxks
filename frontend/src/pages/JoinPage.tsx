import { useState, useEffect } from 'react'
import { useRoute, useLocation } from 'wouter'
import { referralAPI } from '@/lib/api'
import { useStore } from '@/lib/store'
import { Logo } from '@/components/Logo'
import { UserPlus, Check, AlertCircle, LogIn, Loader2 } from 'lucide-react'

export default function JoinPage() {
  const [, params] = useRoute('/join/:code')
  const [, setLocation] = useLocation()
  const code = params?.code || ''

  const [loading, setLoading] = useState(true)
  const [inviter, setInviter] = useState<{ username: string; avatar?: string } | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [joining, setJoining] = useState(false)

  const { isAuthenticated, checkAuth } = useStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!code) return
    loadInviteInfo()
  }, [code])

  const loadInviteInfo = async () => {
    try {
      const info = await referralAPI.getReferralInfo(code)
      setInviter({ username: info.inviter, avatar: info.avatar })
    } catch (err: any) {
      setError('Недействительный код приглашения')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!isAuthenticated) {
      localStorage.setItem('pending_referral', code)
      setLocation('/auth')
      return
    }

    setJoining(true)
    try {
      await referralAPI.useReferral(code)
      setSuccess(true)
      setTimeout(() => {
        setLocation('/friends')
      }, 2000)
    } catch (err: any) {
      setError(err.error || 'Не удалось использовать код приглашения')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-4">
      <div className="rounded-xl border border-border bg-card shadow-soft p-8 max-w-[420px] w-full text-center space-y-6 animate-scale-in [animation-duration:240ms]">
        <Logo className="mx-auto w-fit" />

        {error ? (
          <>
            <div className="rounded-lg bg-danger-soft border border-destructive/20 p-4 flex items-center gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <button
              onClick={() => setLocation('/auth')}
              className="w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 disabled:pointer-events-none disabled:opacity-50"
            >
              Перейти к авторизации
            </button>
          </>
        ) : success ? (
          <>
            <div className="w-16 h-16 rounded-full bg-accent grid place-items-center mx-auto animate-scale-in">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-[-0.015em] text-graphite-900">Добро пожаловать!</h1>
            <p className="text-sm text-muted-foreground">
              Вы присоединились по приглашению {inviter?.username}. Вы теперь друзья!
            </p>
          </>
        ) : (
          <>
            <div className="relative w-20 h-20 mx-auto">
              {/* pulse-ring once on mount */}
              <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-pulse-ring [animation-iteration-count:1]" />
              <div className="relative w-20 h-20 rounded-full bg-emerald-700 ring-1 ring-border grid place-items-center overflow-hidden">
                {inviter?.avatar ? (
                  <img
                    src={inviter.avatar}
                    alt={inviter.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <UserPlus className="w-9 h-9 text-white" strokeWidth={1.75} />
                )}
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-semibold text-primary">{inviter?.username}</span> приглашает вас в
              </p>
              <h1 className="text-xl font-display font-bold tracking-[-0.01em] text-graphite-900">Nebula</h1>
            </div>

            <div className="space-y-3">
              {isAuthenticated ? (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 disabled:pointer-events-none disabled:opacity-50"
                >
                  {joining ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Принять приглашение
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleJoin}
                    className="w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150"
                  >
                    <LogIn className="w-5 h-5" />
                    Войти и присоединиться
                  </button>
                  <p className="text-sm text-muted-foreground">
                    Войдите или создайте аккаунт, чтобы принять приглашение
                  </p>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-medium text-graphite-900 mb-2">Что такое Nebula?</h3>
              <p className="text-sm text-muted-foreground">
                Современная платформа для общения с друзьями, голосовыми и видео звонками,
                AI-ассистентом и многим другим.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
