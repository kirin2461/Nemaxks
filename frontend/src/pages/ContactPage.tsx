import React, { useState } from 'react'
import { Link } from 'wouter'
import { ArrowLeft, MessageCircle, Clock, HelpCircle, Ban, CreditCard, Users, AlertTriangle, Send } from 'lucide-react'

type Lang = 'ru' | 'en' | 'zh'

const content = {
  ru: {
    title: 'Связаться с нами',
    subtitle: 'Мы всегда готовы помочь',
    telegram: {
      title: 'Telegram (основной канал)',
      handle: '@neMaxks',
      link: 'https://t.me/neMaxks'
    },
    responseTime: {
      title: 'Время ответа',
      value: 'До 48 часов'
    },
    topics: {
      title: 'По каким вопросам обращаться',
      items: [
        { icon: HelpCircle, text: 'Техническая поддержка' },
        { icon: Ban, text: 'Оспаривание бана' },
        { icon: CreditCard, text: 'Возврат средств' },
        { icon: Users, text: 'Сотрудничество' },
        { icon: AlertTriangle, text: 'Жалобы на контент' }
      ]
    },
    banAppeal: {
      title: 'Для оспаривания бана',
      description: 'Напишите в Telegram с указанием:',
      items: [
        'Username заблокированного аккаунта',
        'Причина бана (если известна)',
        'Ваши аргументы'
      ],
      note: 'Срок рассмотрения: до 7 дней'
    },
    superAdmin: {
      title: 'Супер-администратор',
      handle: '@kirin2461'
    },
    footer: '© 2026 Nebula. Все права защищены.'
  },
  en: {
    title: 'Contact Us',
    subtitle: 'We are always ready to help',
    telegram: {
      title: 'Telegram (main channel)',
      handle: '@neMaxks',
      link: 'https://t.me/neMaxks'
    },
    responseTime: {
      title: 'Response Time',
      value: 'Up to 48 hours'
    },
    topics: {
      title: 'What to contact us about',
      items: [
        { icon: HelpCircle, text: 'Technical support' },
        { icon: Ban, text: 'Ban appeal' },
        { icon: CreditCard, text: 'Refunds' },
        { icon: Users, text: 'Partnerships' },
        { icon: AlertTriangle, text: 'Content complaints' }
      ]
    },
    banAppeal: {
      title: 'To appeal a ban',
      description: 'Write to Telegram with:',
      items: [
        'Username of blocked account',
        'Ban reason (if known)',
        'Your arguments'
      ],
      note: 'Review time: up to 7 days'
    },
    superAdmin: {
      title: 'Super Administrator',
      handle: '@kirin2461'
    },
    footer: '© 2026 Nebula. All rights reserved.'
  },
  zh: {
    title: '联系我们',
    subtitle: '我们随时准备提供帮助',
    telegram: {
      title: 'Telegram（主要渠道）',
      handle: '@neMaxks',
      link: 'https://t.me/neMaxks'
    },
    responseTime: {
      title: '响应时间',
      value: '最多48小时'
    },
    topics: {
      title: '联系我们的问题',
      items: [
        { icon: HelpCircle, text: '技术支持' },
        { icon: Ban, text: '封禁申诉' },
        { icon: CreditCard, text: '退款' },
        { icon: Users, text: '合作' },
        { icon: AlertTriangle, text: '内容投诉' }
      ]
    },
    banAppeal: {
      title: '申诉封禁',
      description: '在 Telegram 中写明：',
      items: [
        '被封禁账户的用户名',
        '封禁原因（如已知）',
        '您的论据'
      ],
      note: '审查时间：最多7天'
    },
    superAdmin: {
      title: '超级管理员',
      handle: '@kirin2461'
    },
    footer: '© 2026 Nebula. 保留所有权利。'
  }
}

export default function ContactPage() {
  const [lang, setLang] = useState<Lang>('ru')
  const t = content[lang]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 w-full z-40 bg-card/55 backdrop-blur-xl border-b border-border/60 p-4 shadow-soft">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/welcome">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Назад</span>
            </button>
          </Link>
          <div className="flex gap-2">
            {(['ru', 'en', 'zh'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                  lang === l ? 'gradient-brand text-primary-foreground shadow-glow' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-2 gradient-brand-text">{t.title}</h1>
            <p className="text-muted-foreground">{t.subtitle}</p>
          </div>

          <div className="space-y-6">
            <a 
              href={t.telegram.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block glass rounded-xl shadow-soft p-6 hover:shadow-glow hover:border-primary/40 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 gradient-brand glow rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Send className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-primary mb-1">{t.telegram.title}</p>
                  <p className="text-2xl font-bold">{t.telegram.handle}</p>
                </div>
              </div>
            </a>

            <div className="glass rounded-xl shadow-soft p-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-primary" />
                <p className="text-muted-foreground">{t.responseTime.title}</p>
              </div>
              <p className="text-xl font-semibold">{t.responseTime.value}</p>
            </div>

            <div className="glass rounded-xl shadow-soft p-6">
              <h3 className="text-lg font-semibold mb-4">{t.topics.title}</h3>
              <div className="space-y-3">
                {t.topics.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-foreground/80">
                    <item.icon className="w-5 h-5 text-primary" />
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-500/10 backdrop-blur-xl border border-amber-500/30 rounded-xl shadow-soft p-6">
              <h3 className="text-lg font-semibold mb-3 text-amber-400">{t.banAppeal.title}</h3>
              <p className="text-foreground/80 mb-3">{t.banAppeal.description}</p>
              <ul className="space-y-2 mb-4">
                {t.banAppeal.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-foreground/80">
                    <span className="text-amber-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-amber-400/80">{t.banAppeal.note}</p>
            </div>

            <div className="glass rounded-xl shadow-soft p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.superAdmin.title}</p>
                  <p className="font-semibold">{t.superAdmin.handle}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12 text-muted-foreground">
            {t.footer}
          </div>
        </div>
      </main>
    </div>
  )
}
