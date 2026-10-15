import React, { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { MessageSquare, Shield, Zap, Users, Trophy, Gift, Bot, Gamepad2, ArrowRight, Key, Crown, UserCheck } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { useStore } from '@/lib/store'
import { Logo } from '@/components/Logo'

const features = [
  {
    icon: Key,
    title: "Система лицензий",
    description: "Гибкие тарифы: месяц (50₽), квартал (125₽), год (500₽). Уникальные ключи NEMKS-XXXXX-XXXXX-XXXXX."
  },
  {
    icon: MessageSquare,
    title: "Сообщения и каналы",
    description: "Личные сообщения, групповые чаты, гильдии с каналами, реакции и ответы."
  },
  {
    icon: Bot,
    title: "AI-ассистент Jarvis",
    description: "Умный помощник для ответов на вопросы и выполнения задач прямо в чате."
  },
  {
    icon: Shield,
    title: "Безопасность",
    description: "Двухфакторная аутентификация (2FA), QR-вход, шифрование сообщений, антифрод система."
  },
  {
    icon: Trophy,
    title: "Геймификация",
    description: "Уровни и XP, достижения, ежедневные награды, испытания, стрики и рейтинги."
  },
  {
    icon: Gift,
    title: "Магазин и валюта",
    description: "Внутренняя валюта (Coins/Gems), магазин предметов, подарки и обмен между игроками."
  },
  {
    icon: Gamepad2,
    title: "Мини-игры и квесты",
    description: "Развлекательные мини-игры, цепочки квестов, кланы и соревнования."
  },
  {
    icon: Crown,
    title: "Super Admin панель",
    description: "Полный контроль платформы: статистика, управление пользователями, безопасность."
  },
  {
    icon: UserCheck,
    title: "Модерация",
    description: "Система жалоб, бан пользователей и IP, запрещённые слова, аудит-логи."
  }
]

const stats = [
  { value: 17, suffix: '', label: 'API-эндпоинтов' },
  { value: 4, suffix: '', label: 'Микросервиса' },
  { value: 9, suffix: '+', label: 'Ключевых функций' },
  { value: 3, suffix: '', label: 'Тарифа лицензии' },
]

/** Count-up number: 800ms once when scrolled into view (auth-landing.md §1 stats band) */
function StatValue({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20% 0px' })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return
    const duration = 800
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(eased * value))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value])

  return (
    <span ref={ref}>
      {display}{suffix}
    </span>
  )
}

/** CSS-макет нового светлого 3-колоночного интерфейса мессенджера (вместо landing-hero.png) */
function HeroMockup() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-pop overflow-hidden text-left">
      {/* Window bar */}
      <div className="h-10 flex items-center gap-1.5 px-4 border-b border-border bg-card">
        <span className="w-2.5 h-2.5 rounded-full bg-graphite-200" />
        <span className="w-2.5 h-2.5 rounded-full bg-graphite-200" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
      </div>
      <div className="flex h-[340px] sm:h-[420px]">
        {/* Rail */}
        <div className="w-12 sm:w-14 border-r border-border bg-card flex flex-col items-center py-3 gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-graphite-900" />
          <span className="w-8 h-8 rounded-xl bg-primary shadow-lg-brand" />
          <span className="w-8 h-8 rounded-xl bg-graphite-100" />
          <span className="w-8 h-8 rounded-xl bg-graphite-100" />
          <span className="mt-auto w-7 h-7 rounded-full bg-emerald-700" />
        </div>
        {/* Chat list */}
        <div className="w-36 sm:w-52 border-r border-border bg-card p-3 space-y-2.5">
          <div className="h-7 rounded-lg bg-graphite-100 mb-3" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`flex items-center gap-2.5 rounded-lg p-2 ${i === 0 ? 'bg-accent' : ''}`}>
              <span className={`w-8 h-8 rounded-full shrink-0 ${i === 0 ? 'bg-emerald-700' : 'bg-graphite-200'}`} />
              <div className="flex-1 space-y-1.5">
                <div className={`h-2 rounded-full ${i === 0 ? 'bg-emerald-200 w-3/4' : 'bg-graphite-200 w-2/3'}`} />
                <div className="h-2 rounded-full bg-graphite-100 w-full" />
              </div>
            </div>
          ))}
        </div>
        {/* Conversation */}
        <div className="flex-1 bg-background flex flex-col">
          <div className="h-11 border-b border-border bg-card flex items-center px-4 gap-2.5">
            <span className="w-6 h-6 rounded-full bg-graphite-200" />
            <div className="h-2 w-24 rounded-full bg-graphite-200" />
          </div>
          <div className="flex-1 p-4 space-y-3 overflow-hidden">
            <div className="max-w-[55%] rounded-2xl rounded-bl-[6px] bg-card border border-border px-3.5 py-2.5 shadow-soft space-y-1.5">
              <div className="h-2 rounded-full bg-graphite-200 w-full" />
              <div className="h-2 rounded-full bg-graphite-100 w-1/2" />
            </div>
            <div className="max-w-[55%] ml-auto rounded-2xl rounded-br-[6px] bg-primary px-3.5 py-2.5 shadow-soft space-y-1.5">
              <div className="h-2 rounded-full bg-emerald-200/60 w-full" />
              <div className="h-2 rounded-full bg-emerald-200/40 w-2/3" />
            </div>
            <div className="max-w-[45%] rounded-2xl rounded-bl-[6px] bg-card border border-border px-3.5 py-2.5 shadow-soft">
              <div className="h-2 rounded-full bg-graphite-200 w-3/4" />
            </div>
            <div className="max-w-[55%] ml-auto rounded-2xl rounded-br-[6px] bg-primary px-3.5 py-2.5 shadow-soft">
              <div className="h-2 rounded-full bg-emerald-200/60 w-5/6" />
            </div>
          </div>
          <div className="min-h-11 border-t border-border bg-card flex items-center px-4 gap-3">
            <div className="h-7 flex-1 rounded-lg border border-input bg-card" />
            <span className="w-7 h-7 rounded-lg bg-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PresentationPage() {
  const enableDemoMode = useStore((s) => s.enableDemoMode)
  const [, setLocation] = useLocation()

  const handleDemo = () => {
    enableDemoMode()
    setLocation('/')
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden font-sans">
      {/* Marketing shell header */}
      <header className="sticky top-0 z-40 bg-background/95 border-b border-border">
        <div className="h-16 max-w-[1120px] mx-auto px-6 flex items-center justify-between">
          <Link href="/welcome">
            <Logo size="sm" showText />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
              Возможности
            </a>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
              Контакты
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/auth">
              <button className="h-9 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150 whitespace-nowrap">
                Войти
              </button>
            </Link>
            <Link href="/auth?mode=register">
              <button className="h-9 px-3 inline-flex items-center justify-center rounded-lg text-sm font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 whitespace-nowrap">
                <span className="hidden sm:inline">Присоединиться</span>
                <span className="sm:hidden">Join</span>
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-16 sm:pt-20 pb-8 px-6">
        <div className="max-w-[1120px] mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center mb-6"
          >
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              Nebula 2.0
            </span>
          </motion.div>

          <h1 className="text-4xl sm:text-5xl font-display font-extrabold tracking-[-0.03em] text-graphite-900 max-w-[16ch] mx-auto leading-[1.08] mb-6">
            {['Общение', 'нового'].map((w, i) => (
              <motion.span
                key={w}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className="inline-block mr-[0.28em]"
              >
                {w}
              </motion.span>
            ))}
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="inline-block text-emerald-700"
            >
              поколения
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg text-muted-foreground max-w-[52ch] mx-auto mb-10"
          >
            Nebula — платформа с геймификацией, AI-ассистентом и системой лицензий.
            Общайтесь, зарабатывайте достижения и открывайте новые возможности.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link href="/auth?mode=register">
              <button className="group h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 w-full sm:w-auto">
                Начать бесплатно
                <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-1" />
              </button>
            </Link>
            <button
              onClick={handleDemo}
              className="h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 active:scale-[0.97] transition-all duration-150"
            >
              Посмотреть демо
            </button>
          </motion.div>
        </div>
      </section>

      {/* Hero mockup — scale-in 480ms, delay 300ms, overlap into next section */}
      <section className="px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[1120px] mx-auto translate-y-8 relative z-10"
        >
          <HeroMockup />
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-12 sm:py-20 px-6 pt-24 sm:pt-32">
        <div className="max-w-[1120px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-20% 0px' }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-12 sm:mb-16"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
              Платформа
            </p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-[-0.025em] text-graphite-900 mb-4">
              Почему выбирают Nebula?
            </h2>
            <p className="text-muted-foreground">Все необходимые инструменты в одном приложении</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10% 0px' }}
                transition={{ duration: 0.32, delay: (i % 8) * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-xl border border-border bg-card text-card-foreground shadow-soft p-6 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 group"
              >
                <div className="h-14 w-14 rounded-xl bg-accent grid place-items-center mb-4">
                  <f.icon className="w-8 h-8 text-emerald-600 transition-transform duration-150 group-hover:scale-110" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-border py-12 px-6">
        <div className="max-w-[1120px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-display font-extrabold tracking-[-0.025em] text-graphite-900">
                <StatValue value={s.value} suffix={s.suffix} />
              </div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band — единственная разрешённая тёмная панель как графический элемент */}
      <section className="px-6 my-12 sm:my-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20% 0px' }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[1120px] mx-auto bg-graphite-900 text-white rounded-2xl py-16 px-6 text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-[-0.025em] mb-4">
            Готовы начать?
          </h2>
          <p className="text-graphite-300 max-w-[52ch] mx-auto mb-8">
            Создайте аккаунт за минуту и попробуйте все возможности Nebula.
          </p>
          <Link href="/auth?mode=register">
            <button className="h-12 px-6 inline-flex items-center justify-center gap-2 rounded-lg text-base font-medium bg-emerald-500 text-graphite-950 hover:bg-emerald-400 active:scale-[0.97] transition-all duration-150">
              Создать аккаунт
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10">
        <div className="max-w-[1120px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
            <Logo size="sm" showText />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-3 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors duration-150">Возможности</a>
              <Link href="/contact" className="hover:text-foreground transition-colors duration-150">Contact</Link>
              <Link href="/auth" className="hover:text-foreground transition-colors duration-150">Войти</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors duration-150">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors duration-150">Terms</Link>
              <Link href="/auth?mode=register" className="hover:text-foreground transition-colors duration-150">Регистрация</Link>
            </div>
          </div>
          <p className="text-xs text-graphite-400 font-mono">Nebula © 2026 · Premium Monochrome</p>
        </div>
      </footer>
    </div>
  )
}
