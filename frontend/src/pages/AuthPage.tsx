import React, { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { authAPI } from '@/lib/api'
import { Logo } from '@/components/Logo'
import { Moon, Sun, Zap, Snowflake, Droplet, Waves, TreePine, Sunset, Cpu, Wind, QrCode, RefreshCw, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'

type ThemeName = 'dark' | 'light' | 'cosmic' | 'nebula-winter' | 'glass' | 'midnight-ocean' | 'forest-night' | 'sunset-glow' | 'neon-tokyo' | 'arctic-aurora'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [qrExpires, setQrExpires] = useState<Date | null>(null)
  const [qrLoading, setQrLoading] = useState(false)

  const { login, register, theme, setTheme, enableDemoMode, checkAuth } = useStore()

  const generateQRCode = useCallback(async () => {
    setQrLoading(true)
    try {
      const result = await authAPI.generateQRLogin()
      setQrToken(result.token)
      setQrExpires(new Date(result.expires_at))
    } catch (err) {
      console.error('Failed to generate QR code:', err)
    } finally {
      setQrLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!showQR || !qrToken) return

    const pollInterval = setInterval(async () => {
      try {
        const result = await authAPI.checkQRLoginStatus(qrToken)
        
        if (result.status === 'confirmed' && result.jwt_token) {
          localStorage.setItem('token', result.jwt_token)
          clearInterval(pollInterval)
          await checkAuth()
        } else if (result.status === 'expired') {
          setQrToken(null)
          setQrExpires(null)
          clearInterval(pollInterval)
        }
      } catch (err: any) {
        if (err.status === 410) {
          setQrToken(null)
          setQrExpires(null)
          clearInterval(pollInterval)
        } else {
          console.error('QR status check failed:', err)
        }
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [showQR, qrToken, checkAuth])

  useEffect(() => {
    if (showQR && !qrToken) {
      generateQRCode()
    }
  }, [showQR, qrToken, generateQRCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        await login(username, password)
      } else {
        await register(username, password)
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoMode = () => {
    enableDemoMode()
  }

  const getQRUrl = () => {
    if (!qrToken) return ''
    const baseUrl = window.location.origin
    return `${baseUrl}/qr-confirm/${qrToken}`
  }

  const isQRExpired = qrExpires && new Date() > qrExpires

  const themes: Array<{
    value: ThemeName
    label: string
    icon: any
  }> = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'cosmic', label: 'Cosmic', icon: Zap },
    { value: 'nebula-winter', label: 'Nebula', icon: Snowflake },
    { value: 'glass', label: 'Glass', icon: Droplet },
    { value: 'midnight-ocean', label: 'Ocean', icon: Waves },
    { value: 'forest-night', label: 'Forest', icon: TreePine },
    { value: 'sunset-glow', label: 'Sunset', icon: Sunset },
    { value: 'neon-tokyo', label: 'Neon', icon: Cpu },
    { value: 'arctic-aurora', label: 'Aurora', icon: Wind },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/50 p-4 pt-16 sm:pt-4 relative z-10">
      {/* Theme selector - responsive */}
      <div className="fixed top-2 sm:top-4 left-2 right-2 sm:left-auto sm:right-4 flex flex-wrap justify-center sm:justify-end gap-1 sm:gap-1.5 max-w-full sm:max-w-md z-50">
        {themes.map((t) => {
          const Icon = t.icon
          const isActive = theme === t.value
          return (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                'flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg transition-all duration-300',
                'border backdrop-blur-sm text-[10px] sm:text-xs',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105'
                  : 'bg-card/80 hover:bg-accent/20 border-border hover:border-primary/50 hover:scale-105'
              )}
              title={t.label}
            >
              <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline font-medium">{t.label}</span>
            </button>
          )
        })}
      </div>

      <div className="w-full max-w-md relative z-10 px-2 sm:px-0">
        <div className="text-center mb-6 sm:mb-8 animate-fade-in">
          <div className="flex justify-center mb-3 sm:mb-4">
            <Logo size="lg" className="sm:hidden" />
            <Logo size="xl" className="hidden sm:block" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold gradient-text mb-2">
            Welcome to Nemaks
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <div className="card-cosmic animate-slide-in">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-foreground">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary relative z-50"
                required
              />
            </div>


            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary relative z-50"
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm animate-slide-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-cosmic w-full"
            >
              {loading ? (isLogin ? 'Signing in...' : 'Signing up...') : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleDemoMode}
                className="w-full px-4 py-3 bg-accent/20 hover:bg-accent/30 border border-border rounded-lg text-foreground transition-all duration-300 hover:border-primary/50 relative z-50"
              >
                Try Demo Mode (No Backend Required)
              </button>
            </div>

            {isLogin && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowQR(!showQR)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-primary transition-all duration-300 hover:border-primary/50 relative z-50"
                >
                  <QrCode className="w-5 h-5" />
                  {showQR ? 'Hide QR Login' : 'Login with QR Code'}
                </button>
              </div>
            )}

            {showQR && isLogin && (
              <div className="mt-6 p-6 bg-card/50 backdrop-blur-sm border border-border rounded-xl animate-slide-in">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Smartphone className="w-5 h-5 text-primary" />
                    <span className="font-medium">Scan with your phone</span>
                  </div>
                  
                  {qrLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : isQRExpired || !qrToken ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-4">
                      <p className="text-muted-foreground">QR code expired</p>
                      <button
                        type="button"
                        onClick={generateQRCode}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Generate New QR Code
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-white rounded-xl">
                        <QRCodeSVG
                          value={getQRUrl()}
                          size={180}
                          level="H"
                          includeMargin
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Open this URL on a device where you're logged in
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setQrToken(null)
                          generateQRCode()
                        }}
                        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Refresh QR Code
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </form>

          <div className="my-6 border-t border-border" />

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            {' '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
              }}
              className="text-primary hover:text-accent font-medium transition-colors hover:underline relative z-50"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
