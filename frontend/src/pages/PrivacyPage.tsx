import React, { useState } from 'react'
import { Link } from 'wouter'
import { ArrowLeft, Shield, Lock, Database, Bot, Clock, Users, Cookie, Key, Bell, MessageSquare } from 'lucide-react'

type Lang = 'ru' | 'en' | 'zh'

const content = {
  ru: {
    title: 'Политика конфиденциальности',
    subtitle: 'Платформа Nemaks',
    version: 'Версия: 1.0',
    effectiveDate: 'Дата вступления в силу: 01 февраля 2026 г.',
    sections: [
      {
        icon: Shield,
        title: '1. Общие положения',
        content: `1.1. Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей платформы Nemaks (далее — «Платформа»).

1.2. Оператор персональных данных: Умаров Курбанбек Одашбаевич, Московская область, г. Видное, р.п. Бутово Парк, д. 15, кв. 245.
Контакты для вопросов по персональным данным:
• Email: kurbanu87@gmail.com
• Телефон: +79691021441

1.3. Платформа предназначена для лиц, достигших 18 лет. Регистрируясь, вы подтверждаете достижение указанного возраста.

1.4. Используя Платформу, пользователь подтверждает своё согласие с условиями настоящей Политики. Согласие на обработку персональных данных, включая трансграничную передачу персональных данных на серверы в США (Replit), даётся пользователем при регистрации путём проставления отметки в чекбоксе.`
      },
      {
        icon: Database,
        title: '2. Собираемые данные',
        content: `2.1. Обязательные данные:
• Имя пользователя (username)
• Пароль (хранится в зашифрованном виде bcrypt)

2.2. Автоматически собираемые данные:
• IP-адрес
• User-Agent (тип браузера и устройства)
• Цифровой отпечаток устройства (для безопасности)

2.3. Опциональные данные:
• Данные двухфакторной аутентификации (2FA)
• Аватар профиля
• Биография (до 500 символов)

2.4. Платёжные данные:
• Обрабатываются платёжной системой YooKassa
• Nemaks хранит только ID транзакции и статус платежа
• Данные банковских карт НЕ хранятся на серверах Nemaks`
      },
      {
        icon: Lock,
        title: '3. Шифрование сообщений',
        content: `3.1. Личные сообщения защищены сквозным шифрованием (E2E) по алгоритму X25519-XSalsa20-Poly1305.

3.2. При E2E шифровании сервер Nemaks НЕ имеет технической возможности прочитать содержимое сообщений.

3.3. Групповые каналы поддерживают опциональное E2E шифрование по выбору администратора канала.`
      },
      {
        icon: Bot,
        title: '4. AI-ассистент Jarvis',
        content: `4.1. Переписка с AI-ассистентом Jarvis НЕ защищена сквозным шифрованием.

4.2. Данные чатов с Jarvis могут использоваться для улучшения качества ответов.

4.3. Используя Jarvis, вы даёте согласие на обработку данных переписки.

4.4. Не передавайте Jarvis конфиденциальную информацию (пароли, финансовые данные).`
      },
      {
        icon: Clock,
        title: '5. Сроки хранения данных',
        content: `5.1. Данные активных аккаунтов хранятся в течение всего периода использования.

5.2. Сроки хранения:
• Аудит-логи безопасности: 45 дней (автоматическая очистка)
• Данные при подозрении в мошенничестве: до 90 дней для расследования
• После удаления аккаунта: данные аккаунта и связанные с ним персональные данные хранятся до 90 дней, после чего подлежат безвозвратному удалению (в том числе для пользователей с подпиской)`
      },
      {
        icon: Users,
        title: '6. Передача данных третьим лицам',
        content: `6.1. Nemaks передаёт данные следующим партнёрам:
• YooKassa — для обработки платежей (Россия)
• LiveKit — для голосовых и видеозвонков
• Replit Inc. — хостинг и базы данных (США)

6.2. ТРАНСГРАНИЧНАЯ ПЕРЕДАЧА: Данные хранятся на серверах Replit Inc. (США). Регистрируясь, вы даёте согласие на передачу данных в США в соответствии с ФЗ-152 «О персональных данных».

6.3. Nemaks НЕ продаёт персональные данные третьим лицам.

6.4. Данные могут быть предоставлены правоохранительным органам по официальному запросу в соответствии с законодательством РФ.`
      },
      {
        icon: Database,
        title: '7. Данные, которые НЕ собираются',
        content: `Nemaks НЕ собирает и НЕ обрабатывает:
• Геолокацию (GPS-координаты)
• Контакты из телефонной книги
• Данные других приложений
• Содержимое зашифрованных сообщений (E2E)
• Биометрические данные
• Данные о здоровье`
      },
      {
        icon: Key,
        title: '8. Права пользователя',
        content: `8.1. Вы имеете право:
• Запросить доступ к своим данным
• Запросить исправление неточных данных
• Запросить удаление своих данных
• Запросить экспорт своих данных
• Отозвать согласие на обработку данных

8.2. Для реализации прав обратитесь: https://t.me/neMaxks
Срок рассмотрения запросов: до 10 рабочих дней.

8.3. При отзыве согласия на обработку персональных данных аккаунт пользователя подлежит блокировке, а персональные данные удаляются в сроки, предусмотренные пунктом 5.2 настоящей Политики, за исключением случаев, когда их дальнейшее хранение обязательно по закону (налоговая/бухгалтерская отчётность, расследование инцидентов и т.д.).`
      },
      {
        icon: Cookie,
        title: '9. Cookies и технологии',
        content: `9.1. Nemaks использует сессионные cookies для поддержания авторизации.

9.2. Сторонние рекламные и аналитические трекеры НЕ используются.`
      },
      {
        icon: Shield,
        title: '10. Безопасность',
        content: `10.1. Пароли хранятся с использованием bcrypt хэширования.

10.2. Все соединения защищены протоколом HTTPS/TLS.

10.3. Реализована защита от brute-force атак (блокировка после 5 неудачных попыток на 15 минут).

10.4. Работает автоматическая система обнаружения мошенничества.

10.5. Личные сообщения защищены сквозным шифрованием (E2E) по алгоритму X25519-XSalsa20-Poly1305.

10.6. Шифрование данных в покое: данные Платформы хранятся на серверах провайдера Replit (США), который обеспечивает защиту инфраструктуры, включая технические меры по защите данных в дата-центрах. Дополнительное прикладное шифрование базы данных Оператором не используется.

10.7. Регулярные аудиты безопасности: специализированные внешние аудиты и penetration-testing не проводятся. Оператор по мере необходимости осуществляет внутренний пересмотр настроек безопасности и обрабатывает инциденты информационной безопасности.`
      },
      {
        icon: Bell,
        title: '11. Изменения политики',
        content: `11.1. Оператор вправе вносить изменения в настоящую Политику.

11.2. Уведомление об изменениях: публикация обновлённой редакции Политики в боте Nemaks за 7 дней до вступления изменений в силу, а также направление уведомления пользователям через Платформу (push-уведомление) и/или по email (если указан).

11.3. Продолжение использования платформы означает согласие с обновлённой Политикой.`
      },
      {
        icon: Shield,
        title: '12. Обработка инцидентов',
        content: `12.1. При обнаружении утечки данных:
• Уведомление пользователей — в течение 72 часов
• Уведомление регулятора (Роскомнадзор) — по требованию закона

12.2. Пострадавшие пользователи получат:
• Описание инцидента
• Перечень затронутых данных
• Рекомендации по защите`
      },
      {
        icon: MessageSquare,
        title: '13. Контакты',
        content: `По вопросам конфиденциальности обращайтесь:
• Email: kurbanu87@gmail.com
• Телефон: +79691021441
• Telegram: https://t.me/neMaxks

Сроки ответа:
• Общие вопросы: до 48 часов
• Запросы по правам (экспорт, удаление): до 10 рабочих дней

Оператор зарегистрирован в реестре операторов персональных данных Роскомнадзора. Регистрационный номер: 100135010, регистрационный ключ: 15463569.`
      }
    ],
    footer: '© 2026 Nemaks. Все права защищены.'
  },
  en: {
    title: 'Privacy Policy',
    subtitle: 'Nemaks Platform',
    version: 'Version: 1.0',
    effectiveDate: 'Effective Date: February 01, 2026',
    sections: [
      {
        icon: Shield,
        title: '1. General Provisions',
        content: `1.1. This Privacy Policy defines the procedure for processing and protecting personal data of Nemaks platform users (hereinafter — "Platform").

1.2. Data Controller: Umarov Kurbanbek Odashbaevich, Moscow Region, Vidnoye, Butovo Park, bld. 15, apt. 245.
Contact for personal data inquiries:
• Email: kurbanu87@gmail.com
• Phone: +79691021441

1.3. The platform is intended for persons who have reached 18 years of age. By registering, you confirm that you have reached this age.

1.4. By using the Platform, the user confirms their agreement to the terms of this Policy. Consent to personal data processing, including cross-border transfer to servers in the USA (Replit), is given by the user during registration by checking the checkbox.`
      },
      {
        icon: Database,
        title: '2. Data We Collect',
        content: `2.1. Required data:
• Username
• Password (stored encrypted with bcrypt)

2.2. Automatically collected data:
• IP address
• User-Agent (browser and device type)
• Device fingerprint (for security)

2.3. Optional data:
• Two-factor authentication (2FA) data
• Profile avatar
• Biography (up to 500 characters)

2.4. Payment data:
• Processed by YooKassa payment system
• Nemaks only stores transaction ID and payment status
• Bank card data is NOT stored on Nemaks servers`
      },
      {
        icon: Lock,
        title: '3. Message Encryption',
        content: `3.1. Direct messages are protected by end-to-end encryption (E2E) using X25519-XSalsa20-Poly1305 algorithm.

3.2. With E2E encryption, Nemaks server has NO technical ability to read message content.

3.3. Group channels support optional E2E encryption at channel administrator's choice.`
      },
      {
        icon: Bot,
        title: '4. AI Assistant Jarvis',
        content: `4.1. Conversations with AI assistant Jarvis are NOT protected by end-to-end encryption.

4.2. Jarvis chat data may be used to improve response quality.

4.3. By using Jarvis, you consent to processing of conversation data.

4.4. Do not share confidential information with Jarvis (passwords, financial data).`
      },
      {
        icon: Clock,
        title: '5. Data Retention Periods',
        content: `5.1. Active account data is stored throughout the usage period.

5.2. Retention periods:
• Security audit logs: 45 days (automatic cleanup)
• Data in case of suspected fraud: up to 90 days for investigation
• After account deletion: account data and related personal data is stored for up to 90 days, after which it is permanently deleted (including for subscribers)`
      },
      {
        icon: Users,
        title: '6. Data Sharing with Third Parties',
        content: `6.1. Nemaks shares data with the following partners:
• YooKassa — for payment processing (Russia)
• LiveKit — for voice and video calls
• Replit Inc. — hosting and databases (USA)

6.2. CROSS-BORDER TRANSFER: Data is stored on Replit Inc. servers (USA). By registering, you consent to data transfer to the USA.

6.3. Nemaks does NOT sell personal data to third parties.

6.4. Data may be provided to law enforcement upon official request in accordance with applicable legislation.`
      },
      {
        icon: Database,
        title: '7. Data We Do NOT Collect',
        content: `Nemaks does NOT collect or process:
• Geolocation (GPS coordinates)
• Contacts from your phone book
• Data from other applications
• Content of encrypted messages (E2E)
• Biometric data
• Health data`
      },
      {
        icon: Key,
        title: '8. User Rights',
        content: `8.1. You have the right to:
• Request access to your data
• Request correction of inaccurate data
• Request deletion of your data
• Request export of your data
• Withdraw consent to data processing

8.2. To exercise your rights, contact: https://t.me/neMaxks
Request processing time: up to 10 business days.

8.3. Upon withdrawal of consent to personal data processing, the user's account will be blocked, and personal data will be deleted within the timeframes specified in section 5.2 of this Policy, except where further storage is required by law (tax/accounting reporting, incident investigation, etc.).`
      },
      {
        icon: Cookie,
        title: '9. Cookies and Technologies',
        content: `9.1. Nemaks uses session cookies to maintain authorization.

9.2. Third-party advertising and analytics trackers are NOT used.`
      },
      {
        icon: Shield,
        title: '10. Security',
        content: `10.1. Passwords are stored using bcrypt hashing.

10.2. All connections are protected by HTTPS/TLS protocol.

10.3. Brute-force protection is implemented (blocking after 5 failed attempts for 15 minutes).

10.4. Automatic fraud detection system is active.

10.5. Direct messages are protected by end-to-end encryption (E2E) using X25519-XSalsa20-Poly1305 algorithm.

10.6. Encryption at rest: Platform data is stored on Replit provider servers (USA), which provides infrastructure protection including technical data protection measures in data centers. Additional application-level database encryption is not used by the Operator.

10.7. Regular security audits: Specialized external audits and penetration testing are not conducted. The Operator periodically reviews security settings as needed and handles information security incidents.`
      },
      {
        icon: Bell,
        title: '11. Policy Changes',
        content: `11.1. The Operator reserves the right to make changes to this Policy.

11.2. Change notifications: Publication of the updated Policy in Nemaks bot 7 days before changes take effect, as well as sending notifications to users via the Platform (push notification) and/or by email (if provided).

11.3. Continued use of the platform means acceptance of the updated Policy.`
      },
      {
        icon: Shield,
        title: '12. Incident Handling',
        content: `12.1. Upon discovering a data breach:
• User notification — within 72 hours
• Regulator notification — as required by law

12.2. Affected users will receive:
• Incident description
• List of affected data
• Protection recommendations`
      },
      {
        icon: MessageSquare,
        title: '13. Contacts',
        content: `For privacy questions, contact:
• Email: kurbanu87@gmail.com
• Phone: +79691021441
• Telegram: https://t.me/neMaxks

Response times:
• General questions: up to 48 hours
• Rights requests (export, deletion): up to 10 business days

The Operator is registered in the Roskomnadzor personal data operators registry. Registration number: 100135010, registration key: 15463569.`
      }
    ],
    footer: '© 2026 Nemaks. All rights reserved.'
  },
  zh: {
    title: '隐私政策',
    subtitle: 'Nemaks 平台',
    version: '版本：1.0',
    effectiveDate: '生效日期：2026年2月1日',
    sections: [
      {
        icon: Shield,
        title: '1. 一般规定',
        content: `1.1. 数据控制者：自雇人士 Umarov Kurbanbek（以下简称"运营商"）。

1.2. 本隐私政策规定了 Nemaks 平台用户个人数据的处理和保护程序。

1.3. 该平台适用于年满18周岁的用户。注册即表示您确认已达到该年龄。`
      },
      {
        icon: Database,
        title: '2. 我们收集的数据',
        content: `2.1. 必需数据：
• 用户名
• 密码（使用 bcrypt 加密存储）

2.2. 自动收集的数据：
• IP 地址
• User-Agent（浏览器和设备类型）
• 设备指纹（用于安全）

2.3. 可选数据：
• 双因素认证 (2FA) 数据
• 个人头像
• 个人简介（最多500个字符）

2.4. 支付数据：
• 由 YooKassa 支付系统处理
• Nemaks 仅存储交易 ID 和支付状态
• 银行卡数据不存储在 Nemaks 服务器上`
      },
      {
        icon: Lock,
        title: '3. 消息加密',
        content: `3.1. 私信采用端到端加密 (E2E)，使用 X25519-XSalsa20-Poly1305 算法。

3.2. 使用 E2E 加密时，Nemaks 服务器在技术上无法读取消息内容。

3.3. 群组频道支持可选的 E2E 加密，由频道管理员选择。`
      },
      {
        icon: Bot,
        title: '4. AI 助手 Jarvis',
        content: `4.1. 与 AI 助手 Jarvis 的对话不受端到端加密保护。

4.2. Jarvis 聊天数据可能用于改进响应质量。

4.3. 使用 Jarvis 即表示您同意处理对话数据。

4.4. 请勿向 Jarvis 分享机密信息（密码、财务数据）。`
      },
      {
        icon: Clock,
        title: '5. 数据保留期限',
        content: `5.1. 活跃账户数据在整个使用期间存储。

5.2. 账户删除后：
• 普通用户：45天后删除数据
• 订阅用户：90天后删除数据

5.3. 如有可疑活动（欺诈、违规），数据可能保留最多90天用于调查。

5.4. 安全审计日志保留45天。`
      },
      {
        icon: Users,
        title: '6. 与第三方共享数据',
        content: `6.1. Nemaks 与以下合作伙伴共享数据：
• YooKassa — 用于支付处理
• LiveKit — 用于语音和视频通话

6.2. Nemaks 不向第三方出售个人数据。

6.3. 根据俄罗斯联邦法律，可应执法机构的正式请求提供数据。`
      },
      {
        icon: Key,
        title: '7. 用户权利',
        content: `7.1. 您有权：
• 请求删除您的数据
• 请求导出您的数据
• 撤回数据处理同意
• 禁用双因素认证

7.2. 行使权利请联系：https://t.me/neMaxks`
      },
      {
        icon: Cookie,
        title: '8. Cookies 和技术',
        content: `8.1. Nemaks 使用会话 cookies 来维持授权。

8.2. 不使用第三方广告和分析跟踪器。`
      },
      {
        icon: Shield,
        title: '9. 安全',
        content: `9.1. 密码使用 bcrypt 哈希存储。

9.2. 所有连接均受 HTTPS/TLS 协议保护。

9.3. 实施了暴力破解保护（5次失败尝试后锁定15分钟）。

9.4. 自动欺诈检测系统处于活动状态。`
      },
      {
        icon: Bell,
        title: '10. 政策变更',
        content: `10.1. 运营商有权对本政策进行更改。

10.2. 变更通知在生效前7天发布。

10.3. 继续使用平台即表示接受更新后的政策。`
      },
      {
        icon: MessageSquare,
        title: '11. 联系方式',
        content: `隐私问题请联系：
Telegram: https://t.me/neMaxks
响应时间：最多48小时`
      }
    ],
    footer: '© 2026 Nemaks. 保留所有权利。'
  }
}

export default function PrivacyPage() {
  const [lang, setLang] = useState<Lang>('ru')
  const t = content[lang]

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white overflow-x-hidden">
      <nav className="fixed top-0 w-full z-50 bg-black/50 backdrop-blur-md border-b border-white/10 px-3 py-3 sm:p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-2">
          <Link href="/welcome">
            <button className="flex items-center gap-1 sm:gap-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Назад</span>
            </button>
          </Link>
          <div className="flex gap-1 sm:gap-2">
            {(['ru', 'en', 'zh'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  lang === l ? 'bg-primary text-white' : 'bg-white/10 text-muted-foreground hover:bg-white/20'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-3 sm:px-4 overflow-x-hidden">
        <div className="max-w-4xl mx-auto w-full">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2 break-words">{t.title}</h1>
            <p className="text-muted-foreground text-sm sm:text-base">{t.subtitle}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">{t.version} | {t.effectiveDate}</p>
          </div>

          <div className="space-y-6 sm:space-y-8">
            {t.sections.map((section, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 overflow-hidden">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <section.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                  <h2 className="text-lg sm:text-xl font-semibold break-words">{section.title}</h2>
                </div>
                <div className="text-foreground whitespace-pre-line leading-relaxed text-sm sm:text-base break-words overflow-wrap-anywhere">
                  {section.content}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12 text-muted-foreground">
            {t.footer}
          </div>
        </div>
      </main>
    </div>
  )
}
