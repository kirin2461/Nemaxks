import { useState, useEffect } from 'react'
import { useRoute, useLocation } from 'wouter'
import { useStore } from '@/lib/store'
import { authAPI } from '@/lib/api'
import { CheckCircle, XCircle, Loader2, Smartphone, Shield } from 'lucide-react'

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nebula p-4 relative z-10">
        <div className="w-full max-w-md text-center">
          <div className="glass-strong rounded-xl p-8 animate-slide-in">
            <Shield className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Требуется авторизация</h1>
            <p className="text-muted-foreground mb-6">
              Вам нужно войти в аккаунт на этом устройстве, чтобы подтвердить вход по QR-коду на другом устройстве.
            </p>
            <button
              onClick={() => navigate('/auth')}
              className="px-4 py-3 rounded-lg gradient-brand text-primary-foreground font-medium shadow-soft hover:brightness-110 transition-all w-full"
            >
              Перейти ко входу
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-nebula p-4 relative z-10">
      <div className="w-full max-w-md">
        <div className="glass-strong rounded-xl p-8 text-center animate-slide-in">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <h1 className="text-2xl font-bold mb-2">Обработка...</h1>
              <p className="text-muted-foreground">Пожалуйста, подождите</p>
            </>
          )}

          {status === 'confirming' && (
            <>
              <Smartphone className="w-16 h-16 text-primary mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Подтверждение входа</h1>
              <p className="text-muted-foreground mb-6">
                Другое устройство пытается войти как <span className="text-primary font-medium">{user?.username}</span>.
                Разрешить этот вход?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-3 bg-muted hover:bg-primary/10 border border-border rounded-lg text-foreground transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-3 rounded-lg gradient-brand text-primary-foreground font-medium shadow-soft hover:brightness-110 transition-all"
                >
                  Подтвердить вход
                </button>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-accent mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Вход подтверждён!</h1>
              <p className="text-muted-foreground mb-6">
                {confirmedUser ? `Пользователь ${confirmedUser} вошёл на другом устройстве.` : 'Другое устройство успешно вошло в аккаунт.'}
              </p>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-3 rounded-lg gradient-brand text-primary-foreground font-medium shadow-soft hover:brightness-110 transition-all w-full"
              >
                На главную
              </button>
            </>
          )}

          {status === 'expired' && (
            <>
              <XCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">QR-код истёк</h1>
              <p className="text-muted-foreground mb-6">{message}</p>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-3 rounded-lg gradient-brand text-primary-foreground font-medium shadow-soft hover:brightness-110 transition-all w-full"
              >
                На главную
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Ошибка</h1>
              <p className="text-muted-foreground mb-6">{message}</p>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-3 rounded-lg gradient-brand text-primary-foreground font-medium shadow-soft hover:brightness-110 transition-all w-full"
              >
                На главную
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
