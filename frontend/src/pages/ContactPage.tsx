import React, { useState } from 'react'
import { Link } from 'wouter'
import { ArrowLeft, Clock, HelpCircle, Ban, CreditCard, Users, AlertTriangle, Send } from 'lucide-react'

type Lang = 'ru' | 'en' | 'zh'

const content = {
  ru: {
    eyebrow: 'Поддержка',
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
    eyebrow: 'Support',
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
    eyebrow: '支持',
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
      <nav className="sticky top-0 w-full z-40 bg-background/95 border-b border-border">
        <div className="h-16 max-w-[1120px] mx-auto px-6 flex justify-between items-center">
          <Link href="/welcome">
            <button className="flex items-center gap-2 h-9 px-3 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150">
              <ArrowLeft className="w-4 h-4" />
              <span>Назад</span>
            </button>
          </Link>
          {/* Segmented language control */}
          <div className="inline-flex p-1 rounded-lg bg-secondary gap-1">
            {(['ru', 'en', 'zh'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`h-8 px-3 rounded-md text-xs font-medium transition-all duration-150 ${
                  lang === l ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="py-12 sm:py-20 px-6">
        <div className="max-w-[720px] mx-auto">
          <div className="mb-12 animate-rise-in">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
              {t.eyebrow}
            </p>
            <h1 className="text-4xl font-display font-bold tracking-[-0.025em] text-graphite-900 mb-2 break-words">{t.title}</h1>
            <p className="text-lg text-muted-foreground">{t.subtitle}</p>
          </div>

          <div className="space-y-6">
            <a
              href={t.telegram.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-border bg-card shadow-soft p-6 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 group animate-rise-in [animation-fill-mode:both]"
              style={{ animationDelay: '60ms' }}
            >
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-accent grid place-items-center shrink-0 group-hover:scale-110 transition-transform duration-150">
                  <Send className="w-7 h-7 text-emerald-600" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm text-primary font-medium mb-1">{t.telegram.title}</p>
                  <p className="text-2xl font-display font-bold text-graphite-900">{t.telegram.handle}</p>
                </div>
              </div>
            </a>

            <div
              className="rounded-xl border border-border bg-card shadow-soft p-6 animate-rise-in [animation-fill-mode:both]"
              style={{ animationDelay: '120ms' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
                <p className="text-sm text-muted-foreground">{t.responseTime.title}</p>
              </div>
              <p className="text-xl font-display font-bold text-graphite-900">{t.responseTime.value}</p>
            </div>

            <div
              className="rounded-xl border border-border bg-card shadow-soft p-6 animate-rise-in [animation-fill-mode:both]"
              style={{ animationDelay: '180ms' }}
            >
              <h3 className="text-lg font-semibold text-graphite-900 mb-4">{t.topics.title}</h3>
              <div className="space-y-3">
                {t.topics.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-graphite-700">
                    <item.icon className="w-5 h-5 text-emerald-600 shrink-0" strokeWidth={1.75} />
                    <span className="text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="bg-warning-soft border border-warning/30 rounded-xl p-6 animate-rise-in [animation-fill-mode:both]"
              style={{ animationDelay: '240ms' }}
            >
              <h3 className="text-lg font-semibold mb-3 text-[hsl(32_95%_30%)]">{t.banAppeal.title}</h3>
              <p className="text-sm text-graphite-700 mb-3">{t.banAppeal.description}</p>
              <ul className="space-y-2 mb-4 list-disc pl-5">
                {t.banAppeal.items.map((item, i) => (
                  <li key={i} className="text-sm text-graphite-700">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-xs font-medium text-[hsl(32_95%_30%)]">{t.banAppeal.note}</p>
            </div>

            <div
              className="rounded-xl border border-border bg-card shadow-soft p-6 animate-rise-in [animation-fill-mode:both]"
              style={{ animationDelay: '300ms' }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent grid place-items-center shrink-0">
                  <Users className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.superAdmin.title}</p>
                  <p className="font-semibold text-graphite-900">{t.superAdmin.handle}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12 text-xs text-graphite-400 font-mono">
            {t.footer}
          </div>
        </div>
      </main>
    </div>
  )
}
