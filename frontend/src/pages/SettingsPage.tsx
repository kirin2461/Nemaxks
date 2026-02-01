import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Layout } from '@/components/Layout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { settingsAPI, type Settings as SettingsType } from '@/lib/api'
import { changeLanguage, languages } from '@/lib/i18n'
import {
  Bell,
  Shield,
  Globe,
  Mic,
  Bot,
  Save,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const defaultSettings: SettingsType = {
  theme: 'dark',
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

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const [settings, setSettings] = useState<SettingsType>(defaultSettings)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const data = await settingsAPI.getSettings()
      setSettings({ ...defaultSettings, ...data })
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
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setLoading(false)
    }
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

  const SettingToggle = ({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string
    description: string
    checked: boolean
    onChange: () => void
  }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-muted'
        )}
      >
        <div
          className={cn(
            'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  )

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">{t('common.settings')}</h1>
          <p className="text-muted-foreground">
            {t('settings.account')}
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <CardTitle>{t('settings.language')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div>
                <p className="font-medium mb-3">{t('settings.language')}</p>
                <div className="grid grid-cols-3 gap-3">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                        i18n.language === lang.code
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                      )}
                    >
                      <span className="text-2xl">{lang.flag}</span>
                      <span className="font-medium">{lang.name}</span>
                      {i18n.language === lang.code && (
                        <Check className="w-5 h-5 text-primary ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <CardTitle>{t('settings.notifications')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <SettingToggle
                label={t('settings.enableNotifications')}
                description={t('settings.pushNotifications')}
                checked={settings.notifications_enabled}
                onChange={() => toggleSetting('notifications_enabled')}
              />
              <SettingToggle
                label={t('settings.soundEffects')}
                description={t('settings.messageSound')}
                checked={settings.sound_enabled}
                onChange={() => toggleSetting('sound_enabled')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary" />
                <CardTitle>{t('voice.call')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <SettingToggle
                label={t('messages.voiceMessage')}
                description={t('settings.voiceActivation')}
                checked={settings.voice_enabled}
                onChange={() => toggleSetting('voice_enabled')}
              />
              <SettingToggle
                label={t('settings.noiseReduction')}
                description={t('settings.noiseReduction')}
                checked={settings.noise_reduction}
                onChange={() => toggleSetting('noise_reduction')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                <CardTitle>Jarvis AI</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('jarvis.capabilities')}
              </p>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">{t('jarvis.greeting')}</p>
                  <select 
                    className="input-field"
                    value={settings.jarvis_personality}
                    onChange={(e) => updateSetting('jarvis_personality', e.target.value)}
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="casual">Casual</option>
                    <option value="technical">Technical</option>
                  </select>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">{t('jarvis.voiceActivated')}</p>
                  <Input
                    placeholder="Jarvis"
                    value={settings.jarvis_wake_word}
                    onChange={(e) => updateSetting('jarvis_wake_word', e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-6 space-y-4 pt-6 border-t border-border">
                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">API Keys</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Hugging Face API Key</p>
                    <Input
                      type="password"
                      placeholder="hf_..."
                      value={settings.huggingface_key}
                      onChange={(e) => updateSetting('huggingface_key', e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">OpenAI API Key</p>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={settings.openai_key}
                      onChange={(e) => updateSetting('openai_key', e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">DeepSeek API Key</p>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={settings.deepseek_key}
                      onChange={(e) => updateSetting('deepseek_key', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle>{t('settings.privacy')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">{t('common.profile')}</p>
                  <select 
                    className="input-field"
                    value={settings.profile_visibility}
                    onChange={(e) => updateSetting('profile_visibility', e.target.value)}
                  >
                    <option value="public">{t('channels.public')}</option>
                    <option value="friends">{t('friends.all')}</option>
                    <option value="private">{t('channels.private')}</option>
                  </select>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">{t('messages.newMessage')}</p>
                  <select 
                    className="input-field"
                    value={settings.message_privacy}
                    onChange={(e) => updateSetting('message_privacy', e.target.value)}
                  >
                    <option value="everyone">{t('common.all')}</option>
                    <option value="friends">{t('friends.all')}</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <div className="flex items-center gap-2 text-green-500">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">{t('common.success')}</span>
              </div>
            )}
            <Button onClick={handleSave} loading={loading}>
              <Save className="w-4 h-4" />
              {t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
