import React, { useState, useEffect } from 'react'
import { Link } from 'wouter'
import { ArrowLeft, Shield, Ban, CreditCard, Scale, AlertTriangle, Bot, Users, Bell, Gavel, FileText } from 'lucide-react'

type Lang = 'ru' | 'en' | 'zh'

const content = {
  ru: {
    title: 'Правила использования',
    subtitle: 'Платформа Nebula',
    version: 'Версия: 1.0',
    effectiveDate: 'Дата вступления в силу: 01 февраля 2026 г.',
    sections: [
      {
        icon: Shield,
        title: '1. Общие положения',
        content: `1.1. Настоящие Правила регулируют использование платформы Nebula (далее — «Платформа»).

1.2. Оператор платформы: Самозанятый Умаров Курбанбек.

1.3. Регистрируясь на Платформе, вы подтверждаете:
• Достижение возраста 16 лет
• Полное согласие с настоящими Правилами
• Согласие с Политикой конфиденциальности

1.4. Один пользователь может иметь только один активный аккаунт.`
      },
      {
        icon: Ban,
        title: '2. Правила поведения',
        content: `2.1. ЗАПРЕЩЕНО размещать и распространять:

⛔ NSFW контент без активированного тумблера NSFW
   • В каналах с NSFW-режимом разрешён контент 18+
   • Без тумблера NSFW такой контент запрещён везде

⛔ Насилие и угрозы
   • Угрозы физической расправы
   • Призывы к насилию
   • Буллинг и травля пользователей

⛔ Разжигание ненависти
   • Расизм, национализм
   • Дискриминация по любым признакам
   • Экстремистские материалы

⛔ Пиратство, мошенничество, имперсонация, спам, вредоносное ПО

2.2. РАЗРЕШЕНО:
✅ Свободное общение в рамках правил
✅ NSFW контент в специальных каналах с тумблером
✅ Коммерческие проекты (без спама)
✅ Обсуждение политики (без разжигания ненависти)`
      },
      {
        icon: Gavel,
        title: '3. Система наказаний',
        content: `3.1. Предупреждение (Warning)
📌 За первое незначительное нарушение
📌 При 3 предупреждениях → временный бан

3.2. Временный бан (от 1 часа до 30 дней)
📌 Повторные нарушения, NSFW без тумблера, спам, буллинг

3.3. Перманентный бан (СРАЗУ)
📌 Имперсонация, фишинг, мошенничество
📌 Детская порнография, угрозы жизни
📌 Распространение вредоносного ПО

3.4. Оспаривание бана
📧 Напишите в Telegram: https://t.me/neMaxks
📧 Супер-администратор: @kirin2461
⏱ Срок рассмотрения: до 7 дней

⚠️ Перманентные баны за имперсонацию НЕ снимаются`
      },
      {
        icon: CreditCard,
        title: '4. Платные услуги и подписки',
        content: `4.1. Тарифные планы:
💳 Месяц: 50₽
💳 Квартал: 125₽ (-17%)
💳 Год: 500₽

4.2. Преимущества подписки:
• Уникальные ключи лицензий
• Расширенные функции
• Приоритетная поддержка

4.3. Автоматическое продление:
• Подписка продлевается автоматически
• Отмена в любое время до следующего списания
• Уведомление за 3 дня до списания

4.4. Возврат средств:
✅ При технических проблемах со стороны платформы
✅ Если услуги не были предоставлены полностью
✅ В первые 14 дней с момента покупки

❌ При бане за нарушения правил
❌ После 30 дней с момента покупки

📋 Заявка через Telegram: https://t.me/neMaxks`
      },
      {
        icon: FileText,
        title: '5. Интеллектуальная собственность',
        content: `5.1. Контент пользователей:
• Права на контент принадлежат пользователям
• Nebula получает неисключительную лицензию на отображение
• При удалении аккаунта контент удаляется

5.2. Контент платформы:
• Логотип, дизайн, код являются собственностью Nebula
• Копирование без разрешения запрещено`
      },
      {
        icon: AlertTriangle,
        title: '6. Ограничение ответственности',
        content: `6.1. Nebula НЕ несёт ответственности за:
❌ Контент пользователей
❌ Технические сбои и простои
❌ Действия третьих лиц (YooKassa, LiveKit)

6.2. Рекомендации по безопасности:
✅ Используйте сложные пароли
✅ Включите 2FA
✅ Создавайте резервные копии`
      },
      {
        icon: Bot,
        title: '7. AI-ассистент Jarvis',
        content: `7.1. Jarvis — AI-помощник. Ограничения:
• Информация носит справочный характер
• Не является профессиональной консультацией
• Может содержать неточности

7.2. Пользователь несёт ответственность за:
• Решения на основе советов Jarvis
• Использование сгенерированного контента
• Проверку достоверности информации

7.3. Запрещено использовать Jarvis для:
• Генерации вредоносного кода
• Создания контента, нарушающего правила`
      },
      {
        icon: Users,
        title: '8. Модерация',
        content: `8.1. Автоматическая модерация:
• Антифрод система
• Фильтр запрещённого контента
• Блокировка спама

8.2. Ручная модерация:
• Срок рассмотрения жалоб: до 48 часов
• Решение можно обжаловать у супер-администратора

8.3. Подача жалобы:
1. Кнопка «Пожаловаться» в интерфейсе
2. Или Telegram: https://t.me/neMaxks`
      },
      {
        icon: Bell,
        title: '9. Изменения правил',
        content: `9.1. Оператор вправе изменять настоящие Правила.

9.2. Уведомление об изменениях:
• Публикуется за 14 дней до вступления в силу
• Отправляется в виде уведомления на платформе
• Публикуется в Telegram-канале @neMaxks

9.3. Продолжение использования = согласие с новой версией.`
      },
      {
        icon: Scale,
        title: '10. Заключительные положения',
        content: `10.1. Применимое право: законодательство Российской Федерации.

10.2. Споры разрешаются путём переговоров. При невозможности — в суде.

10.3. Недействительность отдельных положений не влияет на действительность остальных.

Контакты:
Telegram: https://t.me/neMaxks
Супер-администратор: @kirin2461
Срок ответа: до 48 часов`
      }
    ],
    footer: '© 2026 Nebula. Все права защищены.'
  },
  en: {
    title: 'Terms of Service',
    subtitle: 'Nebula Platform',
    version: 'Version: 1.0',
    effectiveDate: 'Effective Date: February 01, 2026',
    sections: [
      {
        icon: Shield,
        title: '1. General Provisions',
        content: `1.1. These Terms govern the use of Nebula platform (hereinafter — "Platform").

1.2. Platform Operator: Self-employed Umarov Kurbanbek.

1.3. By registering on the Platform, you confirm:
• You are at least 16 years old
• Full acceptance of these Terms
• Acceptance of the Privacy Policy

1.4. One user may have only one active account.`
      },
      {
        icon: Ban,
        title: '2. Code of Conduct',
        content: `2.1. PROHIBITED content and actions:

⛔ NSFW content without activated NSFW toggle
   • In channels with NSFW mode, 18+ content is allowed
   • Without NSFW toggle such content is prohibited

⛔ Violence and threats
   • Threats of physical harm
   • Incitement to violence
   • Bullying and harassment

⛔ Hate speech, racism, nationalism, discrimination

⛔ Piracy, fraud, impersonation, spam, malware

2.2. ALLOWED:
✅ Free communication within the rules
✅ NSFW content in special channels with toggle
✅ Commercial projects (without spam)
✅ Political discussions (without hate speech)`
      },
      {
        icon: Gavel,
        title: '3. Punishment System',
        content: `3.1. Warning
📌 First minor violation
📌 3 warnings → temporary ban

3.2. Temporary Ban (1 hour to 30 days)
📌 Repeated violations, NSFW without toggle, spam, bullying

3.3. Permanent Ban (IMMEDIATELY)
📌 Impersonation, phishing, fraud
📌 Child pornography, threats to life
📌 Malware distribution

3.4. Appealing a Ban
📧 Write to Telegram: https://t.me/neMaxks
📧 Super-admin: @kirin2461
⏱ Review time: up to 7 days

⚠️ Permanent bans for impersonation are NOT lifted`
      },
      {
        icon: CreditCard,
        title: '4. Paid Services and Subscriptions',
        content: `4.1. Pricing plans:
💳 Monthly: 50₽
💳 Quarterly: 125₽ (-17%)
💳 Yearly: 500₽

4.2. Subscription benefits:
• Unique license keys
• Extended features
• Priority support

4.3. Auto-renewal:
• Subscription renews automatically
• Cancel anytime before next charge
• Notification 3 days before charge

4.4. Refunds:
✅ Technical issues on Platform's side
✅ Non-use of services (proportional)
✅ Within first 14 days

❌ If banned for violations
❌ After 30 days from purchase

📋 Request via Telegram: https://t.me/neMaxks`
      },
      {
        icon: FileText,
        title: '5. Intellectual Property',
        content: `5.1. User content:
• Rights belong to users
• Nebula receives non-exclusive license to display
• Content deleted upon account deletion

5.2. Platform content:
• Logo, design, code are Nebula property
• Copying without permission is prohibited`
      },
      {
        icon: AlertTriangle,
        title: '6. Limitation of Liability',
        content: `6.1. Nebula is NOT responsible for:
❌ User content
❌ Technical failures and downtime
❌ Third party actions (YooKassa, LiveKit)

6.2. Security recommendations:
✅ Use strong passwords
✅ Enable 2FA
✅ Backup important data`
      },
      {
        icon: Bot,
        title: '7. AI Assistant Jarvis',
        content: `7.1. Jarvis is an AI assistant. Limitations:
• Information is for reference only
• Not professional advice
• May contain inaccuracies

7.2. User is responsible for:
• Decisions based on Jarvis advice
• Use of generated content
• Verifying information accuracy

7.3. Prohibited to use Jarvis for:
• Generating malicious code
• Creating content that violates rules`
      },
      {
        icon: Users,
        title: '8. Moderation',
        content: `8.1. Automatic moderation:
• Anti-fraud system
• Prohibited content filter
• Spam blocking

8.2. Manual moderation:
• Complaint review time: up to 48 hours
• Decisions can be appealed to super-admin

8.3. Filing a complaint:
1. "Report" button in the interface
2. Or Telegram: https://t.me/neMaxks`
      },
      {
        icon: Bell,
        title: '9. Terms Changes',
        content: `9.1. The Operator reserves the right to change these Terms.

9.2. Change notifications:
• Published 14 days before taking effect
• Sent as platform notification
• Published in @neMaxks Telegram channel

9.3. Continued use = acceptance of new version.`
      },
      {
        icon: Scale,
        title: '10. Final Provisions',
        content: `10.1. Applicable law: Russian Federation legislation.

10.2. Disputes are resolved through negotiation. If impossible — in court.

10.3. Invalidity of individual provisions does not affect the validity of others.

Contacts:
Telegram: https://t.me/neMaxks
Super-admin: @kirin2461
Response time: up to 48 hours`
      }
    ],
    footer: '© 2026 Nebula. All rights reserved.'
  },
  zh: {
    title: '服务条款',
    subtitle: 'Nebula 平台',
    version: '版本：1.0',
    effectiveDate: '生效日期：2026年2月1日',
    sections: [
      {
        icon: Shield,
        title: '1. 一般规定',
        content: `1.1. 本条款规范 Nebula 平台（以下简称"平台"）的使用。

1.2. 平台运营商：自雇人士 Umarov Kurbanbek。

1.3. 注册平台即表示您确认：
• 已年满16周岁
• 完全接受本条款
• 接受隐私政策

1.4. 一个用户只能拥有一个活跃账户。`
      },
      {
        icon: Ban,
        title: '2. 行为准则',
        content: `2.1. 禁止的内容和行为：

⛔ 未激活 NSFW 开关的 NSFW 内容
⛔ 暴力和威胁
⛔ 仇恨言论、种族主义、歧视
⛔ 盗版、欺诈、冒充、垃圾信息、恶意软件

2.2. 允许：
✅ 遵守规则的自由交流
✅ 特殊频道中带开关的 NSFW 内容
✅ 商业项目（无垃圾信息）
✅ 政治讨论（无仇恨言论）`
      },
      {
        icon: Gavel,
        title: '3. 处罚系统',
        content: `3.1. 警告
📌 首次轻微违规
📌 3次警告 → 临时封禁

3.2. 临时封禁（1小时至30天）
📌 重复违规、无开关的 NSFW、垃圾信息、欺凌

3.3. 永久封禁（立即）
📌 冒充、钓鱼、欺诈
📌 儿童色情、生命威胁
📌 恶意软件分发

3.4. 申诉
📧 Telegram: https://t.me/neMaxks
⏱ 审查时间：最多7天`
      },
      {
        icon: CreditCard,
        title: '4. 付费服务和订阅',
        content: `4.1. 价格计划：
💳 月付：50₽
💳 季付：125₽ (-17%)
💳 年付：500₽

4.2. 订阅优势：
• 独特的许可证密钥
• 扩展功能
• 优先支持

4.3. 自动续订：
• 订阅自动续订
• 在下次扣款前随时取消

4.4. 退款：
✅ 平台技术问题
✅ 未使用（按比例）
✅ 前14天内

❌ 因违规被封禁
❌ 购买后超过30天`
      },
      {
        icon: FileText,
        title: '5. 知识产权',
        content: `5.1. 用户内容：
• 权利归用户所有
• Nebula 获得非独占展示许可
• 删除账户时删除内容

5.2. 平台内容：
• 标志、设计、代码归 Nebula 所有
• 禁止未经许可复制`
      },
      {
        icon: AlertTriangle,
        title: '6. 责任限制',
        content: `6.1. Nebula 不对以下内容负责：
❌ 用户内容
❌ 技术故障和停机
❌ 第三方行为

6.2. 安全建议：
✅ 使用强密码
✅ 启用 2FA
✅ 备份重要数据`
      },
      {
        icon: Bot,
        title: '7. AI 助手 Jarvis',
        content: `7.1. Jarvis 是 AI 助手。限制：
• 信息仅供参考
• 非专业建议
• 可能包含不准确之处

7.2. 用户对以下内容负责：
• 基于 Jarvis 建议的决定
• 生成内容的使用
• 验证信息准确性`
      },
      {
        icon: Users,
        title: '8. 审核',
        content: `8.1. 自动审核：
• 反欺诈系统
• 禁止内容过滤
• 垃圾信息拦截

8.2. 人工审核：
• 投诉审查时间：最多48小时

8.3. 提交投诉：
1. 界面中的"举报"按钮
2. 或 Telegram: https://t.me/neMaxks`
      },
      {
        icon: Bell,
        title: '9. 条款变更',
        content: `9.1. 运营商保留更改本条款的权利。

9.2. 变更通知：
• 在生效前14天发布
• 作为平台通知发送

9.3. 继续使用 = 接受新版本。`
      },
      {
        icon: Scale,
        title: '10. 最终条款',
        content: `10.1. 适用法律：俄罗斯联邦法律。

10.2. 争议通过协商解决。如无法解决 — 在法院解决。

联系方式：
Telegram: https://t.me/neMaxks
响应时间：最多48小时`
      }
    ],
    footer: '© 2026 Nebula. 保留所有权利。'
  }
}

export default function TermsPage() {
  const [lang, setLang] = useState<Lang>('ru')
  const [activeSection, setActiveSection] = useState(0)
  const t = content[lang]

  // Scroll-spy для sticky TOC (auth-landing.md §4)
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-legal-section]'))
    if (!sections.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(Number(entry.target.getAttribute('data-legal-section')))
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [lang])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 w-full z-40 bg-background/95 border-b border-border">
        <div className="h-16 max-w-[1120px] mx-auto px-3 sm:px-6 flex justify-between items-center gap-2">
          <Link href="/welcome">
            <button className="flex items-center gap-1 sm:gap-2 h-9 px-2 sm:px-3 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150 flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
              <span>Назад</span>
            </button>
          </Link>
          <div className="inline-flex p-1 rounded-lg bg-secondary gap-1">
            {(['ru', 'en', 'zh'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`h-8 px-2 sm:px-3 rounded-md text-xs font-medium transition-all duration-150 ${
                  lang === l ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="py-12 px-3 sm:px-6">
        <div className="max-w-[1120px] mx-auto flex justify-center gap-12">
          <div className="max-w-[720px] w-full min-w-0 animate-rise-in">
            <div className="mb-8 sm:mb-12">
              <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-[-0.025em] text-graphite-900 mb-2">{t.title}</h1>
              <p className="text-muted-foreground">{t.subtitle}</p>
              <p className="text-sm text-graphite-400 mt-2">{t.version} | {t.effectiveDate}</p>
            </div>

            <div className="space-y-6 sm:space-y-8">
              {t.sections.map((section, i) => (
                <div
                  key={i}
                  id={`terms-section-${i}`}
                  data-legal-section={i}
                  className="rounded-xl border border-border bg-card shadow-soft p-4 sm:p-6 scroll-mt-24"
                >
                  <div className="flex items-center gap-2 sm:gap-3 mb-3">
                    <section.icon className="w-5 h-5 text-emerald-600 flex-shrink-0" strokeWidth={1.75} />
                    <h2 className="text-xl font-semibold text-graphite-900">{section.title}</h2>
                  </div>
                  <div className="text-[15px] leading-7 text-graphite-700 whitespace-pre-line">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-12 text-xs text-graphite-400 font-mono">
              {t.footer}
            </div>
          </div>

          {/* Sticky mini TOC */}
          <aside className="hidden xl:block w-56 shrink-0">
            <div className="sticky top-24">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
                {t.title}
              </p>
              <nav className="space-y-0.5">
                {t.sections.map((section, i) => (
                  <a
                    key={i}
                    href={`#terms-section-${i}`}
                    className={`block text-sm py-1 transition-colors duration-150 ${
                      activeSection === i
                        ? 'text-primary font-medium border-l-2 border-primary pl-3'
                        : 'text-muted-foreground hover:text-foreground border-l-2 border-transparent pl-3'
                    }`}
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
