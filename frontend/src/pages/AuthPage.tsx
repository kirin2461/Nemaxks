import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '@/lib/store'
import { authAPI } from '@/lib/api'
import { Logo } from '@/components/Logo'
import { QrCode, RefreshCw, Smartphone, Check, Globe, Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'
import { Link, useSearch, useLocation } from 'wouter'

type Language = 'ru' | 'en'

const translations = {
  ru: {
    welcome: 'Добро пожаловать в Nebula',
    signInSubtitle: 'Войдите в свой аккаунт',
    signUpSubtitle: 'Создайте новый аккаунт',
    signInTitle: 'С возвращением',
    signUpTitle: 'Создайте аккаунт',
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
    quoteText: 'Nebula собрала всё общение нашей команды в одном спокойном, быстром интерфейсе.',
    quoteAuthor: 'Команда Nebula',
  },
  en: {
    welcome: 'Welcome to Nebula',
    signInSubtitle: 'Sign in to your account',
    signUpSubtitle: 'Create a new account',
    signInTitle: 'Welcome back',
    signUpTitle: 'Create your account',
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
    quoteText: 'Nebula gathered all of our team communication into one calm, fast interface.',
    quoteAuthor: 'The Nebula Team',
  }
}

export default function AuthPage() {
  const searchString = useSearch()
  const [, setLocation] = useLocation()
  const [isLogin, setIsLogin] = useState(() => {
    if (typeof window === 'undefined') return true
    return new URLSearchParams(window.location.search).get('mode') !== 'register'
  })

  // Синхронизируем форму с query-параметром ?mode (например, ?mode=register)
  useEffect(() => {
    const mode = new URLSearchParams(searchString).get('mode')
    setIsLogin(mode !== 'register')
  }, [searchString])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [qrExpires, setQrExpires] = useState<Date | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('nemaks_language')
    return (saved as Language) || 'ru'
  })
  const langMenuRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const t = translations[language]

  useEffect(() => {
    localStorage.setItem('nemaks_language', language)
  }, [language])

  const { login, register, enableDemoMode, checkAuth } = useStore()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Error shake: translateX ±4px ×2, 200ms (auth-landing.md §2)
  useEffect(() => {
    if (!error || !formRef.current) return
    formRef.current.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 200, easing: 'ease-in-out' }
    )
  }, [error])

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

  const switchMode = (next: boolean) => {
    setIsLogin(next)
    setError('')
    setLocation(next ? '/auth' : '/auth?mode=register', { replace: true })
  }

  const getQRUrl = () => {
    if (!qrToken) return ''
    const baseUrl = window.location.origin
    return `${baseUrl}/qr-confirm/${qrToken}`
  }

  const isQRExpired = qrExpires && new Date() > qrExpires

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Language selector */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <div ref={langMenuRef} className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground"
            title={t.chooseLanguage}
          >
            <Globe className="w-4 h-4" />
            <span>{language.toUpperCase()}</span>
          </button>

          {showLangMenu && (
            <div className="absolute top-full right-0 mt-2 w-44 bg-popover border border-border rounded-xl shadow-pop overflow-hidden animate-pop-menu">
              <div className="px-3 py-2 border-b border-border">
                <span className="text-xs font-medium text-muted-foreground">{t.chooseLanguage}</span>
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    setLanguage('ru')
                    setShowLangMenu(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-sm transition-all duration-150',
                    'hover:bg-accent hover:text-accent-foreground',
                    language === 'ru' && 'bg-accent font-medium text-accent-foreground'
                  )}
                >
                  <span className="text-base">🇷🇺</span>
                  <span className="flex-1 text-left">Русский</span>
                  {language === 'ru' && <Check className="w-4 h-4 text-primary" />}
                </button>
                <button
                  onClick={() => {
                    setLanguage('en')
                    setShowLangMenu(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-sm transition-all duration-150',
                    'hover:bg-accent hover:text-accent-foreground',
                    language === 'en' && 'bg-accent font-medium text-accent-foreground'
                  )}
                >
                  <span className="text-base">🇬🇧</span>
                  <span className="flex-1 text-left">English</span>
                  {language === 'en' && <Check className="w-4 h-4 text-primary" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Left panel — form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] animate-rise-in">
          <div className="mb-8">
            <Logo size="md" showText className="mb-8" />
            <h1 className="text-2xl font-display font-bold tracking-[-0.015em] text-graphite-900 mb-1.5">
              {isLogin ? t.signInTitle : t.signUpTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLogin ? t.signInSubtitle : t.signUpSubtitle}
            </p>
          </div>

          {/* Login / Register pill tabs */}
          <div className="flex p-1 rounded-lg bg-secondary gap-1 w-full mb-6">
            <button
              type="button"
              onClick={() => switchMode(true)}
              className={cn(
                'h-9 flex-1 rounded-md text-sm transition-all duration-150',
                isLogin ? 'bg-card text-foreground shadow-soft font-medium' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.signIn}
            </button>
            <button
              type="button"
              onClick={() => switchMode(false)}
              className={cn(
                'h-9 flex-1 rounded-md text-sm transition-all duration-150',
                !isLogin ? 'bg-card text-foreground shadow-soft font-medium' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.signUp}
            </button>
          </div>

          <form
            ref={formRef}
            key={isLogin ? 'login' : 'register'}
            onSubmit={handleSubmit}
            className="space-y-5 animate-fade-in-soft"
          >
            <div className="animate-rise-in [animation-fill-mode:both]" style={{ animationDelay: '50ms' }}>
              <label htmlFor="username" className="block text-sm font-medium mb-1.5 text-foreground">
                {t.username}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.usernamePlaceholder}
                className="input-field"
                required
              />
            </div>

            <div className="animate-rise-in [animation-fill-mode:both]" style={{ animationDelay: '100ms' }}>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-foreground">
                {t.password}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  className="input-field pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div
                className="flex items-start gap-3 p-3 bg-graphite-100 border border-border rounded-lg animate-rise-in [animation-fill-mode:both]"
                style={{ animationDelay: '150ms' }}
              >
                <input
                  id="agree-terms"
                  type="checkbox"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-input bg-card text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="agree-terms" className="text-sm text-graphite-600 cursor-pointer leading-relaxed">
                  {t.agreeTerms}{' '}
                  <Link href="/terms" className="text-primary hover:underline underline-offset-4">
                    {t.termsOfUse}
                  </Link>{' '}
                  {t.and}{' '}
                  <Link href="/privacy" className="text-primary hover:underline underline-offset-4">
                    {t.privacyPolicy}
                  </Link>
                  {t.consentText}
                </label>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-danger-soft border border-destructive/20 text-destructive text-sm animate-fade-in-soft">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? (isLogin ? t.signingIn : t.signingUp) : (isLogin ? t.signIn : t.signUp)}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 text-xs text-graphite-400">
              <span className="flex-1 h-px bg-border" />
              <span>·</span>
              <span className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-3 animate-rise-in [animation-fill-mode:both]" style={{ animationDelay: '200ms' }}>
              <button
                type="button"
                onClick={handleDemoMode}
                className="w-full h-11 px-4 inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-card text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 active:scale-[0.97] transition-all duration-150"
              >
                {t.demoMode}
              </button>

              {isLogin && (
                <button
                  type="button"
                  onClick={() => setShowQR(!showQR)}
                  className="w-full h-11 px-4 inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-card text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 active:scale-[0.97] transition-all duration-150"
                >
                  <QrCode className="w-[18px] h-[18px] text-emerald-600" />
                  {showQR ? t.hideQr : t.qrLogin}
                </button>
              )}
            </div>

            {showQR && isLogin && (
              <div className="p-6 rounded-xl border border-border bg-card shadow-soft animate-scale-in">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Smartphone className="w-5 h-5 text-emerald-600" />
                    <span className="font-medium text-foreground">{t.scanWithPhone}</span>
                  </div>

                  {qrLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    </div>
                  ) : isQRExpired || !qrToken ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-4">
                      <p className="text-muted-foreground text-sm">{t.qrExpired}</p>
                      <button
                        type="button"
                        onClick={generateQRCode}
                        className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 active:scale-[0.97] transition-all duration-150"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t.generateNewQr}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative p-4 bg-card rounded-xl border border-border shadow-soft">
                        {/* Emerald corner brackets */}
                        <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-emerald-600 rounded-tl-xl" />
                        <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-emerald-600 rounded-tr-xl" />
                        <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-emerald-600 rounded-bl-xl" />
                        <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-emerald-600 rounded-br-xl" />
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
                        className="flex items-center gap-2 text-sm text-primary hover:underline underline-offset-4 transition-colors"
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

          <p className="text-center text-xs text-graphite-400 mt-6">
            {isLogin ? t.noAccount : t.haveAccount}
            {' '}
            <button
              type="button"
              onClick={() => switchMode(!isLogin)}
              className="text-primary font-medium hover:underline underline-offset-4 transition-colors"
            >
              {isLogin ? t.signUp : t.signIn}
            </button>
          </p>
        </div>
      </div>

      {/* Right panel — decorative (≥1024px) */}
      <div className="hidden lg:block relative bg-graphite-100 overflow-hidden">
        {/* Fine 1px graphite grid lines */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--graphite-200)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--graphite-200)) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Floating chat bubble cluster */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-[420px] h-[420px]">
            <div className="absolute top-6 left-0 max-w-[260px] rounded-2xl rounded-bl-[6px] bg-card border border-border px-4 py-3 shadow-soft animate-rise-in [animation-fill-mode:both]" style={{ animationDelay: '300ms' }}>
              <div className="h-2.5 w-40 rounded-full bg-graphite-200 mb-2" />
              <div className="h-2.5 w-24 rounded-full bg-graphite-100" />
            </div>
            <div className="absolute top-36 right-0 max-w-[240px] rounded-2xl rounded-br-[6px] bg-primary px-4 py-3 shadow-soft animate-rise-in [animation-fill-mode:both]" style={{ animationDelay: '420ms' }}>
              <div className="h-2.5 w-36 rounded-full bg-emerald-200/60 mb-2" />
              <div className="h-2.5 w-20 rounded-full bg-emerald-200/40" />
            </div>
            <div className="absolute bottom-8 left-10 max-w-[220px] rounded-2xl rounded-bl-[6px] bg-card border border-border px-4 py-3 shadow-soft animate-rise-in [animation-fill-mode:both]" style={{ animationDelay: '540ms' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-emerald-700" />
                <div className="h-2.5 w-24 rounded-full bg-graphite-200" />
              </div>
              <div className="h-2.5 w-32 rounded-full bg-graphite-100" />
            </div>
          </div>
        </div>
        {/* Overlay quote card */}
        <div className="absolute bottom-10 left-10 bg-card rounded-xl shadow-pop p-5 max-w-[320px] border border-border animate-scale-in [animation-fill-mode:both]" style={{ animationDelay: '600ms' }}>
          <p className="text-sm text-graphite-700 leading-6 mb-3">«{t.quoteText}»</p>
          <p className="text-xs font-medium text-muted-foreground">{t.quoteAuthor}</p>
        </div>
      </div>
    </div>
  )
}
