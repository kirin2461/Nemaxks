import React from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Shield, Zap, Users, Trophy, Gift, Bot, Gamepad2, ArrowRight, Key, Crown, UserCheck } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { useStore } from '@/lib/store'

const features = [
  {
    icon: <Key className="w-8 h-8 text-amber-400" />,
    title: "Система лицензий",
    description: "Гибкие тарифы: месяц (50₽), квартал (125₽), год (500₽). Уникальные ключи NEMKS-XXXXX-XXXXX-XXXXX."
  },
  {
    icon: <MessageSquare className="w-8 h-8 text-blue-400" />,
    title: "Сообщения и каналы",
    description: "Личные сообщения, групповые чаты, гильдии с каналами, реакции и ответы."
  },
  {
    icon: <Bot className="w-8 h-8 text-cyan-400" />,
    title: "AI-ассистент Jarvis",
    description: "Умный помощник для ответов на вопросы и выполнения задач прямо в чате."
  },
  {
    icon: <Shield className="w-8 h-8 text-red-400" />,
    title: "Безопасность",
    description: "Двухфакторная аутентификация (2FA), QR-вход, шифрование сообщений, антифрод система."
  },
  {
    icon: <Trophy className="w-8 h-8 text-yellow-400" />,
    title: "Геймификация",
    description: "Уровни и XP, достижения, ежедневные награды, испытания, стрики и рейтинги."
  },
  {
    icon: <Gift className="w-8 h-8 text-pink-400" />,
    title: "Магазин и валюта",
    description: "Внутренняя валюта (Coins/Gems), магазин предметов, подарки и обмен между игроками."
  },
  {
    icon: <Gamepad2 className="w-8 h-8 text-green-400" />,
    title: "Мини-игры и квесты",
    description: "Развлекательные мини-игры, цепочки квестов, кланы и соревнования."
  },
  {
    icon: <Crown className="w-8 h-8 text-purple-400" />,
    title: "Super Admin панель",
    description: "Полный контроль платформы: статистика, управление пользователями, безопасность."
  },
  {
    icon: <UserCheck className="w-8 h-8 text-emerald-400" />,
    title: "Модерация",
    description: "Система жалоб, бан пользователей и IP, запрещённые слова, аудит-логи."
  }
]

export default function PresentationPage() {
  const enableDemoMode = useStore((s) => s.enableDemoMode)
  const [, setLocation] = useLocation()

  const handleDemo = () => {
    enableDemoMode()
    setLocation('/')
  }

  return (
    <div className="min-h-screen bg-[#0B0D17] text-white overflow-x-hidden font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 glass-strong border-b border-white/10 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="/nebula-logo.png" alt="Nebula" className="w-10 h-10 rounded-xl object-cover shadow-glow" />
            <span className="text-2xl font-bold gradient-brand-text tracking-tight">
              Nebula
            </span>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <Link href="/auth">
              <button className="px-4 sm:px-6 py-2 rounded-full border border-white/20 hover:bg-white/10 transition-all text-sm sm:text-base whitespace-nowrap">
                Войти
              </button>
            </Link>
            <Link href="/auth?mode=register">
              <button className="px-4 sm:px-6 py-2 rounded-full bg-gradient-brand hover:brightness-110 hover:shadow-glow transition-all shadow-lg shadow-primary/25 text-sm sm:text-base whitespace-nowrap">
                <span className="hidden sm:inline">Присоединиться</span>
                <span className="sm:hidden">Join</span>
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#7C5CFF]/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#22D3EE]/15 rounded-full blur-[120px] animate-pulse delay-700" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="flex justify-center mb-8"
          >
            <img
              src="/nebula-logo.png"
              alt="Nebula"
              className="w-24 h-24 md:w-32 md:h-32 rounded-3xl object-cover shadow-glow"
            />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-8xl font-bold mb-6 leading-tight"
          >
            Общение нового <br /> 
            <span className="gradient-brand-text">
              поколения
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto"
          >
            Nebula — платформа с геймификацией, AI-ассистентом и системой лицензий. 
            Общайтесь, зарабатывайте достижения и открывайте новые возможности.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col md:flex-row gap-4 justify-center"
          >
            <Link href="/auth?mode=register">
              <button className="px-10 py-4 bg-gradient-brand rounded-2xl text-lg font-bold hover:scale-105 hover:shadow-glow transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-2 group">
                Начать бесплатно
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <button
              onClick={handleDemo}
              className="px-10 py-4 bg-white/5 rounded-2xl text-lg font-bold hover:bg-white/10 transition-all border border-white/10"
            >
              Посмотреть демо
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Почему выбирают Nebula?</h2>
            <p className="text-gray-400">Все необходимые инструменты в одном приложении</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass p-8 rounded-3xl hover:border-white/20 transition-all hover:-translate-y-1 group"
              >
                <div className="mb-4 group-hover:scale-110 transition-transform">{f.icon}</div>
                <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                <p className="text-gray-400 leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="py-10 border-t border-white/10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <img src="/nebula-logo.png" alt="Nebula" className="w-6 h-6 rounded-lg object-cover" />
            <span className="font-bold">Nebula © 2026</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
