import { useState, useEffect } from 'react'
import { Link } from 'wouter'
import { useTranslation } from 'react-i18next'
import { Layout } from '@/components/Layout'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { settingsAPI, type Settings as SettingsType } from '@/lib/api'
import { changeLanguage, languages } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import {
  Bell,
  Shield,
  Globe,
  Mic,
  Bot,
  Save,
  Check,
  Zap,
  FileText,
  ChevronDown,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const defaultSettings: SettingsType = {
  theme: 'light',
  language: 'ru',
  notifications_enabled: true,
  sound_enabled: true,
  voice_enabled: true,
  noise_reduction: true,
  telegram_notifications: false,
  openai_key: '',
  deepseek_key: '',
  huggingface_key: '',
  jarvis_personality: 'professional',
  jarvis_wake_word: 'Jarvis',
  profile_visibility: 'public',
  message_privacy: 'everyone',
}

/* Toggle switch — settings-premium.md spec */
function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-50 disabled:pointer-events-none',
        checked ? 'bg-primary' : 'bg-graphite-300'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow-soft',
          'transition-transform duration-150 ease-out-expo',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

/* Settings section card — flat, hairline-grouped */
function SectionCard({
  id,
  icon: Icon,
  title,
  description,
  index,
  children,
}: {
  id: string
  icon: LucideIcon
  title: string
  description?: string
  index: number
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="animate-rise-in rounded-xl border border-border bg-card text-card-foreground shadow-none overflow-hidden scroll-mt-6"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
        <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div>{children}</div>
    </section>
  )
}

function Row({
  label,
  hint,
  control,
}: {
  label: string
  hint?: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

const selectClass =
  'input-field appearance-none pr-9 cursor-pointer'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { liteMode, setLiteMode } = useStore()
  const [settings, setSettings] = useState<SettingsType>(defaultSettings)
  const [savedSettings, setSavedSettings] = useState<SettingsType>(defaultSettings)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('language')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const data = await settingsAPI.getSettings()
      const merged = { ...defaultSettings, ...data }
      setSettings(merged)
      setSavedSettings(merged)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      await settingsAPI.updateSettings(settings)
      setSavedSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setSettings(savedSettings)
  }

  const toggleSetting = (key: keyof SettingsType) => {
    setSettings({
      ...settings,
      [key]: !settings[key],
    })
  }

  const updateSetting = (key: keyof SettingsType, value: string) => {
    setSettings({
      ...settings,
      [key]: value,
    })
  }

  const handleLanguageChange = (lang: string) => {
    changeLanguage(lang)
    updateSetting('language', lang)
  }

  const scrollToSection = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings)

  const navItems: { id: string; label: string; icon: LucideIcon }[] = [
    { id: 'language', label: t('settings.language'), icon: Globe },
    { id: 'interface', label: t('settings.interface'), icon: Zap },
    { id: 'notifications', label: t('settings.notifications'), icon: Bell },
    { id: 'voice', label: t('voice.call'), icon: Mic },
    { id: 'jarvis', label: 'Jarvis AI', icon: Bot },
    { id: 'privacy', label: t('settings.privacy'), icon: Shield },
  ]

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
          <div className="skeleton h-9 w-48" />
          <div className="skeleton h-4 w-64" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="skeleton h-5 w-40" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
            </div>
          ))}
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 animate-rise-in">
        <div className="max-w-4xl mx-auto lg:max-w-none lg:flex lg:gap-8 lg:items-start">
          {/* Left nav — desktop sidebar */}
          <nav className="hidden lg:block w-60 shrink-0 sticky top-8">
            <h1 className="text-2xl font-display font-bold text-graphite-900 tracking-[-0.015em] px-3 mb-1">
              {t('common.settings')}
            </h1>
            <p className="text-sm text-muted-foreground px-3 mb-4">{t('settings.account')}</p>
            <ul className="space-y-0.5">
              {navItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => scrollToSection(item.id)}
                    className={cn(
                      'relative w-full flex items-center gap-3 h-9 px-3 rounded-lg text-sm transition-all duration-150',
                      activeSection === item.id
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {activeSection === item.id && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />
                    )}
                    <item.icon className="w-4 h-4" strokeWidth={1.75} />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex-1 min-w-0 lg:max-w-[640px]">
            {/* Mobile header + horizontal pills nav */}
            <div className="lg:hidden mb-6">
              <h1 className="text-2xl font-display font-bold text-graphite-900 tracking-[-0.015em] mb-1">
                {t('common.settings')}
              </h1>
              <p className="text-sm text-muted-foreground mb-4">{t('settings.account')}</p>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={cn(
                      'flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 border',
                      activeSection === item.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6 pb-24">
              <SectionCard id="language" icon={Globe} title={t('settings.language')} index={0}>
                <div className="px-5 py-4">
                  <div className="grid grid-cols-3 gap-3">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={cn(
                          'flex items-center gap-3 p-3.5 rounded-lg border transition-all duration-150',
                          i18n.language === lang.code
                            ? 'border-primary bg-accent text-accent-foreground'
                            : 'border-border bg-card hover:border-graphite-300 hover:bg-accent/60'
                        )}
                      >
                        <span className="text-xl">{lang.flag}</span>
                        <span className="text-sm font-medium">{lang.name}</span>
                        {i18n.language === lang.code && (
                          <Check className="w-4 h-4 text-primary ml-auto animate-pop-menu" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard id="interface" icon={Zap} title={t('settings.interface')} index={1}>
                <Row
                  label={t('settings.liteMode')}
                  hint={t('settings.liteModeDesc')}
                  control={
                    <Toggle checked={liteMode} onChange={() => setLiteMode(!liteMode)} />
                  }
                />
              </SectionCard>

              <SectionCard id="notifications" icon={Bell} title={t('settings.notifications')} index={2}>
                <Row
                  label={t('settings.enableNotifications')}
                  hint={t('settings.pushNotifications')}
                  control={
                    <Toggle
                      checked={settings.notifications_enabled}
                      onChange={() => toggleSetting('notifications_enabled')}
                    />
                  }
                />
                <Row
                  label={t('settings.soundEffects')}
                  hint={t('settings.messageSound')}
                  control={
                    <Toggle
                      checked={settings.sound_enabled}
                      onChange={() => toggleSetting('sound_enabled')}
                    />
                  }
                />
              </SectionCard>

              <SectionCard id="voice" icon={Mic} title={t('voice.call')} index={3}>
                <Row
                  label={t('messages.voiceMessage')}
                  hint={t('settings.voiceActivation')}
                  control={
                    <Toggle
                      checked={settings.voice_enabled}
                      onChange={() => toggleSetting('voice_enabled')}
                    />
                  }
                />
                <Row
                  label={t('settings.noiseReduction')}
                  hint={t('settings.noiseReduction')}
                  control={
                    <Toggle
                      checked={settings.noise_reduction}
                      onChange={() => toggleSetting('noise_reduction')}
                    />
                  }
                />
              </SectionCard>

              <SectionCard
                id="jarvis"
                icon={Bot}
                title="Jarvis AI"
                description={t('jarvis.capabilities')}
                index={4}
              >
                <div className="px-5 py-4 space-y-4 border-b border-border">
                  <div>
                    <p className="text-sm font-medium mb-1.5">{t('jarvis.greeting')}</p>
                    <div className="relative">
                      <select
                        className={selectClass}
                        value={settings.jarvis_personality}
                        onChange={(e) => updateSetting('jarvis_personality', e.target.value)}
                      >
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="casual">Casual</option>
                        <option value="technical">Technical</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-graphite-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">{t('jarvis.voiceActivated')}</p>
                    <Input
                      placeholder="Jarvis"
                      value={settings.jarvis_wake_word}
                      onChange={(e) => updateSetting('jarvis_wake_word', e.target.value)}
                    />
                  </div>
                </div>

                <div className="px-5 py-4 space-y-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    API Keys
                  </h4>
                  <div>
                    <p className="text-sm font-medium mb-1.5">Hugging Face API Key</p>
                    <Input
                      type="password"
                      placeholder="hf_..."
                      value={settings.huggingface_key}
                      onChange={(e) => updateSetting('huggingface_key', e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">OpenAI API Key</p>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={settings.openai_key}
                      onChange={(e) => updateSetting('openai_key', e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">DeepSeek API Key</p>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={settings.deepseek_key}
                      onChange={(e) => updateSetting('deepseek_key', e.target.value)}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard id="privacy" icon={Shield} title={t('settings.privacy')} index={5}>
                <div className="px-5 py-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1.5">{t('common.profile')}</p>
                    <div className="relative">
                      <select
                        className={selectClass}
                        value={settings.profile_visibility}
                        onChange={(e) => updateSetting('profile_visibility', e.target.value)}
                      >
                        <option value="public">{t('channels.public')}</option>
                        <option value="friends">{t('friends.all')}</option>
                        <option value="private">{t('channels.private')}</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-graphite-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">{t('messages.newMessage')}</p>
                    <div className="relative">
                      <select
                        className={selectClass}
                        value={settings.message_privacy}
                        onChange={(e) => updateSetting('message_privacy', e.target.value)}
                      >
                        <option value="everyone">{t('common.all')}</option>
                        <option value="friends">{t('friends.all')}</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-graphite-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Lite mode: Quick access to reports */}
              {liteMode && (
                <Link href="/reports">
                  <div className="animate-rise-in rounded-xl border border-border bg-card shadow-none cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300">
                    <div className="flex items-center gap-3 px-5 py-4">
                      <FileText className="w-5 h-5 text-primary" strokeWidth={1.75} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{t('nav.reports')}</p>
                        <p className="text-xs text-muted-foreground">{t('admin.reports')}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              )}
            </div>

            {/* Save bar — sticky bottom, appears when dirty */}
            {(isDirty || saved) && (
              <div className="sticky bottom-4 animate-drawer-up">
                <div className="bg-card border border-border rounded-xl shadow-pop p-4 flex items-center justify-end gap-2">
                  {saved && (
                    <div className="flex items-center gap-2 text-emerald-600 mr-auto animate-fade-in-soft">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">{t('common.success')}</span>
                    </div>
                  )}
                  <Button variant="outline" onClick={handleReset} disabled={!isDirty}>
                    <RotateCcw className="w-4 h-4" />
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleSave} loading={loading}>
                    <Save className="w-4 h-4" />
                    {t('common.save')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
