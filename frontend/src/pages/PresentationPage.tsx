import React from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Shield, Zap, Users, Globe, Video, Mic, Star, ArrowRight } from 'lucide-react'
import { Link } from 'wouter'

const features = [
  {
    icon: <MessageSquare className="w-8 h-8 text-blue-400" />,
    title: "Real-time Messaging",
    description: "Instant messaging with rich media support, reactions, and threaded replies."
  },
  {
    icon: <Video className="w-8 h-8 text-purple-400" />,
    title: "Voice & Video Calls",
    description: "High-quality, low-latency communication with screen sharing and noise suppression."
  },
  {
    icon: <Users className="w-8 h-8 text-green-400" />,
    title: "Nemaks Общий",
    description: "Join our global community from day one. Everyone is invited to the conversation."
  },
  {
    icon: <Shield className="w-8 h-8 text-red-400" />,
    title: "Advanced Security",
    description: "QR login, end-to-end encryption principles, and robust moderation tools."
  },
  {
    icon: <Star className="w-8 h-8 text-yellow-400" />,
    title: "Content & Stories",
    description: "Share your moments with 24-hour stories and rate posts with our 5-star system."
  },
  {
    icon: <Zap className="w-8 h-8 text-cyan-400" />,
    title: "AI Assistant (Jarvis)",
    description: "Your personal cosmic assistant to help manage tasks and answer questions."
  }
]

export default function PresentationPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white overflow-x-hidden font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-black/50 backdrop-blur-md border-b border-white/10 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-cosmic-rainbow-animated flex items-center justify-center orb-glow">
              <span className="text-xl font-bold">N</span>
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
              Nemaks
            </span>
          </div>
          <div className="flex gap-4">
            <Link href="/login">
              <button className="px-6 py-2 rounded-full border border-white/20 hover:bg-white/10 transition-all">
                Войти
              </button>
            </Link>
            <Link href="/register">
              <button className="px-6 py-2 rounded-full bg-primary hover:bg-primary/80 transition-all shadow-lg shadow-primary/20">
                Присоединиться
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-700" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-8xl font-bold mb-6 leading-tight"
          >
            Общение нового <br /> 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
              поколения
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto"
          >
            Nemaks — это не просто мессенджер. Это целая вселенная для общения, 
            стриминга и творчества. Присоединяйтесь к тысячам пользователей уже сегодня.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col md:flex-row gap-4 justify-center"
          >
            <Link href="/register">
              <button className="px-10 py-4 bg-primary rounded-2xl text-lg font-bold hover:scale-105 transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-2 group">
                Начать бесплатно
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/login">
              <button className="px-10 py-4 bg-white/5 rounded-2xl text-lg font-bold hover:bg-white/10 transition-all border border-white/10">
                Посмотреть демо
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Почему выбирают Nemaks?</h2>
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
                className="p-8 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all hover:bg-white/[0.05] group"
              >
                <div className="mb-4 group-hover:scale-110 transition-transform">{f.icon}</div>
                <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                <p className="text-gray-400 leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-blue-400 mb-2">10k+</div>
            <div className="text-gray-400 uppercase tracking-widest text-xs">Пользователей</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-purple-400 mb-2">1M+</div>
            <div className="text-gray-400 uppercase tracking-widest text-xs">Сообщений/день</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-green-400 mb-2">24/7</div>
            <div className="text-gray-400 uppercase tracking-widest text-xs">Онлайн</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-yellow-400 mb-2">99.9%</div>
            <div className="text-gray-400 uppercase tracking-widest text-xs">Аптайм</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-white/10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-6 h-6 rounded-lg gradient-cosmic-rainbow-animated" />
            <span className="font-bold">Nemaks © 2026</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
