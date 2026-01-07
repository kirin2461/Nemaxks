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
      setMessage('Invalid QR code')
      return
    }

    const checkSession = async () => {
      try {
        const result = await authAPI.checkQRLoginStatus(token)
        
        if (result.status === 'expired') {
          setStatus('expired')
          setMessage('This QR code has expired')
        } else if (result.status === 'confirmed') {
          setStatus('success')
          setMessage('This login has already been confirmed')
        } else if (result.status === 'pending') {
          setStatus('confirming')
        }
      } catch (err: any) {
        if (err.status === 410) {
          setStatus('expired')
          setMessage('This QR code has expired')
        } else if (err.status === 404) {
          setStatus('error')
          setMessage('Invalid QR code')
        } else {
          setStatus('error')
          setMessage('Failed to verify QR code')
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
      setMessage(`Login confirmed for ${result.username}`)
    } catch (err: any) {
      if (err.status === 410) {
        setStatus('expired')
        setMessage('This QR code has expired')
      } else {
        setStatus('error')
        setMessage(err.message || 'Failed to confirm login')
      }
    }
  }

  const handleCancel = () => {
    navigate('/')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background/50 p-4 relative z-10">
        <div className="w-full max-w-md text-center">
          <div className="card-cosmic p-8">
            <Shield className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Authentication Required</h1>
            <p className="text-muted-foreground mb-6">
              You need to be logged in on this device to confirm QR login for another device.
            </p>
            <button
              onClick={() => navigate('/auth')}
              className="btn-cosmic w-full"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/50 p-4 relative z-10">
      <div className="w-full max-w-md">
        <div className="card-cosmic p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <h1 className="text-2xl font-bold mb-2">Processing...</h1>
              <p className="text-muted-foreground">Please wait</p>
            </>
          )}

          {status === 'confirming' && (
            <>
              <Smartphone className="w-16 h-16 text-primary mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Confirm Login</h1>
              <p className="text-muted-foreground mb-6">
                Another device is trying to log in as <span className="text-primary font-medium">{user?.username}</span>.
                Do you want to allow this?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-3 bg-muted hover:bg-muted/80 border border-border rounded-lg text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 btn-cosmic"
                >
                  Confirm Login
                </button>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Login Confirmed!</h1>
              <p className="text-muted-foreground mb-6">
                {confirmedUser ? `${confirmedUser} has been logged in on the other device.` : 'The other device is now logged in.'}
              </p>
              <button
                onClick={() => navigate('/')}
                className="btn-cosmic w-full"
              >
                Go to Dashboard
              </button>
            </>
          )}

          {status === 'expired' && (
            <>
              <XCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">QR Code Expired</h1>
              <p className="text-muted-foreground mb-6">{message}</p>
              <button
                onClick={() => navigate('/')}
                className="btn-cosmic w-full"
              >
                Go to Dashboard
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Error</h1>
              <p className="text-muted-foreground mb-6">{message}</p>
              <button
                onClick={() => navigate('/')}
                className="btn-cosmic w-full"
              >
                Go to Dashboard
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
