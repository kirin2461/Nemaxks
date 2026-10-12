import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '@/lib/store'
import { authAPI } from '@/lib/api'
import { Logo } from '@/components/Logo'
import { Moon, Sun, Zap, Snowflake, Droplet, Waves, TreePine, Sunset, Cpu, Wind, QrCode, RefreshCw, Smartphone, Palette, Check, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'
import { Link } from 'wouter'

type ThemeName = 'dark' | 'light' | 'cosmic' | 'nebula-winter' | 'glass' | 'midnight-ocean' | 'forest-night' | 'sunset-glow' | 'neon-tokyo' | 'arctic-aurora'
type Language = 'ru' | 'en'

const translations = {
  ru: {
    welcome: 'Добро пожаловать в Nebula',
    signInSubtitle: 'Войдите в свой аккаунт',
    signUpSubtitle: 'Создайте новый аккаунт',
    username: 'Имя пользователя',
    usernamePlaceholder: 'Введите имя пользователя',
    password: 'Пароль',
    passwordPlaceholder: 'Введите пароль',
    agreeTerms: 'Я соглашаюсь с',
    termsOfUse: 'Правилами использования',
    and: 'и',
    privacyPolicy: 'Политикой конфиденциальности',
    consentText: ', даю согласие на обработку моих персональных данных, а также на трансграничную передачу данных на серверы в США (Replit)',
    signIn: 'Войти',
    signUp: 'Зарегистрироваться',
    signingIn: 'Вход...',
    signingUp: 'Регистрация...',
    demoMode: 'Демо-режим (без сервера)',
    qrLogin: 'Войти по QR-коду',
    hideQr: 'Скрыть QR-код',
    scanWithPhone: 'Отсканируйте телефоном',
    qrExpired: 'QR-код истёк',
    generateNewQr: 'Сгенерировать новый QR-код',
    openUrl: 'Откройте эту ссылку на устройстве, где вы уже авторизованы',
    refreshQr: 'Обновить QR-код',
    noAccount: 'Нет аккаунта?',
    haveAccount: 'Уже есть аккаунт?',
    chooseTheme: 'Выбрать тему',
    chooseLanguage: 'Выбрать язык',
    termsError: 'Необходимо принять Правила использования и Политику конфиденциальности',
  },
  en: {
    welcome: 'Welcome to Nebula',
    signInSubtitle: 'Sign in to your account',
    signUpSubtitle: 'Create a new account',
    username: 'Username',
    usernamePlaceholder: 'Enter your username',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    agreeTerms: 'I agree to',
    termsOfUse: 'Terms of Use',
    and: 'and',
    privacyPolicy: 'Privacy Policy',
    consentText: ', consent to processing of my personal data and cross-border transfer to servers in the USA (Replit)',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    signingIn: 'Signing in...',
    signingUp: 'Signing up...',
    demoMode: 'Try Demo Mode (No Backend Required)',
    qrLogin: 'Login with QR Code',
    hideQr: 'Hide QR Login',
    scanWithPhone: 'Scan with your phone',
    qrExpired: 'QR code expired',
    generateNewQr: 'Generate New QR Code',
    openUrl: 'Open this URL on a device where you\'re logged in',
    refreshQr: 'Refresh QR Code',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    chooseTheme: 'Choose Theme',
    chooseLanguage: 'Choose Language',
    termsError: 'You must accept the Terms of Use and Privacy Policy',
  }
}

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
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('nemaks_language')
    return (saved as Language) || 'ru'
  })
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const langMenuRef = useRef<HTMLDivElement>(null)
  
  const t = translations[language]

  useEffect(() => {
    localStorage.setItem('nemaks_language', language)
  }, [language])

  const { login, register, theme, setTheme, enableDemoMode, checkAuth } = useStore()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false)
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false)
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
      setError(t.termsError)
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
    <div className="min-h-screen flex items-center justify-center bg-nebula p-4 relative z-10">
      {/* Theme and Language selectors */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {/* Language selector */}
        <div ref={langMenuRef} className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300',
              'border backdrop-blur-sm',
              'bg-card/80 hover:bg-accent/20 border-border hover:border-primary/50'
            )}
            title={t.chooseLanguage}
          >
            <Globe className="w-4 h-4" />
            <span className="text-sm font-medium">{language.toUpperCase()}</span>
          </button>

          {showLangMenu && (
            <div className="absolute top-full right-0 mt-2 w-40 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden animate-slide-in">
              <div className="p-2 border-b border-border">
                <span className="text-xs font-medium text-muted-foreground px-2">{t.chooseLanguage}</span>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setLanguage('ru')
                    setShowLangMenu(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-200',
                    'hover:bg-accent/20',
                    language === 'ru' && 'bg-primary/10'
                  )}
                >
                  <span className="text-lg">🇷🇺</span>
                  <span className={cn('flex-1 text-left text-sm', language === 'ru' && 'font-medium text-primary')}>
                    Русский
                  </span>
                  {language === 'ru' && <Check className="w-4 h-4 text-primary" />}
                </button>
                <button
                  onClick={() => {
                    setLanguage('en')
                    setShowLangMenu(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-200',
                    'hover:bg-accent/20',
                    language === 'en' && 'bg-primary/10'
                  )}
                >
                  <span className="text-lg">🇬🇧</span>
                  <span className={cn('flex-1 text-left text-sm', language === 'en' && 'font-medium text-primary')}>
                    English
                  </span>
                  {language === 'en' && <Check className="w-4 h-4 text-primary" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme selector */}
        <div ref={themeMenuRef} className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300',
              'border backdrop-blur-sm',
              'bg-card/80 hover:bg-accent/20 border-border hover:border-primary/50'
            )}
            title={t.chooseTheme}
          >
            <Palette className="w-4 h-4" />
            <CurrentThemeIcon className="w-4 h-4 text-primary" />
          </button>

          {showThemeMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden animate-slide-in">
              <div className="p-2 border-b border-border">
                <span className="text-xs font-medium text-muted-foreground px-2">{t.chooseTheme}</span>
              </div>
              <div className="py-1 max-h-[60vh] overflow-y-auto">
                {themes.map((themeItem) => {
                  const Icon = themeItem.icon
                  const isActive = theme === themeItem.value
                  return (
                    <button
                      key={themeItem.value}
                      onClick={() => {
                        setTheme(themeItem.value)
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
                        {themeItem.label}
                      </span>
                      {isActive && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-md relative z-10 px-2 sm:px-0">
        <div className="text-center mb-6 sm:mb-8 animate-fade-in">
          <div className="flex justify-center mb-3 sm:mb-4">
            <Logo size="lg" className="sm:hidden" />
            <Logo size="xl" className="hidden sm:block" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold gradient-text mb-2">
            {t.welcome}
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            {isLogin ? t.signInSubtitle : t.signUpSubtitle}
          </p>
        </div>

        <div className="glass-strong rounded-2xl p-6 animate-slide-in">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-foreground">
                {t.username}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.usernamePlaceholder}
                className="input-field relative z-50"
                required
              />
            </div>


            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                {t.password}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="input-field relative z-50"
                required
              />
            </div>

            {!isLogin && (
              <div className="flex items-start gap-3 p-3 bg-muted/60 border border-border rounded-lg">
                <input
                  id="agree-terms"
                  type="checkbox"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="agree-terms" className="text-sm text-foreground cursor-pointer leading-relaxed">
                  {t.agreeTerms}{' '}
                  <Link href="/terms" className="text-primary hover:underline">
                    {t.termsOfUse}
                  </Link>{' '}
                  {t.and}{' '}
                  <Link href="/privacy" className="text-primary hover:underline">
                    {t.privacyPolicy}
                  </Link>
                  {t.consentText}
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
              {loading ? (isLogin ? t.signingIn : t.signingUp) : (isLogin ? t.signIn : t.signUp)}
            </button>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleDemoMode}
                className="w-full px-4 py-3 bg-accent/20 hover:bg-accent/30 border border-border rounded-lg text-foreground transition-all duration-300 hover:border-primary/50 relative z-50"
              >
                {t.demoMode}
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
                  {showQR ? t.hideQr : t.qrLogin}
                </button>
              </div>
            )}

            {showQR && isLogin && (
              <div className="mt-6 p-6 glass rounded-xl animate-slide-in">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Smartphone className="w-5 h-5 text-primary" />
                    <span className="font-medium">{t.scanWithPhone}</span>
                  </div>
                  
                  {qrLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : isQRExpired || !qrToken ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-4">
                      <p className="text-muted-foreground">{t.qrExpired}</p>
                      <button
                        type="button"
                        onClick={generateQRCode}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t.generateNewQr}
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
                        {t.openUrl}
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
                        {t.refreshQr}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </form>

          <div className="my-6 border-t border-border" />

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? t.noAccount : t.haveAccount}
            {' '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
              }}
              className="text-primary hover:text-accent font-medium transition-colors hover:underline relative z-50"
            >
              {isLogin ? t.signUp : t.signIn}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
