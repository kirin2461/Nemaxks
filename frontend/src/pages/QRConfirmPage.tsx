import { useState, useEffect } from 'react'
import { useRoute, useLocation } from 'wouter'
import { useStore } from '@/lib/store'
import { authAPI } from '@/lib/api'
import { CheckCircle2, XCircle, Loader2, Smartphone, Shield } from 'lucide-react'

export default function QRConfirmPage() {
  const [, params] = useRoute('/qr-confirm/:token')
  const [, navigate] = useLocation()
  const { user, isAuthenticated } = useStore()
  const [status, setStatus] = useState<'loading' | 'confirming' | 'success' | 'error' | 'expired'>('loading')
  const [message, setMessage] = useState('')
  const [confirmedUser, setConfirmedUser] = useState<string | null>(null)

  const token = params?.token

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Недействительный QR-код')
      return
    }

    const checkSession = async () => {
      try {
        const result = await authAPI.checkQRLoginStatus(token)

        if (result.status === 'expired') {
          setStatus('expired')
          setMessage('Срок действия QR-кода истёк')
        } else if (result.status === 'confirmed') {
          setStatus('success')
          setMessage('Этот вход уже подтверждён')
        } else if (result.status === 'pending') {
          setStatus('confirming')
        }
      } catch (err: any) {
        if (err.status === 410) {
          setStatus('expired')
          setMessage('Срок действия QR-кода истёк')
        } else if (err.status === 404) {
          setStatus('error')
          setMessage('Недействительный QR-код')
        } else {
          setStatus('error')
          setMessage('Не удалось проверить QR-код')
        }
      }
    }

    checkSession()
  }, [token])

  const handleConfirm = async () => {
    if (!token || !isAuthenticated) return

    setStatus('loading')
    try {
      const result = await authAPI.confirmQRLogin(token)
      setStatus('success')
      setConfirmedUser(result.username)
      setMessage(`Вход подтверждён для ${result.username}`)
    } catch (err: any) {
      if (err.status === 410) {
        setStatus('expired')
        setMessage('Срок действия QR-кода истёк')
      } else {
        setStatus('error')
        setMessage(err.message || 'Не удалось подтвердить вход')
      }
    }
  }

  const handleCancel = () => {
    navigate('/')
  }

  const primaryButton =
    'w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150'

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-4">
        <div className="w-full max-w-[400px] rounded-xl border border-border bg-card shadow-soft p-8 text-center animate-scale-in [animation-duration:240ms]">
          <div className="w-16 h-16 rounded-full bg-accent grid place-items-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-emerald-600" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-[-0.015em] text-graphite-900 mb-2">Требуется авторизация</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Вам нужно войти в аккаунт на этом устройстве, чтобы подтвердить вход по QR-коду на другом устройстве.
          </p>
          <button onClick={() => navigate('/auth')} className={primaryButton}>
            Перейти ко входу
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-4">
      <div className="w-full max-w-[400px] rounded-xl border border-border bg-card shadow-soft p-8 text-center animate-scale-in [animation-duration:240ms]">
        {status === 'loading' && (
          <div className="animate-fade-in-soft">
            <Loader2 className="w-12 h-12 text-emerald-600 mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-display font-bold tracking-[-0.015em] text-graphite-900 mb-2">Обработка...</h1>
            <p className="text-sm text-muted-foreground">Пожалуйста, подождите</p>
          </div>
        )}

        {status === 'confirming' && (
          <div className="animate-fade-in-soft">
            <div className="w-16 h-16 rounded-full bg-accent grid place-items-center mx-auto mb-4">
              <Smartphone className="w-8 h-8 text-emerald-600" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-[-0.015em] text-graphite-900 mb-2">Подтверждение входа</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Другое устройство пытается войти как <span className="text-primary font-medium">{user?.username}</span>.
              Разрешить этот вход?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 h-12 px-6 rounded-lg border border-input bg-card text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 active:scale-[0.97] transition-all duration-150"
              >
                Отмена
              </button>
              <button onClick={handleConfirm} className={`flex-1 ${primaryButton.replace('w-full ', '')}`}>
                Подтвердить вход
              </button>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="animate-fade-in-soft">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4 animate-scale-in" strokeWidth={1.75} />
            <h1 className="text-2xl font-display font-bold tracking-[-0.015em] text-graphite-900 mb-2">Вход подтверждён!</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {confirmedUser ? `Пользователь ${confirmedUser} вошёл на другом устройстве.` : 'Другое устройство успешно вошло в аккаунт.'}
            </p>
            <button onClick={() => navigate('/')} className={primaryButton}>
              На главную
            </button>
          </div>
        )}

        {status === 'expired' && (
          <div className="animate-fade-in-soft">
            <div className="w-16 h-16 rounded-full bg-warning-soft grid place-items-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-warning" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-[-0.015em] text-graphite-900 mb-2">QR-код истёк</h1>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <button onClick={() => navigate('/')} className={primaryButton}>
              На главную
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-fade-in-soft">
            <div className="w-16 h-16 rounded-full bg-danger-soft grid place-items-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-destructive" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-[-0.015em] text-graphite-900 mb-2">Ошибка</h1>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <button onClick={() => navigate('/')} className={primaryButton}>
              На главную
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
