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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
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
            <button onClick={() => setLocation('/channels')} className="btn-primary w-full">
              Перейти к каналам
            </button>
          </>
        ) : success ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold">Добро пожаловать!</h1>
            <p className="text-muted-foreground">
              Вы успешно присоединились к серверу!
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto">
              <Users className="w-10 h-10 text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-bold mb-2">Приглашение на сервер</h1>
              <p className="text-muted-foreground">
                Вас пригласили присоединиться к серверу
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
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Users className="w-5 h-5" />
                      Присоединиться к серверу
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
