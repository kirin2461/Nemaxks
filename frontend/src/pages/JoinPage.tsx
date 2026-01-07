import { useState, useEffect } from 'react'
import { useRoute, useLocation } from 'wouter'
import { referralAPI } from '@/lib/api'
import { useStore } from '@/lib/store'
import { Logo } from '@/components/Logo'
import { UserPlus, Check, AlertCircle, LogIn } from 'lucide-react'

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="card p-8 max-w-md w-full text-center space-y-6">
        <Logo className="mx-auto" />

        {error ? (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold">Ошибка</h1>
            <p className="text-muted-foreground">{error}</p>
            <button onClick={() => setLocation('/auth')} className="btn-primary w-full">
              Перейти к авторизации
            </button>
          </>
        ) : success ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold">Добро пожаловать!</h1>
            <p className="text-muted-foreground">
              Вы присоединились по приглашению {inviter?.username}. Вы теперь друзья!
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              {inviter?.avatar ? (
                <img
                  src={inviter.avatar}
                  alt={inviter.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <UserPlus className="w-10 h-10 text-primary" />
              )}
            </div>

            <div>
              <h1 className="text-2xl font-bold mb-2">Приглашение в Nemaks</h1>
              <p className="text-muted-foreground">
                <span className="font-semibold text-primary">{inviter?.username}</span> приглашает вас присоединиться к Nemaks
              </p>
            </div>

            <div className="space-y-3">
              {isAuthenticated ? (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {joining ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
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
                    className="btn-primary w-full flex items-center justify-center gap-2"
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
              <h3 className="font-medium mb-2">Что такое Nemaks?</h3>
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
