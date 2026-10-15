import { useState, useEffect } from 'react'
import { useRoute, useLocation } from 'wouter'
import { invitesAPI } from '@/lib/api'
import { useStore } from '@/lib/store'
import { Logo } from '@/components/Logo'
import { Users, Check, AlertCircle, LogIn, Loader2 } from 'lucide-react'

export default function ServerJoinPage() {
  const [, params] = useRoute('/invite/:code')
  const [, setLocation] = useLocation()
  const code = params?.code || ''

  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState<any>(null)
  void invite
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
      const info = await invitesAPI.getInvite(code)
      setInvite(info)
    } catch (err: any) {
      if (err.status === 410) {
        setError('Приглашение истекло или достигнут лимит использований')
      } else {
        setError('Недействительный код приглашения')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!isAuthenticated) {
      localStorage.setItem('pending_server_invite', code)
      setLocation('/auth')
      return
    }

    setJoining(true)
    try {
      await invitesAPI.useInvite(code)
      setSuccess(true)
      setTimeout(() => {
        setLocation('/channels')
      }, 2000)
    } catch (err: any) {
      setError(err.error || 'Не удалось присоединиться к серверу')
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
              onClick={() => setLocation('/channels')}
              className="w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 disabled:pointer-events-none disabled:opacity-50"
            >
              Перейти к каналам
            </button>
          </>
        ) : success ? (
          <>
            <div className="w-16 h-16 rounded-full bg-accent grid place-items-center mx-auto animate-scale-in">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-[-0.015em] text-graphite-900">Добро пожаловать!</h1>
            <p className="text-sm text-muted-foreground">
              Вы успешно присоединились к серверу!
            </p>
          </>
        ) : (
          <>
            <div className="relative w-16 h-16 mx-auto">
              {/* pulse-ring once on mount */}
              <span className="absolute inset-0 rounded-xl bg-emerald-500/40 animate-pulse-ring [animation-iteration-count:1]" />
              <div className="relative w-16 h-16 rounded-xl bg-emerald-700 grid place-items-center shadow-soft">
                <Users className="w-8 h-8 text-white" strokeWidth={1.75} />
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Вас пригласили присоединиться к серверу
              </p>
              <h1 className="text-xl font-display font-bold tracking-[-0.01em] text-graphite-900">Приглашение на сервер</h1>
            </div>

            <div className="space-y-3">
              {isAuthenticated ? (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 disabled:pointer-events-none disabled:opacity-50"
                >
                  {joining ? (
                    <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
                  ) : (
                    <>
                      <Users className="w-5 h-5 flex-shrink-0" />
                      <span className="hidden sm:inline">Присоединиться к серверу</span>
                      <span className="sm:hidden">Присоединиться</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleJoin}
                    className="w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150"
                  >
                    <LogIn className="w-5 h-5 flex-shrink-0" />
                    <span className="hidden sm:inline">Войти и присоединиться</span>
                    <span className="sm:hidden">Войти</span>
                  </button>
                  <p className="text-sm text-muted-foreground">
                    Войдите или создайте аккаунт, чтобы присоединиться
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
