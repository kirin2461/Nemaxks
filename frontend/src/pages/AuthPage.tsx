import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '@/lib/store'
import { authAPI } from '@/lib/api'
import { Logo } from '@/components/Logo'
import { Moon, Sun, Zap, Snowflake, Droplet, Waves, TreePine, Sunset, Cpu, Wind, QrCode, RefreshCw, Smartphone, Palette, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'
import { Link } from 'wouter'

type ThemeName = 'dark' | 'light' | 'cosmic' | 'nebula-winter' | 'glass' | 'midnight-ocean' | 'forest-night' | 'sunset-glow' | 'neon-tokyo' | 'arctic-aurora'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [qrExpires, setQrExpires] = useState<Date | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)

  const { login, register, theme, setTheme, enableDemoMode, checkAuth } = useStore()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  // Auto-regenerate QR code when it expires (10 minutes)
  useEffect(() => {
    if (!showQR || !qrExpires) return

    const checkExpiry = () => {
      if (new Date() >= qrExpires) {
        generateQRCode()
      }
    }

    // Check every 5 seconds
    const expiryInterval = setInterval(checkExpiry, 5000)
    
    // Also set a timeout for exact expiry time
    const timeUntilExpiry = qrExpires.getTime() - Date.now()
    if (timeUntilExpiry > 0) {
      const expiryTimeout = setTimeout(() => {
        generateQRCode()
      }, timeUntilExpiry)
      
      return () => {
        clearInterval(expiryInterval)
        clearTimeout(expiryTimeout)
      }
    }

    return () => clearInterval(expiryInterval)
  }, [showQR, qrExpires, generateQRCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!isLogin && !agreeToTerms) {
      setError('Необходимо принять Правила использования и Политику конфиденциальности')
      return
    }

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

  const currentTheme = themes.find(t => t.value === theme) || themes[0]
  const CurrentThemeIcon = currentTheme.icon

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/50 p-4 relative z-10">
      {/* Theme selector - single button with dropdown */}
      <div ref={themeMenuRef} className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setShowThemeMenu(!showThemeMenu)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300',
            'border backdrop-blur-sm',
            'bg-card/80 hover:bg-accent/20 border-border hover:border-primary/50'
          )}
          title="Change theme"
        >
          <Palette className="w-4 h-4" />
          <CurrentThemeIcon className="w-4 h-4 text-primary" />
        </button>

        {showThemeMenu && (
          <div className="absolute top-full right-0 mt-2 w-48 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden animate-slide-in">
            <div className="p-2 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground px-2">Choose Theme</span>
            </div>
            <div className="py-1 max-h-[60vh] overflow-y-auto">
              {themes.map((t) => {
                const Icon = t.icon
                const isActive = theme === t.value
                return (
                  <button
                    key={t.value}
                    onClick={() => {
                      setTheme(t.value)
                      setShowThemeMenu(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-200',
                      'hover:bg-accent/20',
                      isActive && 'bg-primary/10'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                    <span className={cn('flex-1 text-left text-sm', isActive && 'font-medium text-primary')}>
                      {t.label}
                    </span>
                    {isActive && <Check className="w-4 h-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
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

            {!isLogin && (
              <div className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                <input
                  id="agree-terms"
                  type="checkbox"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="agree-terms" className="text-sm text-gray-300 cursor-pointer">
                  Я принимаю{' '}
                  <Link href="/terms" className="text-primary hover:underline">
                    Правила использования
                  </Link>{' '}
                  и{' '}
                  <Link href="/privacy" className="text-primary hover:underline">
                    Политику конфиденциальности
                  </Link>
                </label>
              </div>
            )}

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
